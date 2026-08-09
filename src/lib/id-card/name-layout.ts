import {
  FRONT_TEMPLATES,
  type FrontTemplateId,
} from "@/lib/id-card/slots.generated";

export type NameLayout = {
  /** Bold surname (always on line 1) */
  surname: string;
  /** Regular given names shown on line 1 after the surname (may be empty) */
  line1Given: string;
  /** Regular given names on line 2 (may be empty) */
  line2: string;
  fontSizePt: number;
  leadingPt: number;
  given: string;
};

const MIN_PT = 8;
const START_PT = 12;
const LEADING = 11;
const STEP = 0.25;

/** Approximate glyph width (bold ≈ 0.62em, regular ≈ 0.55em) */
function measureMixed(
  surname: string,
  line1Given: string,
  fontSize: number,
) {
  let w = 0;
  for (const ch of surname) {
    w += ch === " " ? fontSize * 0.28 : fontSize * 0.62;
  }
  if (line1Given) {
    w += fontSize * 0.28; // space between surname and given
    for (const ch of line1Given) {
      w += ch === " " ? fontSize * 0.28 : fontSize * 0.55;
    }
  }
  return w;
}

function measureRegular(text: string, fontSize: number) {
  let w = 0;
  for (const ch of text) {
    w += ch === " " ? fontSize * 0.28 : fontSize * 0.55;
  }
  return w;
}

export function layoutName(
  surname: string,
  given: string,
  front: FrontTemplateId,
): NameLayout {
  const slots = FRONT_TEMPLATES[front];
  const maxW1 = slots.nameLine1.w;
  const maxW2 = slots.nameLine2.w;
  const sur = surname.toUpperCase().trim();
  const giv = given.toUpperCase().trim();
  const tokens = giv.split(/\s+/).filter(Boolean);

  let fontSize = START_PT;

  while (fontSize >= MIN_PT) {
    // Match sample card: "AKUTAH PIUS" / "UKEYIMA" — first given stays with surname.
    let line1Given = "";
    let line2 = "";
    if (tokens.length === 0) {
      line1Given = "";
      line2 = "";
    } else if (tokens.length === 1) {
      if (measureMixed(sur, tokens[0], fontSize) <= maxW1) {
        line1Given = tokens[0];
      } else {
        line2 = tokens[0];
      }
    } else {
      line1Given = tokens[0];
      line2 = tokens.slice(1).join(" ");
    }

    const ok =
      measureMixed(sur, line1Given, fontSize) <= maxW1 &&
      (!line2 || measureRegular(line2, fontSize) <= maxW2);
    if (ok) {
      return {
        surname: sur,
        line1Given,
        line2,
        fontSizePt: fontSize,
        leadingPt: LEADING,
        given: giv,
      };
    }
    fontSize -= STEP;
  }

  return {
    surname: sur,
    line1Given: tokens[0] ?? "",
    line2: tokens.slice(1).join(" "),
    fontSizePt: MIN_PT,
    leadingPt: LEADING,
    given: giv,
  };
}

export function nameOverflows(layout: NameLayout, front: FrontTemplateId) {
  const slots = FRONT_TEMPLATES[front];
  return (
    measureMixed(layout.surname, layout.line1Given, layout.fontSizePt) >
      slots.nameLine1.w ||
    (layout.line2 &&
      measureRegular(layout.line2, layout.fontSizePt) > slots.nameLine2.w)
  );
}
