#!/usr/bin/env python3
"""
Build the NPERA card art from the Canva export (design/source/npera-id-card.pdf).

The source is a 645.57 x 1000 pt artboard; every visible element lives in one
form XObject as a flat run of top-level q...Q blocks. We drop the per-staff
blocks (photo, name, designation, rule, ID on the front; barcode on the back),
widen the artboard by PAD units top and bottom so it matches the CR80 aspect
without stretching (the dot grid and side bars already run past the edges),
then place it on a 54 x 85.6 mm page.

Emits:
  - design/templates/{fronts,backs}/{id}.pdf  (vector)
  - public/id-card/templates/{fronts,backs}/{id}.png  (600 dpi)
"""
from __future__ import annotations

import sys
from pathlib import Path

try:
    import pymupdf as fitz
except ImportError:
    import fitz  # type: ignore

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "design" / "source" / "npera-id-card.pdf"

CR80_W = 153.0709
CR80_H = 242.6457
SRC_W = 645.5703
SRC_H = 1000.0
K = CR80_W / SRC_W
PAD = (CR80_H / K - SRC_H) / 2

GREEN = "0.019608 0.333333 0.109804"
BLUE = "0.282353 0.647059 0.972549"

FRONT = {
    "id": "NPERA_GREEN",
    "page": 0,
    "form": 5,
    "dots": 15,
    "drop": [
        "1.000000 0.000000 -0.000000 1.000000 242.000000 194.335938 cm",  # ID line
        "1.000000 0.000000 -0.000000 1.000000 212.000000 310.882812 cm",  # name
        "1.000000 0.000000 -0.000000 1.000000 178.000000 266.066406 cm",  # designation
        "1.000000 0.000000 -0.000000 1.000000 256.058594 229.335938 cm",  # title rule
        "/X2 Do",  # photo
    ],
    # Side bars stop at the top edge of the artboard; continue them into the pad.
    "bars_top": [(0.0, 42.1875, GREEN), (63.2891, 75.9492, BLUE)],
    "out_pdf": ROOT / "design" / "templates" / "fronts" / "NPERA_GREEN.pdf",
    "out_png": ROOT / "public" / "id-card" / "templates" / "fronts" / "NPERA_GREEN.png",
}

BACK = {
    "id": "BACK_NPERA_GREEN",
    "page": 1,
    "form": 125,
    "dots": 141,
    "drop": ["/X3 Do"],  # sample barcode; regenerated per staff
    "bars_top": [],
    "out_pdf": ROOT / "design" / "templates" / "backs" / "BACK_NPERA_GREEN.pdf",
    "out_png": ROOT / "public" / "id-card" / "templates" / "backs" / "BACK_NPERA_GREEN.png",
}


def split_blocks(stream: str) -> list[str]:
    """Split a content stream into top-level q...Q blocks (other lines kept as-is)."""
    blocks: list[str] = []
    current: list[str] = []
    depth = 0
    for line in stream.split("\n"):
        stripped = line.strip()
        if depth == 0 and stripped != "q":
            if stripped:
                blocks.append(line)
            continue
        current.append(line)
        if stripped == "q":
            depth += 1
        elif stripped == "Q":
            depth -= 1
            if depth == 0:
                blocks.append("\n".join(current))
                current = []
    if depth != 0:
        raise RuntimeError("unbalanced q/Q in content stream")
    return blocks


def bbox_extended() -> str:
    return f"[0 {-PAD - 1:.4f} {SRC_W} {SRC_H + PAD + 1:.4f}]"


def build(doc: fitz.Document, spec: dict) -> None:
    form = spec["form"]
    stream = doc.xref_stream(form).decode("latin1")
    blocks = split_blocks(stream)

    kept: list[str] = []
    hits = {marker: 0 for marker in spec["drop"]}
    for block in blocks:
        matched = [m for m in spec["drop"] if m in block]
        if matched:
            for m in matched:
                hits[m] += 1
            continue
        kept.append(block)
    for marker, count in hits.items():
        if count != 1:
            raise RuntimeError(f"{spec['id']}: marker {marker!r} matched {count} blocks")

    lo, hi = -PAD - 1, SRC_H + PAD + 1
    white_pad = (
        "q\n1.000000 1.000000 1.000000 scn\n"
        f"0 {lo:.4f} {SRC_W} {-lo:.4f} re f\n"
        f"0 {SRC_H} {SRC_W} {hi - SRC_H:.4f} re f\nQ"
    )
    bars = [
        f"q\n{color} scn\n{x0} {SRC_H - 0.5} {x1 - x0:.4f} {hi - SRC_H + 0.5:.4f} re f\nQ"
        for x0, x1, color in spec["bars_top"]
    ]
    new_stream = "\n".join([white_pad, *kept, *bars]) + "\n"
    doc.update_stream(form, new_stream.encode("latin1"))
    doc.xref_set_key(form, "BBox", bbox_extended())
    doc.xref_set_key(spec["dots"], "BBox", bbox_extended())

    page = doc[spec["page"]]
    # Keep only the artwork: drops the invisible text layer and the page-sized soft mask.
    contents = page.get_contents()
    doc.update_stream(contents[0], b"/C1 CS\n/C1 cs\nq\n/X1 Do\nQ\n")
    for extra in contents[1:]:
        doc.update_stream(extra, b"")
    doc.xref_set_key(page.xref, "MediaBox", f"[0 {-PAD:.4f} {SRC_W} {SRC_H + PAD:.4f}]")
    doc.xref_set_key(page.xref, "CropBox", "null")

    out = fitz.open()
    target = out.new_page(width=CR80_W, height=CR80_H)
    target.show_pdf_page(target.rect, doc, spec["page"])
    spec["out_pdf"].parent.mkdir(parents=True, exist_ok=True)
    out.save(str(spec["out_pdf"]), garbage=4, deflate=True)
    spec["out_png"].parent.mkdir(parents=True, exist_ok=True)
    pix = target.get_pixmap(matrix=fitz.Matrix(600 / 72, 600 / 72), alpha=False)
    pix.save(str(spec["out_png"]))
    print(f"{spec['id']}: dropped {len(spec['drop'])} blocks -> {spec['out_pdf'].name}, "
          f"{spec['out_png'].name} ({pix.width}x{pix.height})")
    out.close()


def to_card(x: float, y: float) -> tuple[float, float]:
    """Source artboard units (top-left origin) -> CR80 points (top-left origin)."""
    return round(x * K, 3), round((y + PAD) * K, 3)


def main() -> int:
    if not SOURCE.exists():
        print(f"Missing source PDF: {SOURCE}", file=sys.stderr)
        return 1
    print(f"k={K:.6f} pad={PAD:.4f} units ({PAD * K:.4f} pt)")
    for spec in (FRONT, BACK):
        doc = fitz.open(SOURCE)
        build(doc, spec)
        doc.close()

    probes = {
        "front axis / circle centre": (361.9, 402.87),
        "photo circle tl": (210.0, 250.97),
        "photo circle br": (513.8, 554.77),
        "surname baseline": (361.9, 639.3),
        "given baseline": (361.9, 700.3),
        "designation baseline": (361.9, 747.23),
        "rule tl": (256.06, 762.23),
        "rule br": (467.03, 766.45),
        "id baseline": (361.9, 818.96),
        "front left content edge": (75.95, 0),
        "back axis": (288.8, 0),
        "back barcode tl": (128.11, 817.55),
        "back barcode br": (449.95, 924.83),
        "back right content edge": (569.62, 0),
    }
    for label, (x, y) in probes.items():
        print(f"  {label:28} {to_card(x, y)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
