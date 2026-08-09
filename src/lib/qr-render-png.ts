import "server-only";

import sharp from "sharp";
import { roundedQrSvg } from "@/lib/qr-render";

/** Rasterize rounded QR SVG (transparent) for PDF/stamps — server only. */
export async function roundedQrPngBuffer(text: string, size = 512) {
  const svg = await roundedQrSvg(text, { size, quietModules: 1 });
  return sharp(Buffer.from(svg)).ensureAlpha().png().toBuffer();
}
