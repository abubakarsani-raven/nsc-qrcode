import "server-only";

import fs from "fs/promises";
import path from "path";
import sharp from "sharp";
import {
  FRONT_TEMPLATES,
  PAGE,
  type BackTemplateId,
  type FrontTemplateId,
} from "@/lib/id-card/slots.generated";
import { layoutName } from "@/lib/id-card/name-layout";
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

const NAME_COLOR = "#0d4720";
const TITLE_COLOR = "#1a3340";
const ID_COLOR = "#0d4720";
const HALO_COLOR = "#D3DCF1";
const HALO_PT = 3.5;

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

async function fontDataUri(file: string) {
  const bytes = await fs.readFile(
    path.join(process.cwd(), "public", "fonts", file),
  );
  return `data:font/ttf;base64,${bytes.toString("base64")}`;
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

/** Mirror of CardPreview's approximate ID tracking. */
function trackingPx(
  text: string,
  fontSizePx: number,
  maxWidthPx: number,
  avgGlyphEm: number,
) {
  let natural = 0;
  for (const ch of text) {
    natural += ch === " " ? fontSizePx * 0.28 : fontSizePx * avgGlyphEm;
  }
  if (text.length < 2 || natural >= maxWidthPx) return 0;
  return (maxWidthPx - natural) / (text.length - 1);
}

function escapeXml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Rasterize the front of a card using the same PNG template, slots, colours,
 * halo, and typography as `CardPreview` — so Download PDF matches the live
 * preview 1:1 instead of a separate pdf-lib stamping pipeline.
 */
export async function renderFrontCardPng(staff: CardRenderInput): Promise<Buffer> {
  const width = Math.round(PAGE.width * SCALE);
  const height = Math.round(PAGE.height * SCALE);
  const front = FRONT_TEMPLATES[staff.frontTemplate];
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
    const haloPx = HALO_PT * s;
    const cx = fx + fw / 2;
    const cy = fy + fh / 2;

    // Preview uses CSS box-shadow: 0 0 0 3.5pt #D3DCF1
    if (front.photoMask === "circle") {
      const r = fw / 2 + haloPx;
      const haloSvg = Buffer.from(
        `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
          <circle cx="${cx}" cy="${cy}" r="${r}" fill="${HALO_COLOR}"/>
        </svg>`,
      );
      layers.push({ input: await sharp(haloSvg).png().toBuffer(), left: 0, top: 0 });
    } else {
      const radius = ((front.photoRadiusPt ?? 6) + HALO_PT) * s;
      const haloSvg = Buffer.from(
        `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
          <rect x="${fx - haloPx}" y="${fy - haloPx}" width="${fw + haloPx * 2}" height="${fh + haloPx * 2}"
            rx="${radius}" ry="${radius}" fill="${HALO_COLOR}"/>
        </svg>`,
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

  const given = [staff.firstName, staff.middleName].filter(Boolean).join(" ");
  const name = layoutName(staff.lastName, given, staff.frontTemplate);
  const [regularUri, boldUri] = await Promise.all([
    fontDataUri("Poppins-Regular.ttf"),
    fontDataUri("Poppins-Bold.ttf"),
  ]);

  const nameTop = (front.nameLine1.y + 4) * s;
  const nameSize = name.fontSizePt * s;
  const nameLeading = name.leadingPt * s;
  const axisX = front.contentAxisX * s;
  // CSS top → SVG baseline (~0.8em into the line box, matching CardPreview)
  const nameBaseline1 = nameTop + nameSize * 0.8;
  const nameBaseline2 = nameTop + nameLeading + nameSize * 0.8;

  const waveNudge = staff.frontTemplate === "WAVE_BLUE" ? -3 : 0;
  const designation = staff.designation.toUpperCase();
  const desSize = 6 * s;
  const desTop = (front.designation.y + waveNudge) * s;
  const desBaseline = desTop + desSize * 0.8;

  const idLabel = `ID NO. ${staff.idNumber}`;
  const idSize = 6 * s;
  const idTop = (front.idNo.y + waveNudge) * s;
  const idBaseline = idTop + idSize * 0.8;
  const idTracking = trackingPx(idLabel, idSize, front.idNo.w * s, 0.58);

  // Keep the gap as its own tspan — librsvg collapses inter-element whitespace.
  const line1 = name.line1Given
    ? `<tspan font-family="PoppinsBold" font-weight="700">${escapeXml(name.surname)}</tspan><tspan font-family="Poppins" xml:space="preserve"> ${escapeXml(name.line1Given)}</tspan>`
    : `<tspan font-family="PoppinsBold" font-weight="700">${escapeXml(name.surname)}</tspan>`;

  const line2 = name.line2
    ? `<text x="${axisX}" y="${nameBaseline2}" text-anchor="middle" font-family="Poppins" font-size="${nameSize}" fill="${NAME_COLOR}">${escapeXml(name.line2)}</text>`
    : "";

  const textSvg = Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" xml:space="preserve">
  <defs>
    <style>
      @font-face { font-family: Poppins; src: url('${regularUri}'); }
      @font-face { font-family: PoppinsBold; src: url('${boldUri}'); }
    </style>
  </defs>
  <text x="${axisX}" y="${nameBaseline1}" text-anchor="middle" font-size="${nameSize}" fill="${NAME_COLOR}">${line1}</text>
  ${line2}
  <text x="${axisX}" y="${desBaseline}" text-anchor="middle" font-family="Poppins" font-size="${desSize}" fill="${TITLE_COLOR}">${escapeXml(designation)}</text>
  <text x="${axisX}" y="${idBaseline}" text-anchor="middle" font-family="PoppinsBold" font-weight="700" font-size="${idSize}" fill="${ID_COLOR}"${idTracking > 0 ? ` letter-spacing="${idTracking}"` : ""}>${escapeXml(idLabel)}</text>
</svg>`);

  layers.push({
    input: await sharp(textSvg).png().toBuffer(),
    left: 0,
    top: 0,
  });

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

  return sharp(base).composite(layers).png().toBuffer();
}

/** Back side is the same static PNG the live preview shows. */
export async function renderBackCardPng(staff: CardRenderInput): Promise<Buffer> {
  const width = Math.round(PAGE.width * SCALE);
  const height = Math.round(PAGE.height * SCALE);
  return sharp(await fs.readFile(templatePath("backs", staff.backTemplate)))
    .resize(width, height, { fit: "fill", kernel: sharp.kernel.lanczos3 })
    .png()
    .toBuffer();
}
