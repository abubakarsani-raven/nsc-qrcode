/**
 * Measured slot config from design/source/nsc-id-card.pdf
 * Coordinates in PDF points, origin TOP-LEFT. Page: 141.75 × 240.75 pt.
 * Generated / maintained alongside scripts/extract-templates.py
 */

export const PAGE = { width: 141.75, height: 240.75 } as const;

export type Rect = { x: number; y: number; w: number; h: number };

export type FrontTemplateId =
  | "WAVE_GREEN"
  | "WAVE_BLUE"
  | "BAR_BLUE_SQUARE"
  | "BAR_BLUE_CIRCLE"
  | "BAR_GREEN_CIRCLE"
  | "BAR_GREEN_SQUARE";

export type BackTemplateId =
  | "BACK_WAVE_GREEN"
  | "BACK_WAVE_BLUE"
  | "BACK_BAR_BLUE"
  | "BACK_BAR_GREEN";

export type PhotoMask = "circle" | "roundedSquare";
export type Family = "wave" | "bar";

export type FrontSlots = {
  id: FrontTemplateId;
  pageIndex: number;
  family: Family;
  photoMask: PhotoMask;
  contentAxisX: number;
  colorMatch: "green" | "blue";
  crest: Rect;
  /** 4:5 source image placement box from the sample */
  photo: Rect;
  /**
   * Visible mask on the card. For circles this is a square bbox (true circle);
   * for rounded squares it matches `photo` with a corner radius.
   */
  photoFrame: Rect;
  /** Corner radius in pt for roundedSquare masks; ignored for circles */
  photoRadiusPt?: number;
  nameLine1: Rect;
  nameLine2: Rect;
  designation: Rect;
  idNo: Rect;
  qr: { moduleBox: Rect; quietModules: number };
  fonts: {
    nameBold: "Poppins";
    nameRegular: "Poppins";
    designation: "Poppins";
    idNo: "Poppins";
  };
};

export type BackSlots = {
  id: BackTemplateId;
  pageIndex: number;
  family: Family;
  colorMatch: "green" | "blue";
  hasBarcode: boolean;
  barcode?: Rect;
  signatureRule?: Rect;
  smallCrest: Rect;
};

function rect(x0: number, y0: number, x1: number, y1: number): Rect {
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

const WAVE_SLOTS = {
  crest: rect(54.4, 7.3, 87.4, 35.0),
  photo: rect(31.8, 52.7, 102.0, 140.4),
  // Measured circular frame fill on sample pages 0/2 (68.4 × 68.4)
  photoFrame: rect(36.61, 49.73, 105.01, 118.13),
  // Tight line boxes (sample PDF bboxes overlap; use visual tops + ~12pt height)
  nameLine1: rect(20.0, 121.4, 121.75, 133.4),
  nameLine2: rect(20.0, 132.4, 121.75, 144.4),
  designation: rect(20.0, 156.4, 121.75, 164.2),
  idNo: rect(20.0, 171.7, 121.75, 179.7),
  qr: {
    moduleBox: rect(51.33, 186.0, 90.0, 224.5),
    quietModules: 4,
  },
  contentAxisX: 70.875,
  fonts: {
    nameBold: "Poppins" as const,
    nameRegular: "Poppins" as const,
    designation: "Poppins" as const,
    idNo: "Poppins" as const,
  },
};

const BAR_CIRCLE_SLOTS = {
  crest: rect(65.3, 4.7, 92.3, 27.2),
  photo: rect(39.7, 52.4, 109.8, 140.1),
  // Measured circular frame on sample pages 5/7
  photoFrame: rect(44.42, 49.4, 112.83, 117.81),
  nameLine1: rect(28.0, 122.9, 129.0, 134.9),
  nameLine2: rect(28.0, 133.6, 129.0, 145.6),
  designation: rect(28.0, 155.7, 129.0, 163.5),
  idNo: rect(28.0, 172.7, 129.0, 180.5),
  qr: {
    moduleBox: rect(59.17, 191.33, 97.83, 230.0),
    quietModules: 4,
  },
  contentAxisX: 78.69,
  fonts: {
    nameBold: "Poppins" as const,
    nameRegular: "Poppins" as const,
    designation: "Poppins" as const,
    idNo: "Poppins" as const,
  },
};

const BAR_SQUARE_PHOTO = rect(47.2, 44.8, 110.1, 123.4);
const BAR_SQUARE_SLOTS = {
  ...BAR_CIRCLE_SLOTS,
  photo: BAR_SQUARE_PHOTO,
  photoFrame: BAR_SQUARE_PHOTO,
  photoRadiusPt: 6,
};

export const FRONT_TEMPLATES: Record<FrontTemplateId, FrontSlots> = {
  WAVE_GREEN: {
    id: "WAVE_GREEN",
    pageIndex: 0,
    family: "wave",
    photoMask: "circle",
    colorMatch: "green",
    ...WAVE_SLOTS,
  },
  WAVE_BLUE: {
    id: "WAVE_BLUE",
    pageIndex: 2,
    family: "wave",
    photoMask: "circle",
    colorMatch: "blue",
    ...WAVE_SLOTS,
  },
  BAR_BLUE_SQUARE: {
    id: "BAR_BLUE_SQUARE",
    pageIndex: 4,
    family: "bar",
    photoMask: "roundedSquare",
    colorMatch: "blue",
    ...BAR_SQUARE_SLOTS,
  },
  BAR_BLUE_CIRCLE: {
    id: "BAR_BLUE_CIRCLE",
    pageIndex: 5,
    family: "bar",
    photoMask: "circle",
    colorMatch: "blue",
    ...BAR_CIRCLE_SLOTS,
  },
  BAR_GREEN_CIRCLE: {
    id: "BAR_GREEN_CIRCLE",
    pageIndex: 7,
    family: "bar",
    photoMask: "circle",
    colorMatch: "green",
    ...BAR_CIRCLE_SLOTS,
  },
  BAR_GREEN_SQUARE: {
    id: "BAR_GREEN_SQUARE",
    pageIndex: 8,
    family: "bar",
    photoMask: "roundedSquare",
    colorMatch: "green",
    ...BAR_SQUARE_SLOTS,
  },
};

export const BACK_TEMPLATES: Record<BackTemplateId, BackSlots> = {
  BACK_WAVE_GREEN: {
    id: "BACK_WAVE_GREEN",
    pageIndex: 1,
    family: "wave",
    colorMatch: "green",
    // Back art is used verbatim from the source PDF — the barcode is part of it.
    hasBarcode: false,
    smallCrest: rect(9.2, 192.1, 30.2, 210.1),
  },
  BACK_WAVE_BLUE: {
    id: "BACK_WAVE_BLUE",
    pageIndex: 3,
    family: "wave",
    colorMatch: "blue",
    // Back art is used verbatim from the source PDF — the barcode is part of it.
    hasBarcode: false,
    smallCrest: rect(9.2, 192.1, 30.2, 210.1),
  },
  BACK_BAR_BLUE: {
    id: "BACK_BAR_BLUE",
    pageIndex: 6,
    family: "bar",
    colorMatch: "blue",
    // Back art is used verbatim from the source PDF — the barcode is part of it.
    hasBarcode: false,
    smallCrest: rect(66.9, 14.3, 88.6, 33.0),
  },
  BACK_BAR_GREEN: {
    id: "BACK_BAR_GREEN",
    pageIndex: 9,
    family: "bar",
    colorMatch: "green",
    // Back art is used verbatim from the source PDF — the barcode is part of it.
    hasBarcode: false,
    smallCrest: rect(66.9, 14.3, 88.6, 33.0),
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
};

/** Calibrated framing from sample photo on page 0 (face detector constants) */
export const FACE_FRAMING = {
  eyeLineFromTop: 0.35,
  faceHeightRatio: 0.55,
};

/** Largest photo slot for dpi floor (wave circle) */
export const PHOTO_SLOT_INCHES = {
  width: 70.2 / 72,
  height: 87.7 / 72,
};

export const PHOTO_DPI_FLOOR = 300;
export const PHOTO_DPI_TARGET = 600;
export const PHOTO_MASTER = { width: 960, height: 1200 } as const;

export function nameColorMismatch(
  front: FrontTemplateId,
  back: BackTemplateId,
): boolean {
  return (
    FRONT_TEMPLATES[front].colorMatch !== BACK_TEMPLATES[back].colorMatch
  );
}
