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

/** Double rule under designation: offset of first/second stroke from designation bottom. */
export const TITLE_RULE = {
  firstOffsetPt: 2.2,
  gapPt: 2.0,
  thicknessPt: 0.55,
  widthPt: 45.32,
} as const;
