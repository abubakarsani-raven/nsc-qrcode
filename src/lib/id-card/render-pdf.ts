import {
  PDFDocument,
  rgb,
  degrees,
  type PDFPage,
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

const NAME_COLOR = rgb(0x0d / 255, 0x47 / 255, 0x20 / 255);
const TITLE_COLOR = rgb(0x1a / 255, 0x33 / 255, 0x40 / 255);
const ID_COLOR = rgb(0x0d / 255, 0x47 / 255, 0x20 / 255);

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
  if (natural >= targetWidth) return 0;
  return (targetWidth - natural) / (text.length - 1);
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

function drawCenteredText(
  page: PDFPage,
  text: string,
  rect: Rect,
  font: PDFFont,
  size: number,
  color: RGB,
  axisX?: number,
  opts?: { characterSpacing?: number },
) {
  const spacing = opts?.characterSpacing ?? 0;
  const natural = font.widthOfTextAtSize(text, size);
  const tw = natural + spacing * Math.max(0, text.length - 1);
  const cx = axisX ?? rect.x + rect.w / 2;
  const x = cx - tw / 2;
  const y = baselineFromTop(rect, size);
  page.drawText(text, {
    x,
    y,
    size,
    font,
    color,
    ...(spacing ? { characterSpacing: spacing } : {}),
  } as Parameters<PDFPage["drawText"]>[1]);
}

/** Stamp name / designation / ID with embedded Poppins (works on Vercel). */
function drawFrontText(
  page: PDFPage,
  staff: StaffCardInput,
  regular: PDFFont,
  bold: PDFFont,
) {
  const front = FRONT_TEMPLATES[staff.frontTemplate];
  const given = [staff.firstName, staff.middleName].filter(Boolean).join(" ");
  const name = layoutName(staff.lastName, given, staff.frontTemplate);
  const axis = front.contentAxisX;

  const nameLine = { ...front.nameLine1, y: front.nameLine1.y + 4 };
  drawMixedNameLine(
    page,
    name.surname,
    name.line1Given,
    nameLine,
    bold,
    regular,
    name.fontSizePt,
    NAME_COLOR,
    axis,
  );
  if (name.line2) {
    const line2Rect = {
      ...front.nameLine2,
      y: front.nameLine1.y + 4 + name.leadingPt,
      h: name.fontSizePt + 2,
    };
    drawCenteredText(
      page,
      name.line2,
      line2Rect,
      regular,
      name.fontSizePt,
      NAME_COLOR,
      axis,
    );
  }

  const waveNudge = staff.frontTemplate === "WAVE_BLUE" ? -3 : 0;
  const designation = staff.designation.toUpperCase();
  drawCenteredText(
    page,
    designation,
    { ...front.designation, y: front.designation.y + waveNudge },
    regular,
    6,
    TITLE_COLOR,
    axis,
  );

  const idLabel = `ID NO. ${staff.idNumber}`;
  drawCenteredText(
    page,
    idLabel,
    { ...front.idNo, y: front.idNo.y + waveNudge },
    bold,
    6,
    ID_COLOR,
    axis,
    {
      characterSpacing: fitCharacterSpacing(idLabel, bold, 6, front.idNo.w),
    },
  );
}

/**
 * Print PDF = preview artwork (PNG template + photo + QR) + vector Poppins text.
 * Text is not rasterized through sharp: Vercel’s librsvg often drops custom
 * fonts and replaces glyphs with □ squares.
 */
export async function renderStaffCardPdf(staff: StaffCardInput) {
  const out = await PDFDocument.create();
  const { regular, bold } = await embedCardFonts(out);

  const frontPng = await renderFrontCardPng(staff);
  const frontImg = await out.embedPng(frontPng);
  const frontPage = out.addPage([PAGE.width, PAGE.height]);
  frontPage.drawImage(frontImg, {
    x: 0,
    y: 0,
    width: PAGE.width,
    height: PAGE.height,
  });
  drawFrontText(frontPage, staff, regular, bold);

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
