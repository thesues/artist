import shutil
import sys
from pathlib import Path

from pypdf import PdfReader


def guess_extension(image_name: str, image_data: bytes) -> str:
    """Guess image extension from embedded name or magic bytes."""
    lower = image_name.lower()
    if lower.endswith(".jpg") or lower.endswith(".jpeg"):
        return ".jpg"
    if lower.endswith(".png"):
        return ".png"
    if lower.endswith(".gif"):
        return ".gif"
    if lower.endswith(".bmp"):
        return ".bmp"
    # fallback: check magic bytes
    if image_data[:3] == b"\xff\xd8\xff":
        return ".jpg"
    if image_data[:8] == b"\x89PNG\r\n\x1a\n":
        return ".png"
    return ".png"


def normalize_page_text(page) -> str:
    text = page.extract_text() or ""
    text = text.replace("\r\n", "\n").replace("\r", "\n").strip()
    if not text:
        return ""
    lines = [line.rstrip() for line in text.split("\n")]
    return "\n".join(lines).strip()


def build_origin_md(pdf_path: Path, img_dir: Path, origin_md_path: Path) -> None:
    reader = PdfReader(str(pdf_path))

    sections = [
        "# 原始文章（PDF 转换稿）",
        "",
    ]

    fig_index = 0

    for page_num, page in enumerate(reader.pages, start=1):
        sections.append(f"## 第 {page_num} 页")
        sections.append("")

        text = normalize_page_text(page)
        if text:
            sections.append(text)
            sections.append("")

        # extract embedded images from this page
        page_images = page.images
        for img in page_images:
            fig_index += 1
            ext = guess_extension(img.name, img.data)
            fig_name = f"fig_{fig_index}{ext}"
            fig_path = img_dir / fig_name
            fig_path.write_bytes(img.data)

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

    # clean old extracted images
    for existing_image in img_dir.glob("fig_*"):
        existing_image.unlink()

    shutil.copyfile(input_pdf, origin_pdf)
    build_origin_md(origin_pdf, img_dir, origin_md)

    fig_count = len(list(img_dir.glob("fig_*")))
    print(f"Copied PDF to {origin_pdf}")
    print(f"Extracted {fig_count} embedded images to {img_dir}")
    print(f"Wrote markdown to {origin_md}")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: prepare_article_pdf.py [input pdf] [work dir]")
        sys.exit(1)

    prepare_article_pdf(sys.argv[1], sys.argv[2])
