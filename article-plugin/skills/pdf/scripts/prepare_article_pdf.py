"""Convert an article PDF into origin.md + img/ for the article plugin.

Embedded image XObjects in research papers often correspond to a single logical
figure being sliced into many small tiles (e.g. a 8x8 grid of demo frames).
Extracting each XObject would explode the img/ directory and pollute origin.md
with hundreds of broken-up references. Instead, we group image rects on the
same page by vertical proximity and render each cluster as one PNG via
``pdfplumber``'s page.crop().to_image(). One cluster -> one fig_N.png.
"""

import shutil
import sys
from pathlib import Path

import pdfplumber
from pypdf import PdfReader


CLUSTER_GAP_POINTS = 18.0   # vertical gap (PDF points) that separates two figures
PADDING_POINTS = 4.0        # extra margin around a cluster's union bbox
RENDER_DPI = 180


def cluster_rects_vertically(rects, gap_threshold=CLUSTER_GAP_POINTS):
    """Group image rects on a page into vertically separated clusters.

    Rects are (x0, top, x1, bottom) in PDF points. Two rects belong to the same
    cluster as long as the next rect's top is within ``gap_threshold`` of the
    running max bottom of the current cluster. This separates e.g. Figure 10
    and Figure 11 on the same page while keeping all tiles of one figure
    together.
    """
    if not rects:
        return []
    sorted_rects = sorted(rects, key=lambda r: r[1])
    clusters = [[sorted_rects[0]]]
    running_bottom = sorted_rects[0][3]
    for r in sorted_rects[1:]:
        if r[1] - running_bottom > gap_threshold:
            clusters.append([r])
            running_bottom = r[3]
        else:
            clusters[-1].append(r)
            running_bottom = max(running_bottom, r[3])
    return clusters


def union_bbox(rects):
    return (
        min(r[0] for r in rects),
        min(r[1] for r in rects),
        max(r[2] for r in rects),
        max(r[3] for r in rects),
    )


def normalize_page_text(reader_page) -> str:
    text = reader_page.extract_text() or ""
    text = text.replace("\r\n", "\n").replace("\r", "\n").strip()
    if not text:
        return ""
    lines = [line.rstrip() for line in text.split("\n")]
    return "\n".join(lines).strip()


def collect_page_image_rects(plumber_page):
    rects = []
    for im in plumber_page.images:
        x0, top, x1, bottom = im["x0"], im["top"], im["x1"], im["bottom"]
        # clip to page bbox
        x0 = max(x0, 0)
        top = max(top, 0)
        x1 = min(x1, plumber_page.width)
        bottom = min(bottom, plumber_page.height)
        if x1 - x0 > 1 and bottom - top > 1:
            rects.append((x0, top, x1, bottom))
    return rects


def render_cluster_png(plumber_page, bbox, out_path, resolution=RENDER_DPI):
    x0, top, x1, bottom = bbox
    pad = PADDING_POINTS
    padded = (
        max(0, x0 - pad),
        max(0, top - pad),
        min(plumber_page.width, x1 + pad),
        min(plumber_page.height, bottom + pad),
    )
    image = plumber_page.crop(padded).to_image(resolution=resolution)
    image.save(str(out_path), format="PNG")


def build_origin_md(pdf_path: Path, img_dir: Path, origin_md_path: Path) -> None:
    reader = PdfReader(str(pdf_path))

    sections = ["# 原始文章（PDF 转换稿）", ""]
    fig_index = 0

    with pdfplumber.open(str(pdf_path)) as plumb:
        for page_num, (reader_page, plumber_page) in enumerate(
            zip(reader.pages, plumb.pages), start=1
        ):
            sections.append(f"## 第 {page_num} 页")
            sections.append("")

            text = normalize_page_text(reader_page)
            if text:
                sections.append(text)
                sections.append("")

            rects = collect_page_image_rects(plumber_page)
            if not rects:
                continue

            for cluster in cluster_rects_vertically(rects):
                fig_index += 1
                fig_name = f"fig_{fig_index}.png"
                fig_path = img_dir / fig_name
                render_cluster_png(plumber_page, union_bbox(cluster), fig_path)

                sections.append(f"![fig_{fig_index}](../img/{fig_name})")
                sections.append("")

    origin_md_path.parent.mkdir(parents=True, exist_ok=True)
    origin_md_path.write_text("\n".join(sections).rstrip() + "\n", encoding="utf-8")


def prepare_article_pdf(input_pdf_path: str, work_dir_path: str) -> None:
    input_pdf = Path(input_pdf_path).resolve()
    work_dir = Path(work_dir_path).resolve()
    origin_pdf = work_dir / "origin.pdf"
    img_dir = work_dir / "img"
    origin_md = work_dir / "rewrite-round-1" / "origin.md"

    if not input_pdf.exists():
        raise FileNotFoundError(f"Input PDF not found: {input_pdf}")

    work_dir.mkdir(parents=True, exist_ok=True)
    img_dir.mkdir(parents=True, exist_ok=True)
    origin_md.parent.mkdir(parents=True, exist_ok=True)

    # clean previously extracted figures (any extension from the old pipeline)
    for existing_image in img_dir.glob("fig_*"):
        existing_image.unlink()

    shutil.copyfile(input_pdf, origin_pdf)
    build_origin_md(origin_pdf, img_dir, origin_md)

    fig_count = len(list(img_dir.glob("fig_*")))
    print(f"Copied PDF to {origin_pdf}")
    print(f"Rendered {fig_count} figure image(s) to {img_dir}")
    print(f"Wrote markdown to {origin_md}")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: prepare_article_pdf.py [input pdf] [work dir]")
        sys.exit(1)

    prepare_article_pdf(sys.argv[1], sys.argv[2])
