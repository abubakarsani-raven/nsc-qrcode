/**
 * Text / rule colours sampled from design/source/nsc-id-card.pdf
 * (green pages use forest ink; blue pages use teal name + cyan title).
 */

export type CardColorMatch = "green" | "blue";

export type CardTheme = {
  name: string;
  designation: string;
  idNo: string;
  rule: string;
};

export const CARD_THEMES: Record<CardColorMatch, CardTheme> = {
  green: {
    name: "#012e1a",
    designation: "#012e1a",
    idNo: "#012e1a",
    rule: "#005e37",
  },
  blue: {
    name: "#0878a5",
    designation: "#18a4d8",
    idNo: "#003a54",
    rule: "#18a3d7",
  },
};

/** Extra CSS/PDF top nudge so glyph tops clear the measured line box. */
export const NAME_TOP_NUDGE_PT = 2;

/**
 * Single rule under the designation — the sample card draws one 0.75 pt stroke
 * 45.32 pt wide, centred on the content axis (design/source/nsc-id-card.pdf).
 */
export const TITLE_RULE = {
  offsetPt: 2.2,
  thicknessPt: 0.75,
  widthPt: 45.32,
} as const;

/**
 * Tracking on the "ID NO. …" line, in em. Sampled from the source card:
 * the 17-character sample spans 70.4 pt at 6 pt (Poppins Bold sets 55.4 pt).
 */
export const ID_TRACKING_EM = 0.155;
