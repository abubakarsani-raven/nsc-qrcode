import "server-only";

import fs from "fs/promises";
import path from "path";
import sharp from "sharp";
import {
  BACK_TEMPLATES,
  FRONT_TEMPLATES,
  type BackTemplateId,
  type FrontTemplateId,
} from "@/lib/id-card/slots.generated";
import { publicVerifyUrl, assertUrlBudget } from "@/lib/qr";
import { roundedQrPngBuffer } from "@/lib/qr-render-png";
import {
  maskPhotoToFrame,
  printCutBuffer,
  readPhotoFile,
  type CropParams,
  type FrameMask,
} from "@/lib/photo/pipeline";

/** Same shape as `StaffCardInput` in render-pdf — kept local to avoid cycles. */
export type CardRenderInput = {
  id: string;
  idNumber: string;
  firstName: string;
  middleName?: string | null;
  lastName: string;
  designation: string;
  qrToken: string;
  frontTemplate: FrontTemplateId;
  backTemplate: BackTemplateId;
  photoOriginalKey?: string | null;
  photoCrop?: string | null;
  photoPreviewKey?: string | null;
};

/** Print density — same slot math as the live preview, just higher DPI. */
const DPI = 600;
const SCALE = DPI / 72;

function templatePath(kind: "fronts" | "backs", id: string) {
  return path.join(
    process.cwd(),
    "public",
    "id-card",
    "templates",
    kind,
    `${id}.png`,
  );
}

async function loadPhoto(staff: CardRenderInput): Promise<Buffer | null> {
  try {
    if (staff.photoOriginalKey && staff.photoCrop) {
      const crop = JSON.parse(staff.photoCrop) as CropParams;
      return printCutBuffer(staff.id, staff.photoOriginalKey, crop);
    }
    if (staff.photoPreviewKey) {
      return readPhotoFile(staff.id, staff.photoPreviewKey);
    }
  } catch (err) {
    console.error(
      `[render-preview-image] photo load failed for staff ${staff.id}:`,
      err,
    );
  }
  return null;
}

/**
 * Rasterize the card front artwork the live preview uses (PNG template + photo
 * + halo + QR). Dynamic text is NOT drawn here: Vercel’s sharp/librsvg build
 * often ignores `@font-face` data-URIs, which produced □ tofu for name / ID /
 * designation. Text is stamped with embedded fonts via pdf-lib instead.
 */
export async function renderFrontCardPng(staff: CardRenderInput): Promise<Buffer> {
  const front = FRONT_TEMPLATES[staff.frontTemplate];
  const width = Math.round(front.page.width * SCALE);
  const height = Math.round(front.page.height * SCALE);
  const s = SCALE;

  const base = await sharp(await fs.readFile(templatePath("fronts", staff.frontTemplate)))
    .resize(width, height, { fit: "fill", kernel: sharp.kernel.lanczos3 })
    .ensureAlpha()
    .png()
    .toBuffer();

  const layers: { input: Buffer; left: number; top: number }[] = [];

  const photoSource = await loadPhoto(staff);
  if (photoSource) {
    const frame = front.photoFrame;
    const fx = Math.round(frame.x * s);
    const fy = Math.round(frame.y * s);
    const fw = Math.max(1, Math.round(frame.w * s));
    const fh = Math.max(1, Math.round(frame.h * s));

    if (front.halo?.position === "outside") {
      const haloPx = front.halo.pt * s;
      const shape =
        front.photoMask === "circle"
          ? `<circle cx="${fx + fw / 2}" cy="${fy + fh / 2}" r="${fw / 2 + haloPx}" fill="${front.halo.color}"/>`
          : `<rect x="${fx - haloPx}" y="${fy - haloPx}" width="${fw + haloPx * 2}" height="${fh + haloPx * 2}"
              rx="${((front.photoRadiusPt ?? 6) + front.halo.pt) * s}" fill="${front.halo.color}"/>`;
      const haloSvg = Buffer.from(
        `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${shape}</svg>`,
      );
      layers.push({ input: await sharp(haloSvg).png().toBuffer(), left: 0, top: 0 });
    }

    const frameMask: FrameMask = {
      widthPt: frame.w,
      heightPt: frame.h,
      mask: front.photoMask,
      radiusPt: front.photoRadiusPt,
    };
    const masked = await maskPhotoToFrame(photoSource, frameMask);
    const photo = await sharp(masked)
      .resize(fw, fh, { fit: "fill", kernel: sharp.kernel.lanczos3 })
      .png()
      .toBuffer();
    layers.push({ input: photo, left: fx, top: fy });
  }

  if (front.halo?.position === "inside") {
    const frame = front.photoFrame;
    const ringPx = front.halo.pt * s;
    const r = (frame.w / 2) * s;
    const shape =
      front.photoMask === "circle"
        ? `<circle cx="${(frame.x + frame.w / 2) * s}" cy="${(frame.y + frame.h / 2) * s}" r="${r - ringPx / 2}"
            fill="none" stroke="${front.halo.color}" stroke-width="${ringPx}"/>`
        : `<rect x="${frame.x * s + ringPx / 2}" y="${frame.y * s + ringPx / 2}" width="${frame.w * s - ringPx}"
            height="${frame.h * s - ringPx}" rx="${Math.max(0, (front.photoRadiusPt ?? 6) * s - ringPx / 2)}"
            fill="none" stroke="${front.halo.color}" stroke-width="${ringPx}"/>`;
    const ringSvg = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${shape}</svg>`,
    );
    layers.push({ input: await sharp(ringSvg).png().toBuffer(), left: 0, top: 0 });
  }

  if (front.qr) {
    const url = publicVerifyUrl(staff.qrToken);
    assertUrlBudget(url);
    const moduleBox = front.qr.moduleBox;
    const modulePt = moduleBox.w / 33;
    const qrPad = 1 * modulePt;
    const qrX = Math.round((moduleBox.x - qrPad) * s);
    const qrY = Math.round((moduleBox.y - qrPad) * s);
    const qrW = Math.max(1, Math.round((moduleBox.w + qrPad * 2) * s));
    const qrPng = await roundedQrPngBuffer(url, Math.max(qrW, 256));
    const qr = await sharp(qrPng)
      .resize(qrW, qrW, { fit: "fill", kernel: sharp.kernel.nearest })
      .png()
      .toBuffer();
    layers.push({ input: qr, left: qrX, top: qrY });
  }

  return sharp(base).composite(layers).png().toBuffer();
}

/** Back template art; any per-staff barcode is drawn as vectors by the PDF. */
export async function renderBackCardPng(staff: CardRenderInput): Promise<Buffer> {
  const back = BACK_TEMPLATES[staff.backTemplate];
  const width = Math.round(back.page.width * SCALE);
  const height = Math.round(back.page.height * SCALE);
  return sharp(await fs.readFile(templatePath("backs", staff.backTemplate)))
    .resize(width, height, { fit: "fill", kernel: sharp.kernel.lanczos3 })
    .png()
    .toBuffer();
}
