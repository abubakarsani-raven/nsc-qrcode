import {
  PDFDocument,
  rgb,
  degrees,
} from "pdf-lib";
import {
  PAGE,
  type BackTemplateId,
  type FrontTemplateId,
} from "@/lib/id-card/slots.generated";
import {
  renderBackCardPng,
  renderFrontCardPng,
} from "@/lib/id-card/render-preview-image";

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

/**
 * Build a print PDF by rasterizing the same composition as the live
 * `CardPreview` (PNG template + photo + text + QR) at 600 dpi, then placing
 * each side on a card-sized page. No separate pdf-lib stamping path — preview
 * and Download PDF share one visual pipeline.
 */
export async function renderStaffCardPdf(staff: StaffCardInput) {
  const out = await PDFDocument.create();

  const frontPng = await renderFrontCardPng(staff);
  const frontImg = await out.embedPng(frontPng);
  const frontPage = out.addPage([PAGE.width, PAGE.height]);
  frontPage.drawImage(frontImg, {
    x: 0,
    y: 0,
    width: PAGE.width,
    height: PAGE.height,
  });

  const backPng = await renderBackCardPng(staff);
  const backImg = await out.embedPng(backPng);
  const backPage = out.addPage([PAGE.width, PAGE.height]);
  backPage.drawImage(backImg, {
    x: 0,
    y: 0,
    width: PAGE.width,
    height: PAGE.height,
  });

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
  const paperSize =
    paper === "A3" ? { w: 841.89, h: 1190.55 } : { w: 595.28, h: 841.89 };
  const gutter = 8.5; // ~3 mm
  const cardW = PAGE.width;
  const cardH = PAGE.height;
  const cols = Math.max(1, Math.floor((paperSize.w - gutter) / (cardW + gutter)));
  const rows = Math.max(1, Math.floor((paperSize.h - gutter) / (cardH + gutter)));
  const perSheet = cols * rows;

  const out = await PDFDocument.create();
  let index = 0;
  while (index < staffList.length) {
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
