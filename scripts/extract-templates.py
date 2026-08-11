#!/usr/bin/env python3
"""
Strip placeholder photo / QR / dynamic text from sample ID card pages.

Keeps static chrome (crest, org name, waves, back body copy).
Emits:
  - design/templates/{fronts,backs}/{id}.pdf
  - public/id-card/templates/{fronts,backs}/{id}.png (600 dpi preview)
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

try:
    import pymupdf as fitz
except ImportError:
    import fitz  # type: ignore

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "design" / "source" / "nsc-id-card.pdf"
WAVE_BG = ROOT / "design" / "assets" / "wave-geometric-bg.png"
CREST_PNG = ROOT / "design" / "assets" / "nsc-crest.png"
POPPINS_BOLD = ROOT / "public" / "fonts" / "Poppins-Bold.ttf"
OUT_FRONTS = ROOT / "design" / "templates" / "fronts"
OUT_BACKS = ROOT / "design" / "templates" / "backs"
PREVIEW_FRONTS = ROOT / "public" / "id-card" / "templates" / "fronts"
PREVIEW_BACKS = ROOT / "public" / "id-card" / "templates" / "backs"

FRONTS = {
    "WAVE_GREEN": 0,
    "WAVE_BLUE": 2,
    "BAR_BLUE_SQUARE": 4,
    "BAR_BLUE_CIRCLE": 5,
    "BAR_GREEN_CIRCLE": 7,
    "BAR_GREEN_SQUARE": 8,
}
BACKS = {
    "BACK_WAVE_GREEN": 1,
    "BACK_WAVE_BLUE": 3,
    "BACK_BAR_BLUE": 6,
    "BACK_BAR_GREEN": 9,
}

# Plan coords are top-left origin — same as PyMuPDF page space.
# 4:5 image placement boxes (for deleting the portrait xref)
PHOTO_IMAGE = {
    "wave": fitz.Rect(31.8, 58.7, 102.0, 146.4),
    "bar_circle": fitz.Rect(39.7, 52.4, 109.8, 140.1),
    "bar_square": fitz.Rect(47.2, 44.8, 110.1, 123.4),
}

# Visible mask on the card — true circles are square bboxes from sample fills
PHOTO_FRAME = {
    # Nudged +6pt vs sample so the halo clears the org-name band
    "wave": fitz.Rect(36.61, 55.73, 105.01, 124.13),  # 68.4 circle
    "bar_circle": fitz.Rect(44.42, 49.4, 112.83, 117.81),  # 68.4 circle
    "bar_square": fitz.Rect(47.2, 44.8, 110.1, 123.4),
}

QR_BOX = {
    0: fitz.Rect(51.33, 186.0, 90.00, 224.5),
    2: fitz.Rect(51.33, 186.0, 90.00, 224.5),
    4: fitz.Rect(59.17, 191.33, 97.83, 230.0),
    5: fitz.Rect(59.17, 191.33, 97.83, 230.0),
    7: fitz.Rect(59.17, 191.33, 97.83, 230.0),
    8: fitz.Rect(59.17, 191.33, 97.83, 230.0),
}

# Barcode position measured from the source PDF: sits just under the
# "Executive Secretary/CEO" caption, clear of the bottom wave/bar art.
BARCODE_BOX = {
    1: fitz.Rect(35.9, 192.4, 105.6, 209.6),  # BACK_WAVE_GREEN
    3: fitz.Rect(35.9, 192.4, 105.6, 209.6),  # BACK_WAVE_BLUE
    6: fitz.Rect(35.9, 192.4, 105.6, 209.6),  # BACK_BAR_BLUE
    9: fitz.Rect(35.9, 192.4, 105.6, 209.6),  # BACK_BAR_GREEN
}

# Only dynamic front fields — never the org header "NIGERIAN SHIPPERS' COUNCIL"
PLACEHOLDER_TEXT = re.compile(
    r"(AKUTAH|PIUS|UKEYIMA|EXECUTIVE SECRETARY/CEO|ID NO\.?\s*1234567890)",
    re.I,
)

PHOTO_XREF = 81  # sample portrait on fronts
BARCODE_XREF = 118  # wave backs (may vary; also matched by bbox)


def photo_keys(page_index: int) -> tuple[fitz.Rect, fitz.Rect, bool]:
    """Returns (image_box, frame_box, is_circle)."""
    if page_index in (4, 8):
        return PHOTO_IMAGE["bar_square"], PHOTO_FRAME["bar_square"], False
    if page_index in (5, 7):
        return PHOTO_IMAGE["bar_circle"], PHOTO_FRAME["bar_circle"], True
    return PHOTO_IMAGE["wave"], PHOTO_FRAME["wave"], True


def remove_photo(page: fitz.Page, page_index: int) -> int:
    """Remove only the staff portrait, never the crest / header art / background."""
    image_box, frame, is_circle = photo_keys(page_index)
    removed = 0
    seen: set[int] = set()
    for img in page.get_images(full=True):
        xref = img[0]
        if xref in seen:
            continue
        seen.add(xref)
        rects = page.get_image_rects(xref)
        if not rects:
            continue
        for rect in rects:
            overlap = fitz.Rect(rect) & image_box
            if xref == PHOTO_XREF or (
                overlap.get_area() > 0 and overlap.get_area() / max(rect.get_area(), 1) > 0.5
            ):
                try:
                    page.delete_image(xref)
                except Exception:
                    page.draw_rect(rect, color=(1, 1, 1), fill=(1, 1, 1), overlay=True)
                removed += 1
                break
    # White out the portrait hole AND any coloured circular frame/ring behind it.
    # Soft sample halos extend a few points past the hard circle edge.
    pad = 6.0 if is_circle else 3.0
    clear = fitz.Rect(frame.x0 - pad, frame.y0 - pad, frame.x1 + pad, frame.y1 + pad)
    if is_circle:
        page.draw_oval(clear, color=(1, 1, 1), fill=(1, 1, 1), overlay=True)
    else:
        page.draw_rect(clear, color=(1, 1, 1), fill=(1, 1, 1), overlay=True)
    return removed


def redact_placeholder_text(page: fitz.Page) -> int:
    """Strip sample name/title/ID glyphs without painting white bars over the pattern."""
    count = 0
    blocks = page.get_text("dict")["blocks"]
    for block in blocks:
        if block.get("type") != 0:
            continue
        for line in block.get("lines", []):
            text = "".join(span.get("text", "") for span in line.get("spans", []))
            # Keep static org name on the front header
            if re.fullmatch(r"\s*NIGERIAN SHIPPERS['’] COUNCIL\s*", text, re.I):
                continue
            if PLACEHOLDER_TEXT.search(text):
                page.add_redact_annot(fitz.Rect(line["bbox"]), fill=False)
                count += 1
    if count:
        page.apply_redactions(
            images=fitz.PDF_REDACT_IMAGE_NONE,
            graphics=fitz.PDF_REDACT_LINE_ART_NONE,
            text=fitz.PDF_REDACT_TEXT_REMOVE,
        )
    return count


def whiteout_qr(page: fitz.Page, page_index: int) -> None:
    """Remove sample QR vector art without painting a white plate (card pattern stays)."""
    box = QR_BOX.get(page_index)
    if not box:
        return
    pad = 2.0
    clean = fitz.Rect(box.x0 - pad, box.y0 - pad, box.x1 + pad, box.y1 + pad)
    page.add_redact_annot(clean, fill=False)
    page.apply_redactions(
        images=fitz.PDF_REDACT_IMAGE_NONE,
        graphics=fitz.PDF_REDACT_LINE_ART_REMOVE_IF_COVERED,
    )


def whiteout_barcode(page: fitz.Page, page_index: int) -> None:
    # Get template-specific barcode box
    box = BARCODE_BOX.get(page_index, BARCODE_BOX[1])  # Default to wave if not found
    box_padded = box + (-2, -2, 2, 2)
    page.draw_rect(box_padded, color=(1, 1, 1), fill=(1, 1, 1), overlay=True)
    seen: set[int] = set()
    for img in page.get_images(full=True):
        xref = img[0]
        if xref in seen:
            continue
        seen.add(xref)
        for rect in page.get_image_rects(xref):
            if (fitz.Rect(rect) & box).get_area() > 0:
                try:
                    page.delete_image(xref)
                except Exception:
                    page.draw_rect(rect, color=(1, 1, 1), fill=(1, 1, 1), overlay=True)
                break


def _replay_drawings(page: fitz.Page, drawings: list) -> None:
    shape = page.new_shape()
    for path in drawings:
        for item in path.get("items", []):
            op = item[0]
            if op == "l":
                shape.draw_line(item[1], item[2])
            elif op == "c":
                shape.draw_bezier(item[1], item[2], item[3], item[4])
            elif op == "qu":
                shape.draw_quad(item[1])
            elif op == "re":
                shape.draw_rect(item[1])
        stroke_op = path.get("stroke_opacity")
        fill_op = path.get("fill_opacity")
        shape.finish(
            color=path.get("color"),
            fill=path.get("fill"),
            width=path.get("width") or 0,
            closePath=bool(path.get("closePath", False)),
            even_odd=bool(path.get("even_odd", False)),
            stroke_opacity=1 if stroke_op is None else stroke_op,
            fill_opacity=1 if fill_op is None else fill_op,
        )
    shape.commit()


ORG_NAME = "NIGERIAN SHIPPERS' COUNCIL"
# Poppins needs ~12pt box height at 6pt; keep top aligned with sample (~36.4).
ORG_NAME_RECT = fitz.Rect(18.0, 35.5, 123.75, 48.0)
ORG_NAME_SIZE = 6.0
ORG_COLORS = {
    0: (0x07 / 255, 0x83 / 255, 0x53 / 255),  # WAVE_GREEN
    2: (0x08 / 255, 0x78 / 255, 0xa5 / 255),  # WAVE_BLUE — match bar-blue chrome
}
CREST_RECT = fitz.Rect(54.3805, 7.3064, 87.3538, 35.0340)


def remove_crest(page: fitz.Page) -> None:
    """Delete crest images so we can place a single clean crest overlay."""
    seen: set[int] = set()
    for img in page.get_images(full=True):
        xref = img[0]
        if xref in seen:
            continue
        seen.add(xref)
        for rect in page.get_image_rects(xref):
            r = fitz.Rect(rect)
            # Crest is the small circular badge; skip full-page / portrait images.
            if r.width < 50 and r.height < 50 and r.y1 < 45:
                try:
                    page.delete_image(xref)
                except Exception:
                    page.draw_oval(r, color=(1, 1, 1), fill=(1, 1, 1), overlay=True)
                break


def redact_org_name(page: fitz.Page) -> None:
    """Remove baked org-name glyphs so we can redraw in the theme colour."""
    count = 0
    for block in page.get_text("dict")["blocks"]:
        if block.get("type") != 0:
            continue
        for line in block.get("lines", []):
            text = "".join(span.get("text", "") for span in line.get("spans", []))
            if re.fullmatch(r"\s*NIGERIAN SHIPPERS['’] COUNCIL\s*", text, re.I):
                page.add_redact_annot(fitz.Rect(line["bbox"]), fill=False)
                count += 1
    if count:
        page.apply_redactions(
            images=fitz.PDF_REDACT_IMAGE_NONE,
            graphics=fitz.PDF_REDACT_LINE_ART_NONE,
            text=fitz.PDF_REDACT_TEXT_REMOVE,
        )


def whiteout_title_rules(page: fitz.Page) -> None:
    """Erase thin designation underlines — live preview/PDF draw the double rule."""
    for path in page.get_drawings():
        rect = fitz.Rect(path.get("rect") or (0, 0, 0, 0))
        if 155 <= rect.y0 <= 175 and rect.height <= 2.5 and 30 < rect.width < 80:
            pad = 1.0
            page.draw_rect(
                fitz.Rect(rect.x0 - pad, rect.y0 - pad, rect.x1 + pad, rect.y1 + pad),
                color=(1, 1, 1),
                fill=(1, 1, 1),
                overlay=True,
            )


def save_circular_crest(src_page: fitz.Page) -> None:
    """Crop crest and mask to a circle so the overlay has no square plate."""
    pix = src_page.get_pixmap(
        matrix=fitz.Matrix(600 / 72, 600 / 72),
        clip=CREST_RECT,
        alpha=False,
    )
    CREST_PNG.parent.mkdir(parents=True, exist_ok=True)
    raw = CREST_PNG.with_name("nsc-crest-raw.png")
    pix.save(str(raw))
    try:
        from PIL import Image, ImageDraw

        im = Image.open(raw).convert("RGBA")
        w, h = im.size
        mask = Image.new("L", (w, h), 0)
        ImageDraw.Draw(mask).ellipse((0, 0, w - 1, h - 1), fill=255)
        im.putalpha(mask)
        im.save(CREST_PNG)
    except Exception:
        raw.replace(CREST_PNG)


def draw_org_name(page: fitz.Page, page_index: int) -> None:
    color = ORG_COLORS.get(page_index, ORG_COLORS[0])
    if POPPINS_BOLD.exists():
        font = fitz.Font(fontfile=str(POPPINS_BOLD))
        tw = font.text_length(ORG_NAME, fontsize=ORG_NAME_SIZE)
        x = (page.rect.width - tw) / 2
        # Baseline ~ sample visual centre of the org-name band
        y = 42.2
        twriter = fitz.TextWriter(page.rect, color=color)
        twriter.append(fitz.Point(x, y), ORG_NAME, font=font, fontsize=ORG_NAME_SIZE)
        twriter.write_text(page)
        return

    page.insert_textbox(
        ORG_NAME_RECT,
        ORG_NAME,
        fontname="helv",
        fontsize=ORG_NAME_SIZE,
        color=color,
        align=fitz.TEXT_ALIGN_CENTER,
    )


def _place_wave_background(page: fitz.Page, clean_page: fitz.Page, page_index: int = 0) -> None:
    """
    Rasterize the cleaned source page as the card background.

    Do NOT shift the whole page: an earlier +8pt shift for WAVE_BLUE duplicated the
    crest and dragged the org name under the photo frame.
    """
    del page_index  # kept for call-site compatibility
    pix = clean_page.get_pixmap(matrix=fitz.Matrix(600 / 72, 600 / 72), alpha=False)
    temp_bg = Path("/tmp/wave_bg_temp.png")
    pix.save(str(temp_bg))
    page.insert_image(page.rect, filename=str(temp_bg), keep_proportion=False)


def build_wave_front(src_page: fitz.Page, page_index: int) -> fitz.Document:
    """WAVE fronts on the light geometric background + sample chrome."""
    save_circular_crest(src_page)
    _, frame, _ = photo_keys(page_index)

    # Clean a copy of the source page before rendering as background
    clean_doc = fitz.open()
    clean_doc.insert_pdf(fitz.open(SOURCE), from_page=page_index, to_page=page_index)
    clean_page = clean_doc[0]
    remove_photo(clean_page, page_index)
    remove_crest(clean_page)
    redact_placeholder_text(clean_page)
    redact_org_name(clean_page)
    whiteout_qr(clean_page, page_index)
    whiteout_title_rules(clean_page)

    out = fitz.open()
    page = out.new_page(width=src_page.rect.width, height=src_page.rect.height)
    _place_wave_background(page, clean_page, page_index)

    # Single crest — white disk then circular PNG
    crest_pad = 1.2
    crest_disk = fitz.Rect(
        CREST_RECT.x0 - crest_pad,
        CREST_RECT.y0 - crest_pad,
        CREST_RECT.x1 + crest_pad,
        CREST_RECT.y1 + crest_pad,
    )
    page.draw_oval(crest_disk, color=(1, 1, 1), fill=(1, 1, 1))
    page.insert_image(CREST_RECT, filename=str(CREST_PNG), keep_proportion=True)

    draw_org_name(page, page_index)

    # Photo hole + halo — must stay below org name (name baseline ~42, frame ~50)
    ring_pt = 3.5
    ring = fitz.Rect(
        frame.x0 - ring_pt,
        frame.y0 - ring_pt,
        frame.x1 + ring_pt,
        frame.y1 + ring_pt,
    )
    page.draw_oval(ring, color=None, fill=(0xD3 / 255, 0xDC / 255, 0xF1 / 255))
    page.draw_oval(frame, color=(1, 1, 1), fill=(1, 1, 1))

    return out


def process_front(doc: fitz.Document, page_index: int, out_pdf: Path, out_png: Path) -> dict:
    is_wave = page_index in (0, 2)
    if is_wave:
        new_doc = build_wave_front(doc[page_index], page_index)
        page = new_doc[0]
        photos, texts = 1, 0
    else:
        new_doc = fitz.open()
        new_doc.insert_pdf(doc, from_page=page_index, to_page=page_index)
        page = new_doc[0]
        photos = remove_photo(page, page_index)
        texts = redact_placeholder_text(page)
        whiteout_qr(page, page_index)

    out_pdf.parent.mkdir(parents=True, exist_ok=True)
    new_doc.save(out_pdf, garbage=4, deflate=True)
    out_png.parent.mkdir(parents=True, exist_ok=True)
    pix = page.get_pixmap(matrix=fitz.Matrix(600 / 72, 600 / 72), alpha=False)
    pix.save(out_png)
    new_doc.close()
    return {
        "page": page_index,
        "photos_removed": photos,
        "texts_redacted": texts,
        "pdf": str(out_pdf),
        "png": str(out_png),
    }


def process_back(
    doc: fitz.Document, page_index: int, out_pdf: Path, out_png: Path, wave: bool
) -> dict:
    """
    Process back template - completely static, no dynamic content.
    Just remove the barcode placeholder from the original PDF.
    """
    new_doc = fitz.open()
    new_doc.insert_pdf(doc, from_page=page_index, to_page=page_index)
    page = new_doc[0]

    # Only whiteout the barcode - keep everything else exactly as-is
    whiteout_barcode(page, page_index)

    # Save the template
    out_pdf.parent.mkdir(parents=True, exist_ok=True)
    new_doc.save(str(out_pdf), garbage=4, deflate=True)

    # Generate preview at 600 DPI
    out_png.parent.mkdir(parents=True, exist_ok=True)
    pix = page.get_pixmap(matrix=fitz.Matrix(600 / 72, 600 / 72), alpha=False)
    pix.save(str(out_png))

    new_doc.close()

    return {
        "page": page_index,
        "pdf": str(out_pdf),
        "png": str(out_png),
    }


def main() -> int:
    if not SOURCE.exists():
        print(f"Missing source PDF: {SOURCE}", file=sys.stderr)
        return 1
    doc = fitz.open(SOURCE)
    report: dict = {"fronts": {}, "backs": {}}
    for tid, idx in FRONTS.items():
        report["fronts"][tid] = process_front(
            doc, idx, OUT_FRONTS / f"{tid}.pdf", PREVIEW_FRONTS / f"{tid}.png"
        )
        print(f"front {tid} <- page {idx}: {report['fronts'][tid]}")

    # Backs are fully static: copy the source page verbatim, barcode included.
    # Nothing is drawn on top of them at render time.
    for tid, idx in BACKS.items():
        OUT_BACKS.mkdir(parents=True, exist_ok=True)
        PREVIEW_BACKS.mkdir(parents=True, exist_ok=True)

        back_doc = fitz.open()
        back_doc.insert_pdf(doc, from_page=idx, to_page=idx)
        back_page = back_doc[0]

        back_doc.save(str(OUT_BACKS / f"{tid}.pdf"), garbage=4, deflate=True)

        pix = back_page.get_pixmap(matrix=fitz.Matrix(600 / 72, 600 / 72), alpha=False)
        pix.save(str(PREVIEW_BACKS / f"{tid}.png"))
        back_doc.close()

        report["backs"][tid] = {
            "page": idx,
            "pdf": str(OUT_BACKS / f"{tid}.pdf"),
            "png": str(PREVIEW_BACKS / f"{tid}.png"),
        }
        print(f"back {tid} <- page {idx} (verbatim copy)")

    doc.close()
    (ROOT / "design" / "templates" / "extract-report.json").write_text(
        json.dumps(report, indent=2)
    )
    print("Done.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
