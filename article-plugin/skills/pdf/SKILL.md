---
name: pdf
description: Use this skill whenever the user wants to do anything with PDF files. This includes reading or extracting text/tables from PDFs, combining or merging multiple PDFs into one, splitting PDFs apart, rotating pages, adding watermarks, creating new PDFs, filling PDF forms, encrypting/decrypting PDFs, extracting images, and OCR on scanned PDFs to make them searchable. If the user mentions a .pdf file or asks to produce one, use this skill.
---

# PDF Processing Guide

## Article PDF Preprocessing

For article review/enhance flows, use the existing scripts in `scripts/` rather than inventing a one-off PDF pipeline:

- `python scripts/prepare_article_pdf.py <input.pdf> <work_dir>`
- Output contract:
  - `<work_dir>/origin.pdf`
  - `<work_dir>/img/fig_N.png` (one PNG per figure, rendered from the PDF)
  - `<work_dir>/rewrite-round-1/origin.md`

`rewrite-round-1/origin.md` will contain:

- `![fig_N](../img/fig_N.png)` for each rendered figure

The script does **not** export each embedded image XObject as a separate file. Research-paper figures (e.g. an 8x8 grid of demo frames) are encoded as many small JPEG XObjects in the PDF, and exporting them 1:1 would produce hundreds of fragments. Instead, image rects on the same page are clustered by vertical proximity and each cluster's union bbox is rendered to a single PNG via `pdfplumber.Page.crop().to_image(resolution=180)`. So a page containing two figures (e.g. Figure 10 and Figure 11) yields exactly two `fig_*.png`, not 50+ tiles.

Image references are intended to stay stable across later rewrite rounds, so downstream agents should preserve `../img/...` paths rather than copying images into each round directory.

## Quick Start

```python
from pypdf import PdfReader, PdfWriter

# Read a PDF
reader = PdfReader("document.pdf")
print(f"Pages: {len(reader.pages)}")

# Extract text
text = ""
for page in reader.pages:
    text += page.extract_text()
```
