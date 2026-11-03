import {
  PDFDocument,
  rgb,
  setCharacterSpacing,
  type PDFPage,
} from "pdf-lib";
import {
  BACK_TEMPLATES,
  FRONT_TEMPLATES,
  type BackTemplateId,
  type FrontTemplateId,
} from "@/lib/id-card/slots.generated";
import { layoutFront } from "@/lib/id-card/card-layout";
import { cardFontEmbedder } from "@/lib/id-card/fonts";
import {
  renderBackCardPng,
  renderFrontCardPng,
} from "@/lib/id-card/render-preview-image";
import { parseTextSettings } from "@/lib/id-card/type-scale";
import { code128Rects } from "@/lib/barcode/code128";

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
  /** JSON type settings override; defaults when absent. */
  cardTypeScale?: string | null;
};

function hexRgb(hex: string) {
  const h = hex.replace("#", "");
  return rgb(
    parseInt(h.slice(0, 2), 16) / 255,
    parseInt(h.slice(2, 4), 16) / 255,
    parseInt(h.slice(4, 6), 16) / 255,
  );
}

/** Stamp name / designation / ID / rule from the shared layout as vector text. */
async function drawFrontText(
  page: PDFPage,
  staff: StaffCardInput,
  fontFor: ReturnType<typeof cardFontEmbedder>,
) {
  const layout = layoutFront({
    frontTemplate: staff.frontTemplate,
    firstName: staff.firstName,
    middleName: staff.middleName,
    lastName: staff.lastName,
    designation: staff.designation,
    idNumber: staff.idNumber,
    text: parseTextSettings(staff.cardTypeScale),
  });
  const pageHeight = layout.template.page.height;

  for (const run of layout.runs) {
    const font = await fontFor(run.font);
    // `drawText` has no tracking option — set Tc on the page state around it.
    if (run.trackingPt) page.pushOperators(setCharacterSpacing(run.trackingPt));
    page.drawText(run.text, {
      x: run.x,
      y: pageHeight - run.baseline,
      size: run.sizePt,
      font,
      color: hexRgb(run.color),
    });
    if (run.trackingPt) page.pushOperators(setCharacterSpacing(0));
  }

  const { rule } = layout;
  page.drawRectangle({
    x: rule.x,
    y: pageHeight - rule.y - rule.h,
    width: rule.w,
    height: rule.h,
    color: hexRgb(rule.color),
    borderWidth: 0,
  });
}

function drawBackBarcode(page: PDFPage, staff: StaffCardInput) {
  const back = BACK_TEMPLATES[staff.backTemplate];
  if (!back.barcode || !staff.idNumber.trim()) return;
  const color = hexRgb(back.barcode.color);
  for (const bar of code128Rects(staff.idNumber.trim(), back.barcode.rect, back.barcode)) {
    page.drawRectangle({
      x: bar.x,
      y: back.page.height - bar.y - bar.h,
      width: bar.w,
      height: bar.h,
      color,
      borderWidth: 0,
    });
  }
}

/**
 * Print PDF = preview artwork (PNG template + photo + QR) + vector text and
 * barcode. Text is not rasterized through sharp: Vercel’s librsvg often drops
 * custom fonts and replaces glyphs with □ squares.
 */
export async function renderStaffCardPdf(staff: StaffCardInput) {
  const out = await PDFDocument.create();
  const fontFor = cardFontEmbedder(out);
  const front = FRONT_TEMPLATES[staff.frontTemplate];
  const back = BACK_TEMPLATES[staff.backTemplate];

  const frontImg = await out.embedPng(await renderFrontCardPng(staff));
  const frontPage = out.addPage([front.page.width, front.page.height]);
  frontPage.drawImage(frontImg, {
    x: 0,
    y: 0,
    width: front.page.width,
    height: front.page.height,
  });
  await drawFrontText(frontPage, staff, fontFor);

  const backImg = await out.embedPng(await renderBackCardPng(staff));
  const backPage = out.addPage([back.page.width, back.page.height]);
  backPage.drawImage(backImg, {
    x: 0,
    y: 0,
    width: back.page.width,
    height: back.page.height,
  });
  drawBackBarcode(backPage, staff);

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

function drawCropMarks(sheet: PDFPage, x: number, y: number, w: number, h: number) {
  const mark = 6;
  const gap = 2;
  const black = rgb(0, 0, 0);
  const corners: Array<[number, number, number, number]> = [
    [x, y, -1, -1],
    [x + w, y, 1, -1],
    [x, y + h, -1, 1],
    [x + w, y + h, 1, 1],
  ];
  for (const [cx, cy, dx, dy] of corners) {
    sheet.drawLine({
      start: { x: cx + dx * gap, y: cy },
      end: { x: cx + dx * (gap + mark), y: cy },
      thickness: 0.3,
      color: black,
    });
    sheet.drawLine({
      start: { x: cx, y: cy + dy * gap },
      end: { x: cx, y: cy + dy * (gap + mark) },
      thickness: 0.3,
      color: black,
    });
  }
}

/**
 * N-up imposition with gutters and crop marks. The grid cell fits the largest
 * card in the batch (CR80 when any NPERA card is present); each card sits
 * centred in its cell at its own size, and backs mirror the column order so
 * duplex sheets line up.
 */
export async function renderImposedSheet(
  staffList: StaffCardInput[],
  paper: "A4" | "A3" = "A4",
) {
  const paperSize =
    paper === "A3" ? { w: 841.89, h: 1190.55 } : { w: 595.28, h: 841.89 };
  const gutter = 8.5; // ~3 mm
  const cellW = Math.max(
    ...staffList.map((s) => FRONT_TEMPLATES[s.frontTemplate].page.width),
  );
  const cellH = Math.max(
    ...staffList.map((s) => FRONT_TEMPLATES[s.frontTemplate].page.height),
  );
  const cols = Math.max(1, Math.floor((paperSize.w - gutter) / (cellW + gutter)));
  const rows = Math.max(1, Math.floor((paperSize.h - gutter) / (cellH + gutter)));
  const perSheet = cols * rows;

  const out = await PDFDocument.create();
  let index = 0;
  while (index < staffList.length) {
    const chunk = staffList.slice(index, index + perSheet);
    const cards = await Promise.all(
      chunk.map(async (staff) => PDFDocument.load(await renderStaffCardPdf(staff))),
    );

    for (const side of [0, 1] as const) {
      const sheet = out.addPage([paperSize.w, paperSize.h]);
      for (let i = 0; i < chunk.length; i++) {
        const card = cards[i].getPage(side);
        const { width: w, height: h } = card.getSize();
        const col = side === 0 ? i % cols : cols - 1 - (i % cols);
        const row = Math.floor(i / cols);
        const cellX = gutter + col * (cellW + gutter);
        const cellY = paperSize.h - gutter - (row + 1) * cellH - row * gutter;
        const x = cellX + (cellW - w) / 2;
        const y = cellY + (cellH - h) / 2;
        const [embedded] = await out.embedPages([card]);
        sheet.drawPage(embedded, { x, y, width: w, height: h });
        drawCropMarks(sheet, x, y, w, h);
      }
    }
    index += perSheet;
  }
  return out.save();
}
