import "server-only";

import fs from "fs/promises";
import path from "path";
import fontkit from "@pdf-lib/fontkit";
import type { PDFDocument } from "pdf-lib";

const FONT_DIR = path.join(process.cwd(), "public", "fonts");

async function readFont(name: string) {
  return fs.readFile(path.join(FONT_DIR, name));
}

/** Embed Poppins (all card text) for print PDFs. */
export async function embedCardFonts(pdf: PDFDocument) {
  pdf.registerFontkit(fontkit);
  const [regularBytes, boldBytes] = await Promise.all([
    readFont("Poppins-Regular.ttf"),
    readFont("Poppins-Bold.ttf"),
  ]);
  const regular = await pdf.embedFont(regularBytes, { subset: true });
  const bold = await pdf.embedFont(boldBytes, { subset: true });
  return { regular, bold };
}
