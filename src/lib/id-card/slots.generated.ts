/**
 * Card template registry. Coordinates in PDF points, origin TOP-LEFT.
 *
 * NSC templates are measured from design/source/nsc-id-card.pdf (141.75 × 240.75
 * pt) and maintained alongside scripts/extract-templates.py. NPERA templates are
 * measured from design/source/npera-id-card.pdf and placed on a CR80 page by
 * scripts/extract-npera.py (artboard units × 0.237110, +2.768 pt top pad).
 */

import type { CardFontId } from "@/lib/id-card/font-metrics.generated";
import { CARD_THEMES, type CardTheme } from "@/lib/id-card/theme";
import type { BarcodeFit } from "@/lib/barcode/code128";

export type PageSize = { width: number; height: number };

/** Size of the NSC sample artboard. */
export const NSC_PAGE: PageSize = { width: 141.75, height: 240.75 };
/** ISO/IEC 7810 ID-1 (CR80): 54 × 85.6 mm. */
export const CR80_PAGE: PageSize = { width: 153.0709, height: 242.6457 };

export type Rect = { x: number; y: number; w: number; h: number };

export type FrontTemplateId =
  | "WAVE_GREEN"
  | "WAVE_BLUE"
  | "BAR_BLUE_SQUARE"
  | "BAR_BLUE_CIRCLE"
  | "BAR_GREEN_CIRCLE"
  | "BAR_GREEN_SQUARE"
  | "NPERA_GREEN";

export type BackTemplateId =
  | "BACK_WAVE_GREEN"
  | "BACK_WAVE_BLUE"
  | "BACK_BAR_BLUE"
  | "BACK_BAR_GREEN"
  | "BACK_NPERA_GREEN";

/** Tuples for request validation (z.enum) — keep in step with the unions above. */
export const FRONT_TEMPLATE_IDS = [
  "WAVE_GREEN",
  "WAVE_BLUE",
  "BAR_BLUE_SQUARE",
  "BAR_BLUE_CIRCLE",
  "BAR_GREEN_CIRCLE",
  "BAR_GREEN_SQUARE",
  "NPERA_GREEN",
] as const satisfies readonly FrontTemplateId[];

export const BACK_TEMPLATE_IDS = [
  "BACK_WAVE_GREEN",
  "BACK_WAVE_BLUE",
  "BACK_BAR_BLUE",
  "BACK_BAR_GREEN",
  "BACK_NPERA_GREEN",
] as const satisfies readonly BackTemplateId[];

export type Brand = "NSC" | "NPERA";
export type PhotoMask = "circle" | "roundedSquare";
export type Family = "wave" | "bar" | "npera";

/** One line of dynamic text with a fixed nominal size. */
export type TextSlot = {
  font: CardFontId;
  sizePt: number;
  /** Floor when shrinking to fit `maxWidthPt`. */
  minPt: number;
  trackingEm: number;
  /** "top": `y` is the glyph-box top (baseline = y + 0.82·size). "baseline": `y` is the baseline. */
  anchor: "top" | "baseline";
  y: number;
  maxWidthPt: number;
  /** Give up tracking (down to 0) before giving up point size. */
  squeezeTracking?: boolean;
};

/** Two lines: "SURNAME" / "FIRST MIDDLE", each fitted and scaled on its own. */
export type NameSpec = {
  surnameFont: CardFontId;
  givenFont: CardFontId;
  surnameTrackingEm: number;
  givenTrackingEm: number;
  startPt: number;
  minPt: number;
  maxWidthPt: number;
  leading: { kind: "fixed"; pt: number } | { kind: "ratio"; ratio: number };
  /**
   * firstTop: first line's glyph-box top is pinned (block grows down).
   * lastBaseline: last line's baseline is pinned (block grows up) and the first
   * line's cap top may not rise above `minCapTop`.
   */
  anchor:
    | { kind: "firstTop"; y: number }
    | { kind: "lastBaseline"; y: number; minCapTop: number };
};

export type RuleSpec = { y: number; widthPt: number; thicknessPt: number };

export type QrSlot = { moduleBox: Rect; quietModules: number };

export type FrontSlots = {
  id: FrontTemplateId;
  brand: Brand;
  page: PageSize;
  pageIndex: number;
  family: Family;
  photoMask: PhotoMask;
  /** Every dynamic element on the front is centred on this x. */
  contentAxisX: number;
  colorMatch: "green" | "blue";
  theme: CardTheme;
  /**
   * Visible photo mask on the card. For circles this is a square bbox (true
   * circle); for rounded squares it has a corner radius.
   */
  photoFrame: Rect;
  /** Corner radius in pt for roundedSquare masks; ignored for circles */
  photoRadiusPt?: number;
  /**
   * Ring around the photo. "outside": drawn behind the photo, outside the
   * frame. "inside": drawn over the photo along the inside of the frame edge.
   */
  halo: { color: string; pt: number; position: "outside" | "inside" } | null;
  name: NameSpec;
  designation: TextSlot;
  idNo: TextSlot & { prefix: string };
  rule: RuleSpec;
  /** null on designs without a QR code. */
  qr: QrSlot | null;
};

export type BackSlots = {
  id: BackTemplateId;
  brand: Brand;
  page: PageSize;
  pageIndex: number;
  family: Family;
  colorMatch: "green" | "blue";
  /** Code 128 of the staff ID number, drawn per card. null when the art is fully static. */
  barcode: ({ rect: Rect; color: string } & BarcodeFit) | null;
  /** Centre line shared by the back's elements. */
  contentAxisX: number;
};

function rect(x0: number, y0: number, x1: number, y1: number): Rect {
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

const NSC_HALO = { color: "#D3DCF1", pt: 3.5, position: "outside" as const };

/** NSC text boxes are loose bboxes from the sample; type sits on their tops. */
function nscText(slots: {
  nameLine1: Rect;
  designation: Rect;
  idNo: Rect;
}): Pick<FrontSlots, "name" | "designation" | "idNo" | "rule"> {
  return {
    name: {
      surnameFont: "poppins-bold",
      givenFont: "poppins-regular",
      surnameTrackingEm: 0,
      givenTrackingEm: 0,
      startPt: 12,
      minPt: 8,
      maxWidthPt: slots.nameLine1.w,
      leading: { kind: "fixed", pt: 11 },
      // +2pt so glyph tops clear the measured line box.
      anchor: { kind: "firstTop", y: slots.nameLine1.y + 2 },
    },
    designation: {
      font: "poppins-regular",
      sizePt: 6,
      minPt: 4.5,
      trackingEm: 0,
      anchor: "top",
      y: slots.designation.y,
      maxWidthPt: slots.designation.w,
    },
    idNo: {
      font: "poppins-bold",
      sizePt: 6,
      minPt: 4.5,
      // Sample: the 17-character line spans 70.4 pt at 6 pt (Poppins Bold sets 55.4 pt).
      trackingEm: 0.155,
      anchor: "top",
      y: slots.idNo.y,
      maxWidthPt: slots.idNo.w,
      squeezeTracking: true,
      prefix: "ID NO. ",
    },
    // One 0.75 pt stroke, 45.32 pt wide, 2.2 pt under the designation box.
    rule: {
      y: slots.designation.y + slots.designation.h + 2.2,
      widthPt: 45.32,
      thicknessPt: 0.75,
    },
  };
}

const WAVE_BOXES = {
  nameLine1: rect(20.0, 132.0, 121.75, 144.0),
  designation: rect(20.0, 158.0, 121.75, 165.8),
  idNo: rect(20.0, 173.0, 121.75, 181.0),
};

const WAVE_SLOTS = {
  page: NSC_PAGE,
  brand: "NSC" as const,
  // Circular frame nudged +6pt vs sample so halo clears the org-name band
  photoFrame: rect(36.61, 55.73, 105.01, 124.13),
  halo: NSC_HALO,
  qr: { moduleBox: rect(51.33, 186.0, 90.0, 224.5), quietModules: 4 },
  contentAxisX: 70.875,
  ...nscText(WAVE_BOXES),
};

/** WAVE_BLUE — keep clearance under a 2-line name. */
const WAVE_BLUE_SLOTS = {
  ...WAVE_SLOTS,
  ...nscText({
    ...WAVE_BOXES,
    designation: rect(20.0, 156.0, 121.75, 164.0),
    idNo: rect(20.0, 172.0, 121.75, 180.0),
  }),
};

const BAR_CIRCLE_BOXES = {
  nameLine1: rect(28.0, 129.5, 129.0, 141.5),
  designation: rect(28.0, 155.7, 129.0, 163.5),
  idNo: rect(28.0, 172.7, 129.0, 180.5),
};

const BAR_CIRCLE_SLOTS = {
  page: NSC_PAGE,
  brand: "NSC" as const,
  // Measured circular frame on sample pages 5/7
  photoFrame: rect(44.42, 49.4, 112.83, 117.81),
  halo: NSC_HALO,
  qr: { moduleBox: rect(59.17, 191.33, 97.83, 230.0), quietModules: 4 },
  contentAxisX: 78.69,
  ...nscText(BAR_CIRCLE_BOXES),
};

// Square frame sits lower than circle; name must clear frame + halo.
const BAR_SQUARE_SLOTS = {
  ...BAR_CIRCLE_SLOTS,
  photoFrame: rect(47.2, 44.8, 110.1, 123.4),
  photoRadiusPt: 6,
  ...nscText({
    nameLine1: rect(28.0, 135.0, 129.0, 147.0),
    designation: rect(28.0, 160.5, 129.0, 168.3),
    idNo: rect(28.0, 177.0, 129.0, 184.8),
  }),
};

/**
 * NPERA front, measured on the 645.57-unit artboard and scaled to CR80.
 * Every element shares the photo circle's centre line (artboard x 361.9).
 * Inter Display stands in for the outlined Canva type: widths match the
 * sample within 0.5 pt once tracking is applied.
 */
const NPERA_AXIS = 85.81;
const NPERA_TEXT_MAX_W = 118;

const NPERA_FRONT: Omit<FrontSlots, "id" | "pageIndex" | "colorMatch"> = {
  brand: "NPERA",
  page: CR80_PAGE,
  family: "npera",
  photoMask: "circle",
  contentAxisX: NPERA_AXIS,
  theme: {
    name: "#05551C",
    designation: "#000000",
    idNo: "#000000",
    rule: "#48A5F8",
  },
  photoFrame: rect(49.793, 62.275, 121.827, 134.309),
  // The sample paints its ring over the photo, inside the circle's edge.
  halo: { color: "#D9E0F0", pt: 3.0017, position: "inside" },
  name: {
    surnameFont: "inter-display-extrabold",
    givenFont: "inter-display-regular",
    surnameTrackingEm: -0.0285,
    givenTrackingEm: -0.0525,
    startPt: 12.005,
    minPt: 7,
    maxWidthPt: NPERA_TEXT_MAX_W,
    leading: { kind: "ratio", ratio: 61 / 50.63 },
    // Given-name baseline from the sample; cap tops stay below the photo ring.
    anchor: { kind: "lastBaseline", y: 168.816, minCapTop: 140 },
  },
  designation: {
    font: "inter-display-regular",
    sizePt: 6.0036,
    minPt: 4.5,
    trackingEm: -0.0545,
    anchor: "baseline",
    y: 179.943,
    maxWidthPt: NPERA_TEXT_MAX_W,
  },
  idNo: {
    font: "inter-display-extrabold",
    sizePt: 6.0036,
    minPt: 4.5,
    trackingEm: 0.2785,
    anchor: "baseline",
    y: 196.951,
    maxWidthPt: NPERA_TEXT_MAX_W,
    squeezeTracking: true,
    prefix: "ID. ",
  },
  rule: { y: 183.5, widthPt: 50.023, thicknessPt: 1.0006 },
  qr: null,
};

export const FRONT_TEMPLATES: Record<FrontTemplateId, FrontSlots> = {
  WAVE_GREEN: {
    id: "WAVE_GREEN",
    pageIndex: 0,
    family: "wave",
    photoMask: "circle",
    colorMatch: "green",
    theme: CARD_THEMES.green,
    ...WAVE_SLOTS,
  },
  WAVE_BLUE: {
    id: "WAVE_BLUE",
    pageIndex: 2,
    family: "wave",
    photoMask: "circle",
    colorMatch: "blue",
    theme: CARD_THEMES.blue,
    ...WAVE_BLUE_SLOTS,
  },
  BAR_BLUE_SQUARE: {
    id: "BAR_BLUE_SQUARE",
    pageIndex: 4,
    family: "bar",
    photoMask: "roundedSquare",
    colorMatch: "blue",
    theme: CARD_THEMES.blue,
    ...BAR_SQUARE_SLOTS,
  },
  BAR_BLUE_CIRCLE: {
    id: "BAR_BLUE_CIRCLE",
    pageIndex: 5,
    family: "bar",
    photoMask: "circle",
    colorMatch: "blue",
    theme: CARD_THEMES.blue,
    ...BAR_CIRCLE_SLOTS,
  },
  BAR_GREEN_CIRCLE: {
    id: "BAR_GREEN_CIRCLE",
    pageIndex: 7,
    family: "bar",
    photoMask: "circle",
    colorMatch: "green",
    theme: CARD_THEMES.green,
    ...BAR_CIRCLE_SLOTS,
  },
  BAR_GREEN_SQUARE: {
    id: "BAR_GREEN_SQUARE",
    pageIndex: 8,
    family: "bar",
    photoMask: "roundedSquare",
    colorMatch: "green",
    theme: CARD_THEMES.green,
    ...BAR_SQUARE_SLOTS,
  },
  NPERA_GREEN: {
    id: "NPERA_GREEN",
    pageIndex: 0,
    colorMatch: "green",
    ...NPERA_FRONT,
  },
};

// Back art is used verbatim from the NSC source PDF — the barcode is part of it.
export const BACK_TEMPLATES: Record<BackTemplateId, BackSlots> = {
  BACK_WAVE_GREEN: {
    id: "BACK_WAVE_GREEN",
    brand: "NSC",
    page: NSC_PAGE,
    pageIndex: 1,
    family: "wave",
    colorMatch: "green",
    barcode: null,
    contentAxisX: 70.875,
  },
  BACK_WAVE_BLUE: {
    id: "BACK_WAVE_BLUE",
    brand: "NSC",
    page: NSC_PAGE,
    pageIndex: 3,
    family: "wave",
    colorMatch: "blue",
    barcode: null,
    contentAxisX: 70.875,
  },
  BACK_BAR_BLUE: {
    id: "BACK_BAR_BLUE",
    brand: "NSC",
    page: NSC_PAGE,
    pageIndex: 6,
    family: "bar",
    colorMatch: "blue",
    barcode: null,
    contentAxisX: 78.69,
  },
  BACK_BAR_GREEN: {
    id: "BACK_BAR_GREEN",
    brand: "NSC",
    page: NSC_PAGE,
    pageIndex: 9,
    family: "bar",
    colorMatch: "green",
    barcode: null,
    contentAxisX: 78.69,
  },
  BACK_NPERA_GREEN: {
    id: "BACK_NPERA_GREEN",
    brand: "NPERA",
    page: CR80_PAGE,
    pageIndex: 1,
    family: "npera",
    colorMatch: "green",
    // Bars of the sample barcode, re-centred on the back axis (artboard x 288.8).
    // Code set B throughout: matches the sample's bar density (~0.2 mm modules for 8 digits).
    barcode: {
      rect: rect(32.614, 200.103, 104.34, 218.123),
      color: "#000000",
      compactDigits: false,
      minModulePt: 0.48,
      // Back art leaves ~60 pt either side of the axis clear below the signature.
      maxWidthPt: 118,
    },
    contentAxisX: 68.477,
  },
};

export const DEFAULT_FRONT: FrontTemplateId = "WAVE_GREEN";
export const DEFAULT_BACK: BackTemplateId = "BACK_WAVE_GREEN";

export const FRONT_DEFAULT_BACK: Record<FrontTemplateId, BackTemplateId> = {
  WAVE_GREEN: "BACK_WAVE_GREEN",
  WAVE_BLUE: "BACK_WAVE_BLUE",
  BAR_BLUE_SQUARE: "BACK_BAR_BLUE",
  BAR_BLUE_CIRCLE: "BACK_BAR_BLUE",
  BAR_GREEN_CIRCLE: "BACK_BAR_GREEN",
  BAR_GREEN_SQUARE: "BACK_BAR_GREEN",
  NPERA_GREEN: "BACK_NPERA_GREEN",
};

/** Calibrated framing from sample photo on page 0 (face detector constants) */
export const FACE_FRAMING = {
  eyeLineFromTop: 0.35,
  faceHeightRatio: 0.55,
};

/** Largest photo slot for the dpi floor: the NPERA circle, as a 4:5 cut. */
export const PHOTO_SLOT_INCHES = {
  width: 72.04 / 72,
  height: 90.05 / 72,
};

export const PHOTO_DPI_FLOOR = 300;
export const PHOTO_DPI_TARGET = 600;
export const PHOTO_MASTER = { width: 960, height: 1200 } as const;

export function frontHasQr(front: FrontTemplateId): boolean {
  return FRONT_TEMPLATES[front].qr !== null;
}

export function nameColorMismatch(
  front: FrontTemplateId,
  back: BackTemplateId,
): boolean {
  return (
    FRONT_TEMPLATES[front].colorMatch !== BACK_TEMPLATES[back].colorMatch
  );
}

export function brandMismatch(
  front: FrontTemplateId,
  back: BackTemplateId,
): boolean {
  return FRONT_TEMPLATES[front].brand !== BACK_TEMPLATES[back].brand;
}
