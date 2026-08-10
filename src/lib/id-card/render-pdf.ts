import fs from "fs/promises";
import path from "path";
import {
  PDFDocument,
  rgb,
  degrees,
  type PDFPage,
  type PDFImage,
  type PDFFont,
  type RGB,
} from "pdf-lib";
import {
  FRONT_TEMPLATES,
  PAGE,
  type BackTemplateId,
  type FrontTemplateId,
  type Rect,
} from "@/lib/id-card/slots.generated";
import { layoutName } from "@/lib/id-card/name-layout";
import { embedCardFonts } from "@/lib/id-card/fonts";
import { publicVerifyUrl, assertUrlBudget } from "@/lib/qr";
import { roundedQrPngBuffer } from "@/lib/qr-render-png";
import {
  maskPhotoToFrame,
  printCutBuffer,
  readPhotoFile,
  type CropParams,
  type FrameMask,
} from "@/lib/photo/pipeline";

export type StaffCardInput = {
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

function topLeftToPdf(rect: Rect, pageHeight = PAGE.height) {
  // pdf-lib origin is bottom-left
  return {
    x: rect.x,
    y: pageHeight - rect.y - rect.h,
    width: rect.w,
    height: rect.h,
  };
}

async function loadTemplatePage(kind: "fronts" | "backs", id: string) {
  const file = path.join(
    process.cwd(),
    "design",
    "templates",
    kind,
    `${id}.pdf`,
  );
  const bytes = await fs.readFile(file);
  const src = await PDFDocument.load(bytes);
  return src;
}

async function drawRoundedQr(
  pdf: PDFDocument,
  page: PDFPage,
  moduleBox: Rect,
  _quietModules: number,
  url: string,
) {
  assertUrlBudget(url);
  // Sample QR has no white plate — transparent PNG over card art.
  const modulePt = moduleBox.w / 33;
  const pad = 1 * modulePt;
  const outer: Rect = {
    x: moduleBox.x - pad,
    y: moduleBox.y - pad,
    w: moduleBox.w + pad * 2,
    h: moduleBox.h + pad * 2,
  };
  const box = topLeftToPdf(outer);
  const png = await roundedQrPngBuffer(url, 512);
  const img = await pdf.embedPng(png);
  page.drawImage(img, {
    x: box.x,
    y: box.y,
    width: box.width,
    height: box.height,
  });
}

function drawMixedNameLine(
  page: PDFPage,
  surname: string,
  givenPart: string,
  rect: Rect,
  bold: PDFFont,
  regular: PDFFont,
  size: number,
  color: RGB,
  axisX?: number,
) {
  const gap = givenPart ? bold.widthOfTextAtSize(" ", size) : 0;
  const tw =
    bold.widthOfTextAtSize(surname, size) +
    gap +
    (givenPart ? regular.widthOfTextAtSize(givenPart, size) : 0);
  const cx = axisX ?? rect.x + rect.w / 2;
  let x = cx - tw / 2;
  const y = baselineFromTop(rect, size);
  page.drawText(surname, { x, y, size, font: bold, color });
  x += bold.widthOfTextAtSize(surname, size);
  if (givenPart) {
    page.drawText(` ${givenPart}`, { x, y, size, font: regular, color });
  }
}

async function embedPhoto(
  pdf: PDFDocument,
  staff: StaffCardInput,
  frame: FrameMask,
): Promise<PDFImage | null> {
  try {
    let source: Buffer | null = null;
    if (staff.photoOriginalKey && staff.photoCrop) {
      const crop = JSON.parse(staff.photoCrop) as CropParams;
      source = await printCutBuffer(staff.id, staff.photoOriginalKey, crop);
    } else if (staff.photoPreviewKey) {
      source = await readPhotoFile(staff.id, staff.photoPreviewKey);
    }
    if (!source) return null;

    // Masked to the frame shape, so the printed card matches the preview
    // instead of showing a bare rectangle. PNG carries the alpha channel.
    const masked = await maskPhotoToFrame(source, frame);
    return pdf.embedPng(masked);
  } catch (err) {
    // A missing photo must not abort the whole card, but silently dropping it
    // is how a blank portrait ships to print unnoticed — leave a trail.
    console.error(`[render-pdf] photo embed failed for staff ${staff.id}:`, err);
    return null;
  }
  return null;
}

/** Sample text bboxes are loose; treat rect.y as the CSS top of the glyph box. */
function baselineFromTop(rect: Rect, size: number, pageHeight = PAGE.height) {
  return pageHeight - rect.y - size * 0.82;
}

function fitCharacterSpacing(
  text: string,
  font: PDFFont,
  size: number,
  targetWidth: number,
) {
  if (text.length < 2) return 0;
  const natural = font.widthOfTextAtSize(text, size);
  // Sample ID/title use open tracking; never compress below natural.
  if (natural >= targetWidth) return 0;
  return (targetWidth - natural) / (text.length - 1);
}

function drawCenteredText(
  page: PDFPage,
  text: string,
  rect: Rect,
  font: PDFFont,
  size: number,
  color = rgb(0.05, 0.25, 0.12),
  axisX?: number,
  opts?: { characterSpacing?: number; topAlign?: boolean },
) {
  const spacing = opts?.characterSpacing ?? 0;
  const natural = font.widthOfTextAtSize(text, size);
  const tw = natural + spacing * Math.max(0, text.length - 1);
  const cx = axisX ?? rect.x + rect.w / 2;
  const x = cx - tw / 2;
  const y = opts?.topAlign
    ? baselineFromTop(rect, size)
    : topLeftToPdf(rect).y + (rect.h - size) / 2;
  // pdf-lib typings omit characterSpacing; PDF supports /Tc via this option.
  page.drawText(text, {
    x,
    y,
    size,
    font,
    color,
    ...(spacing ? { characterSpacing: spacing } : {}),
  } as Parameters<PDFPage["drawText"]>[1]);
}

export async function renderStaffCardPdf(staff: StaffCardInput) {
  const out = await PDFDocument.create();
  const { regular: poppins, bold: poppinsBold } = await embedCardFonts(out);

  // FRONT
  const frontSrc = await loadTemplatePage("fronts", staff.frontTemplate);
  const [frontPage] = await out.copyPages(frontSrc, [0]);
  out.addPage(frontPage);
  const frontSlots = FRONT_TEMPLATES[staff.frontTemplate];
  const nameColor = rgb(0.05, 0.28, 0.12);
  const titleColor = rgb(0.15, 0.2, 0.25);
  const idColor = rgb(0.05, 0.2, 0.15);

  const photoFrame: FrameMask = {
    widthPt: frontSlots.photoFrame.w,
    heightPt: frontSlots.photoFrame.h,
    mask: frontSlots.photoMask,
    radiusPt: frontSlots.photoRadiusPt,
  };
  const photo = await embedPhoto(out, staff, photoFrame);
  if (photo) {
    // Draw into the visible frame (true circle / rounded square), not the
    // taller 4:5 image box. The template PDF already paints the #D3DCF1 halo
    // and white photo hole — do not redraw a filled circle/rect here.
    // pdf-lib's drawCircle `size` is a radius; a previous "diameter" value
    // covered the crest and geometric background while leaving only the
    // bottom waves visible, which is exactly the preview-vs-PDF mismatch.
    const box = topLeftToPdf(frontSlots.photoFrame);
    frontPage.drawImage(photo, {
      x: box.x,
      y: box.y,
      width: box.width,
      height: box.height,
    });
  }

  const given = [staff.firstName, staff.middleName].filter(Boolean).join(" ");
  const name = layoutName(staff.lastName, given, staff.frontTemplate);
  const axis = frontSlots.contentAxisX;

  // All card text uses Poppins (surname bold / given regular)
  // Add 4pt spacing below photo
  const nameLineWithSpacing = { ...frontSlots.nameLine1, y: frontSlots.nameLine1.y + 4 };
  drawMixedNameLine(
    frontPage,
    name.surname,
    name.line1Given,
    nameLineWithSpacing,
    poppinsBold,
    poppins,
    name.fontSizePt,
    nameColor,
    axis,
  );
  if (name.line2) {
    // Place line 2 by leading from line 1 (sample PDF line boxes overlap)
    const line2Rect = {
      ...frontSlots.nameLine2,
      y: frontSlots.nameLine1.y + 4 + name.leadingPt,
      h: name.fontSizePt + 2,
    };
    drawCenteredText(
      frontPage,
      name.line2,
      line2Rect,
      poppins,
      name.fontSizePt,
      nameColor,
      axis,
      { topAlign: true },
    );
  }

  const designation = staff.designation.toUpperCase();
  // Designation uses normal tracking (no Canva letter-spacing)
  // WAVE_BLUE wave is positioned higher, so move designation up slightly
  const designationSlot =
    staff.frontTemplate === "WAVE_BLUE"
      ? { ...frontSlots.designation, y: frontSlots.designation.y - 3 }
      : frontSlots.designation;
  drawCenteredText(
    frontPage,
    designation,
    designationSlot,
    poppins,
    6,
    titleColor,
    axis,
    { topAlign: true },
  );
  const idLabel = `ID NO. ${staff.idNumber}`;
  // WAVE_BLUE also needs ID moved up to match designation adjustment
  const idSlot =
    staff.frontTemplate === "WAVE_BLUE"
      ? { ...frontSlots.idNo, y: frontSlots.idNo.y - 3 }
      : frontSlots.idNo;
  drawCenteredText(
    frontPage,
    idLabel,
    idSlot,
    poppinsBold,
    6,
    idColor,
    axis,
    {
      topAlign: true,
      characterSpacing: fitCharacterSpacing(
        idLabel,
        poppinsBold,
        6,
        frontSlots.idNo.w,
      ),
    },
  );

  const url = publicVerifyUrl(staff.qrToken);
  await drawRoundedQr(
    out,
    frontPage,
    frontSlots.qr.moduleBox,
    frontSlots.qr.quietModules,
    url,
  );

  // BACK — fully static artwork from the source PDF, nothing drawn on top.
  const backSrc = await loadTemplatePage("backs", staff.backTemplate);
  const [backPage] = await out.copyPages(backSrc, [0]);
  out.addPage(backPage);

  return out.save();
}

export async function renderBatchPdf(staffList: StaffCardInput[]) {
  const out = await PDFDocument.create();
  for (const staff of staffList) {
    const bytes = await renderStaffCardPdf(staff);
    const doc = await PDFDocument.load(bytes);
    const pages = await out.copyPages(doc, doc.getPageIndices());
    pages.forEach((p) => out.addPage(p));
  }
  return out.save();
}

/** Simple n-up imposition on A4 with gutters and crop marks */
export async function renderImposedSheet(
  staffList: StaffCardInput[],
  paper: "A4" | "A3" = "A4",
) {
  const paperSize = paper === "A3" ? { w: 841.89, h: 1190.55 } : { w: 595.28, h: 841.89 };
  const gutter = 8.5; // ~3 mm
  const cardW = PAGE.width;
  const cardH = PAGE.height;
  const cols = Math.max(1, Math.floor((paperSize.w - gutter) / (cardW + gutter)));
  const rows = Math.max(1, Math.floor((paperSize.h - gutter) / (cardH + gutter)));
  const perSheet = cols * rows;

  const out = await PDFDocument.create();
  let index = 0;
  while (index < staffList.length) {
    // Front sheet
    const sheet = out.addPage([paperSize.w, paperSize.h]);
    const chunk = staffList.slice(index, index + perSheet);
    for (let i = 0; i < chunk.length; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = gutter + col * (cardW + gutter);
      const y = paperSize.h - gutter - (row + 1) * cardH - row * gutter;
      const cardBytes = await renderStaffCardPdf(chunk[i]);
      const cardDoc = await PDFDocument.load(cardBytes);
      const [embedded] = await out.embedPages([cardDoc.getPage(0)]);
      sheet.drawPage(embedded, { x, y, width: cardW, height: cardH });
      // crop marks
      const mark = 6;
      sheet.drawLine({
        start: { x: x - 2, y },
        end: { x: x - 2 - mark, y },
        thickness: 0.3,
        color: rgb(0, 0, 0),
      });
      sheet.drawLine({
        start: { x, y: y - 2 },
        end: { x, y: y - 2 - mark },
        thickness: 0.3,
        color: rgb(0, 0, 0),
      });
    }
    // Back sheet (mirrored column order for duplex)
    const backSheet = out.addPage([paperSize.w, paperSize.h]);
    for (let i = 0; i < chunk.length; i++) {
      const col = cols - 1 - (i % cols);
      const row = Math.floor(i / cols);
      const x = gutter + col * (cardW + gutter);
      const y = paperSize.h - gutter - (row + 1) * cardH - row * gutter;
      const cardBytes = await renderStaffCardPdf(chunk[i]);
      const cardDoc = await PDFDocument.load(cardBytes);
      const [embedded] = await out.embedPages([cardDoc.getPage(1)]);
      backSheet.drawPage(embedded, {
        x,
        y,
        width: cardW,
        height: cardH,
        rotate: degrees(0),
      });
    }
    index += perSheet;
  }
  return out.save();
}
