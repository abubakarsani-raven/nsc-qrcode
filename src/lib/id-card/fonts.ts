import "server-only";

import fs from "fs/promises";
import path from "path";
import fontkit from "@pdf-lib/fontkit";
import type { PDFDocument, PDFFont } from "pdf-lib";
import {
  FONT_FILES,
  type CardFontId,
} from "@/lib/id-card/font-metrics.generated";

const FONT_DIR = path.join(process.cwd(), "public", "fonts");

/**
 * Layout positions every glyph from plain advance widths, so shaping must not
 * swap glyphs (ligatures / contextual alternates) behind its back.
 */
const PLAIN_FEATURES = { liga: false, calt: false, clig: false, dlig: false };

/** Embeds card fonts on first use, once per document. */
export function cardFontEmbedder(pdf: PDFDocument) {
  pdf.registerFontkit(fontkit);
  const cache = new Map<CardFontId, Promise<PDFFont>>();
  return (id: CardFontId) => {
    let font = cache.get(id);
    if (!font) {
      font = fs
        .readFile(path.join(FONT_DIR, FONT_FILES[id]))
        .then((bytes) =>
          pdf.embedFont(bytes, { subset: true, features: PLAIN_FEATURES }),
        );
      cache.set(id, font);
    }
    return font;
  };
}
