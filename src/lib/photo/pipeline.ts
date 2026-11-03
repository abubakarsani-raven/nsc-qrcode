import sharp from "sharp";
import {
  PHOTO_DPI_FLOOR,
  PHOTO_MASTER,
  PHOTO_SLOT_INCHES,
} from "@/lib/id-card/slots.generated";
import { cropOverhang } from "@/lib/photo/card-crop";
import { getPhoto, putPhoto } from "@/lib/photo/storage";

export type CropParams = {
  x: number;
  y: number;
  width: number;
  height: number;
  zoom?: number;
  rotation?: number;
};

export function minSourcePixels() {
  return {
    width: Math.ceil(PHOTO_SLOT_INCHES.width * PHOTO_DPI_FLOOR),
    height: Math.ceil(PHOTO_SLOT_INCHES.height * PHOTO_DPI_FLOOR),
  };
}

export function effectiveDpi(cropPxW: number, cropPxH: number) {
  const dpiW = cropPxW / PHOTO_SLOT_INCHES.width;
  const dpiH = cropPxH / PHOTO_SLOT_INCHES.height;
  return Math.min(dpiW, dpiH);
}

export async function saveOriginal(
  staffId: string,
  buffer: Buffer,
  mime: string,
) {
  const ext =
    mime.includes("png") ? ".png" : mime.includes("webp") ? ".webp" : ".jpg";
  const key = `original${ext}`;
  await putPhoto(staffId, key, buffer);
  return key;
}

/**
 * Shared crop/rotate stage — the source is always bytes, never a path.
 * Where the crop runs past the photo (see CROP_OVERHANG) the edge pixels are
 * repeated outward, which the on-card preview draws the same way.
 */
async function cropped(source: Buffer, crop: CropParams, sharpen: boolean) {
  const width = Math.max(1, Math.round(crop.width));
  const height = Math.max(1, Math.round(crop.height));
  const over = cropOverhang({ width, height, rotation: crop.rotation });
  const { data, info } = await sharp(source)
    .rotate(crop.rotation ?? 0)
    .raw()
    .toBuffer({ resolveWithObject: true });
  const raw = { width: info.width, height: info.height, channels: info.channels };

  const clamp = (start: number, size: number, extent: number, overhang: number) =>
    Math.min(extent - size + overhang, Math.max(-overhang, Math.round(start)));
  const left = clamp(crop.x, width, info.width, over.w);
  const top = clamp(crop.y, height, info.height, over.h);
  const pad = {
    left: Math.max(0, -left),
    top: Math.max(0, -top),
    right: Math.max(0, left + width - info.width),
    bottom: Math.max(0, top + height - info.height),
  };

  let base = sharp(data, { raw });
  if (pad.left || pad.top || pad.right || pad.bottom) {
    const padded = await base.extend({ ...pad, extendWith: "copy" }).raw().toBuffer();
    base = sharp(padded, {
      raw: { ...raw, width: raw.width + pad.left + pad.right, height: raw.height + pad.top + pad.bottom },
    });
  }
  const pipeline = base.extract({ left: left + pad.left, top: top + pad.top, width, height });
  return sharpen ? pipeline.sharpen() : pipeline;
}

export async function writePreviewFromCrop(
  staffId: string,
  originalKey: string,
  crop: CropParams,
  sharpen = false,
) {
  const source = await getPhoto(staffId, originalKey);
  const preview = await (await cropped(source, crop, sharpen))
    .resize(PHOTO_MASTER.width, PHOTO_MASTER.height, {
      fit: "fill",
      kernel: sharp.kernel.lanczos3,
    })
    .jpeg({ quality: 92 })
    .toBuffer();

  const key = "preview.jpg";
  await putPhoto(staffId, key, preview);
  return key;
}

/** Re-cut for print at native slot density × 2 (≈600 dpi equivalent) */
export async function printCutBuffer(
  staffId: string,
  originalKey: string,
  crop: CropParams,
  sharpen = false,
) {
  const source = await getPhoto(staffId, originalKey);
  const targetW = Math.round(PHOTO_SLOT_INCHES.width * 600);
  const targetH = Math.round(PHOTO_SLOT_INCHES.height * 600);

  return (await cropped(source, crop, sharpen))
    .resize(targetW, targetH, { fit: "fill", kernel: sharp.kernel.lanczos3 })
    .jpeg({ quality: 95 })
    .toBuffer();
}

export async function readPhotoFile(staffId: string, key: string) {
  return getPhoto(staffId, key);
}

export type FrameMask = {
  widthPt: number;
  heightPt: number;
  mask: "circle" | "roundedSquare";
  radiusPt?: number;
};

/**
 * Cut a photo to the card's visible frame and punch the frame's shape into the
 * alpha channel, returning a PNG.
 *
 * The on-screen preview gets its shape for free from CSS — `border-radius: 50%`
 * plus `object-fit: cover` on a square box. A PDF has neither: `drawImage`
 * paints the full rectangle, so an unmasked photo printed as a hard-edged
 * rectangle sitting inside the halo, and a 4:5 image forced into a square frame
 * came out stretched. Masking here is what makes print match preview.
 *
 * `fit: "cover"` with centre gravity mirrors `object-cover`'s default, so the
 * same region of the photo survives in both renderings.
 */
export async function maskPhotoToFrame(
  source: Buffer,
  frame: FrameMask,
): Promise<Buffer> {
  const dpi = 600;
  const w = Math.max(1, Math.round((frame.widthPt / 72) * dpi));
  const h = Math.max(1, Math.round((frame.heightPt / 72) * dpi));

  const base = await sharp(source)
    .resize(w, h, {
      fit: "cover",
      position: "centre",
      kernel: sharp.kernel.lanczos3,
    })
    .ensureAlpha()
    .png()
    .toBuffer();

  const shape =
    frame.mask === "circle"
      ? `<ellipse cx="${w / 2}" cy="${h / 2}" rx="${w / 2}" ry="${h / 2}" fill="#fff"/>`
      : `<rect x="0" y="0" width="${w}" height="${h}" rx="${
          ((frame.radiusPt ?? 6) / 72) * dpi
        }" ry="${((frame.radiusPt ?? 6) / 72) * dpi}" fill="#fff"/>`;

  const maskSvg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${shape}</svg>`,
  );

  // dest-in keeps the photo only where the mask is opaque.
  return sharp(base)
    .composite([{ input: maskSvg, blend: "dest-in" }])
    .png()
    .toBuffer();
}
