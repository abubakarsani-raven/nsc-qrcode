/**
 * Shared text layout for the card front. The browser preview (SVG) and the
 * print PDF (pdf-lib) both draw exactly these runs, so what the operator sees
 * is where the printer puts it.
 *
 * Widths come from the fonts' own metrics (font-metrics.generated.ts), and
 * lines are centred on their ink — not their advance box — so every line's
 * visible centre lands on the template's content axis.
 */

import {
  FONT_METRICS,
  type CardFontId,
} from "@/lib/id-card/font-metrics.generated";
import {
  FRONT_TEMPLATES,
  type FrontSlots,
  type FrontTemplateId,
  type NameSpec,
  type TextSlot,
} from "@/lib/id-card/slots.generated";
import {
  DEFAULT_TEXT_SETTINGS,
  TIGHT_NAME_TRACKING_EM,
  type CardTextSettings,
  type CardTypeSlot,
} from "@/lib/id-card/type-scale";

/** Glyph-box top sits this far above the baseline (fraction of size) on top-anchored slots. */
const TOP_TO_BASELINE_EM = 0.82;
/** Minimum space between the name's last baseline and the designation's cap top. */
const NAME_CLEARANCE_PT = 1;
/**
 * Other names can't wrap to a third line, so a long set (three given names)
 * may shrink below the template's name floor, down to this.
 */
const OTHER_NAMES_MIN_PT = 5;
const FIT_STEP_PT = 0.25;
const EPSILON = 0.01;

export type TextRun = {
  slot: CardTypeSlot;
  text: string;
  font: CardFontId;
  sizePt: number;
  /** Added after every glyph (PDF Tc). */
  trackingPt: number;
  /** Pen origin of the first glyph. */
  x: number;
  baseline: number;
  /** Pen origin of every glyph — lets SVG place glyphs without browser shaping. */
  glyphX: number[];
  color: string;
};

export type LineBox = {
  slot: CardTypeSlot;
  baseline: number;
  inkMinX: number;
  inkMaxX: number;
};

export type FrontLayout = {
  template: FrontSlots;
  runs: TextRun[];
  lines: LineBox[];
  rule: { x: number; y: number; w: number; h: number; color: string };
  name: {
    /** Either line is too wide, or the block is too tall for its space. */
    overflow: boolean;
    /** The two lines run into the photo ring or the designation. */
    tooTall: boolean;
    lineCount: number;
  };
  surname: { sizePt: number; overflow: boolean };
  otherNames: { sizePt: number; overflow: boolean };
  designation: { sizePt: number; overflow: boolean };
  idNo: { sizePt: number; overflow: boolean };
  /** Size each slot would print at with a 100% scale. */
  basePt: Record<CardTypeSlot, number>;
};

export type FrontLayoutInput = {
  frontTemplate: FrontTemplateId;
  firstName: string;
  middleName?: string | null;
  lastName: string;
  designation: string;
  idNumber: string;
  text?: CardTextSettings;
};

type Segment = { text: string; font: CardFontId; trackingEm: number };

type Measured = {
  glyphX: number[][];
  segmentX: number[];
  inkMinX: number;
  inkMaxX: number;
};

function glyph(font: CardFontId, ch: string): [number, number, number] {
  const m = FONT_METRICS[font];
  return m.glyphs[ch] ?? m.glyphs["N"] ?? [m.unitsPerEm * 0.6, 0, m.unitsPerEm * 0.6];
}

/** Lay segments out left-to-right from x = 0 and report ink extents. */
function measure(segments: Segment[], sizePt: number): Measured {
  let pen = 0;
  let inkMinX = Infinity;
  let inkMaxX = -Infinity;
  const glyphX: number[][] = [];
  const segmentX: number[] = [];
  segments.forEach((seg, si) => {
    const m = FONT_METRICS[seg.font];
    const unit = sizePt / m.unitsPerEm;
    const tracking = seg.trackingEm * sizePt;
    const chars = Array.from(seg.text);
    const xs: number[] = [];
    segmentX.push(pen);
    chars.forEach((ch, ci) => {
      const [adv, minX, maxX] = glyph(seg.font, ch);
      xs.push(pen);
      if (maxX > minX) {
        inkMinX = Math.min(inkMinX, pen + minX * unit);
        inkMaxX = Math.max(inkMaxX, pen + maxX * unit);
      }
      pen += adv * unit;
      const lastGlyph = si === segments.length - 1 && ci === chars.length - 1;
      if (!lastGlyph) pen += tracking;
    });
    glyphX.push(xs);
  });
  if (!Number.isFinite(inkMinX)) {
    inkMinX = 0;
    inkMaxX = 0;
  }
  return { glyphX, segmentX, inkMinX, inkMaxX };
}

function inkWidth(segments: Segment[], sizePt: number) {
  const m = measure(segments, sizePt);
  return m.inkMaxX - m.inkMinX;
}

function centredRuns(
  slot: CardTypeSlot,
  segments: Segment[],
  sizePt: number,
  axisX: number,
  baseline: number,
  color: string,
): { runs: TextRun[]; line: LineBox } {
  const m = measure(segments, sizePt);
  const offset = axisX - (m.inkMinX + m.inkMaxX) / 2;
  const runs = segments
    .map((seg, i) => ({
      slot,
      text: seg.text,
      font: seg.font,
      sizePt,
      trackingPt: seg.trackingEm * sizePt,
      x: offset + m.segmentX[i],
      baseline,
      glyphX: m.glyphX[i].map((x) => offset + x),
      color,
    }))
    .filter((run) => run.text.length > 0);
  return {
    runs,
    line: {
      slot,
      baseline,
      inkMinX: offset + m.inkMinX,
      inkMaxX: offset + m.inkMaxX,
    },
  };
}

function baselineOf(slot: Pick<TextSlot, "anchor" | "y">, sizePt: number) {
  return slot.anchor === "top" ? slot.y + sizePt * TOP_TO_BASELINE_EM : slot.y;
}

/* ---------------------------------- name ---------------------------------- */

type NameLine = {
  slot: "surname" | "otherNames";
  segments: Segment[];
  /** Auto-fitted size before the operator's scale. */
  basePt: number;
  sizePt: number;
};

/** Largest size from startPt down to minPt whose ink fits the width; minPt when none does. */
function fitWidth(spec: NameSpec, segments: Segment[], minPt = spec.minPt) {
  for (let size = spec.startPt; size >= minPt - EPSILON; size -= FIT_STEP_PT) {
    if (inkWidth(segments, size) <= spec.maxWidthPt + EPSILON) return size;
  }
  return minPt;
}

function capHeight(font: CardFontId, sizePt: number) {
  const m = FONT_METRICS[font];
  return (m.capHeight / m.unitsPerEm) * sizePt;
}

/**
 * Baseline-to-baseline distance between the two name lines. At 100% it is the
 * design's own leading; it then follows the operator's scaling of the lines.
 */
function nameGap(spec: NameSpec, top: NameLine, bottom: NameLine) {
  if (spec.leading.kind === "fixed") {
    return spec.leading.pt * ((top.sizePt + bottom.sizePt) / (top.basePt + bottom.basePt));
  }
  return spec.leading.ratio * ((top.sizePt + bottom.sizePt) / 2);
}

function layoutName(
  t: FrontSlots,
  lastName: string,
  given: string,
  settings: CardTextSettings,
) {
  const spec = t.name;
  const extra = settings.tightName ? TIGHT_NAME_TRACKING_EM : 0;
  const surnameText = lastName.toUpperCase().trim();
  const otherText = given.toUpperCase().trim().split(/\s+/).filter(Boolean).join(" ");

  const surnameSegs: Segment[] = [
    { text: surnameText, font: spec.surnameFont, trackingEm: spec.surnameTrackingEm + extra },
  ];
  const otherSegs: Segment[] = [
    { text: otherText, font: spec.givenFont, trackingEm: spec.givenTrackingEm + extra },
  ];

  const surnameBase = fitWidth(spec, surnameSegs);
  // Other names never auto-size above the surname, so the surname leads.
  const otherBase = Math.min(
    fitWidth(spec, otherSegs, Math.min(spec.minPt, OTHER_NAMES_MIN_PT)),
    surnameBase,
  );
  const surname: NameLine = {
    slot: "surname",
    segments: surnameSegs,
    basePt: surnameBase,
    sizePt: surnameBase * settings.scale.surname,
  };
  const other: NameLine = {
    slot: "otherNames",
    segments: otherSegs,
    basePt: otherBase,
    sizePt: otherBase * settings.scale.otherNames,
  };
  const lines = otherText ? [surname, other] : [surname];

  const gap = lines.length === 2 ? nameGap(spec, surname, other) : 0;
  let baselines: number[];
  if (spec.anchor.kind === "firstTop") {
    const first = spec.anchor.y + surname.sizePt * TOP_TO_BASELINE_EM;
    baselines = [first, first + gap];
  } else {
    const last = spec.anchor.y;
    baselines = lines.length === 2 ? [last - gap, last] : [last];
  }

  const widthOverflow = (line: NameLine) =>
    inkWidth(line.segments, line.sizePt) > spec.maxWidthPt + EPSILON;
  const surnameOverflow = widthOverflow(surname);
  const otherOverflow = lines.length === 2 && widthOverflow(other);
  const capTopOverflow =
    spec.anchor.kind === "lastBaseline" &&
    baselines[0] - capHeight(spec.surnameFont, surname.sizePt) < spec.anchor.minCapTop - EPSILON;

  const runs: TextRun[] = [];
  const boxes: LineBox[] = [];
  lines.forEach((line, i) => {
    const { runs: r, line: box } = centredRuns(
      line.slot,
      line.segments,
      line.sizePt,
      t.contentAxisX,
      baselines[i],
      t.theme.name,
    );
    runs.push(...r);
    boxes.push(box);
  });
  return {
    runs,
    boxes,
    lastBaseline: baselines[baselines.length - 1],
    surname: { basePt: surname.basePt, sizePt: surname.sizePt, overflow: surnameOverflow },
    otherNames: { basePt: other.basePt, sizePt: other.sizePt, overflow: otherOverflow },
    capTopOverflow,
  };
}

/* --------------------------- designation / ID ----------------------------- */

function layoutSingle(
  t: FrontSlots,
  slotName: "designation" | "idNo",
  slot: TextSlot,
  text: string,
  scale: number,
  color: string,
) {
  let sizePt = slot.sizePt * scale;
  let trackingEm = slot.trackingEm;
  const seg = (): Segment[] => [{ text, font: slot.font, trackingEm }];

  let width = inkWidth(seg(), sizePt);
  if (width > slot.maxWidthPt && slot.squeezeTracking && trackingEm > 0) {
    const gaps = Math.max(1, Array.from(text).length - 1);
    const natural = inkWidth([{ text, font: slot.font, trackingEm: 0 }], sizePt);
    trackingEm = Math.max(0, (slot.maxWidthPt - natural) / gaps / sizePt);
    width = inkWidth(seg(), sizePt);
  }
  if (width > slot.maxWidthPt) {
    // Ink width scales linearly with size when tracking is in em.
    sizePt = Math.max(slot.minPt, sizePt * (slot.maxWidthPt / width));
    width = inkWidth(seg(), sizePt);
  }
  const { runs, line } = centredRuns(
    slotName,
    seg(),
    sizePt,
    t.contentAxisX,
    baselineOf(slot, sizePt),
    color,
  );
  return { runs, line, sizePt, overflow: width > slot.maxWidthPt + EPSILON };
}

/* --------------------------------- front ---------------------------------- */

export function layoutFront(input: FrontLayoutInput): FrontLayout {
  const t = FRONT_TEMPLATES[input.frontTemplate];
  const settings = input.text ?? DEFAULT_TEXT_SETTINGS;
  const given = [input.firstName, input.middleName].filter(Boolean).join(" ");

  const name = layoutName(t, input.lastName, given, settings);
  const designation = layoutSingle(
    t,
    "designation",
    t.designation,
    input.designation.toUpperCase().trim(),
    settings.scale.designation,
    t.theme.designation,
  );
  const designationCapTop =
    designation.line.baseline - capHeight(t.designation.font, designation.sizePt);
  const crowdsDesignation = name.lastBaseline + NAME_CLEARANCE_PT > designationCapTop + EPSILON;
  const idNo = layoutSingle(
    t,
    "idNo",
    t.idNo,
    `${t.idNo.prefix}${input.idNumber.trim()}`,
    settings.scale.idNo,
    t.theme.idNo,
  );

  return {
    template: t,
    runs: [...name.runs, ...designation.runs, ...idNo.runs],
    lines: [...name.boxes, designation.line, idNo.line],
    rule: {
      x: t.contentAxisX - t.rule.widthPt / 2,
      y: t.rule.y,
      w: t.rule.widthPt,
      h: t.rule.thicknessPt,
      color: t.theme.rule,
    },
    name: {
      overflow:
        name.surname.overflow ||
        name.otherNames.overflow ||
        name.capTopOverflow ||
        crowdsDesignation,
      tooTall: name.capTopOverflow || crowdsDesignation,
      lineCount: name.boxes.length,
    },
    surname: { sizePt: name.surname.sizePt, overflow: name.surname.overflow },
    otherNames: { sizePt: name.otherNames.sizePt, overflow: name.otherNames.overflow },
    designation: { sizePt: designation.sizePt, overflow: designation.overflow },
    idNo: { sizePt: idNo.sizePt, overflow: idNo.overflow },
    basePt: {
      surname: name.surname.basePt,
      otherNames: name.otherNames.basePt,
      designation: t.designation.sizePt,
      idNo: t.idNo.sizePt,
    },
  };
}

/** Largest distance (pt) of any line's ink centre from the content axis. */
export function maxAxisDeviation(layout: FrontLayout) {
  return layout.lines.reduce(
    (max, line) =>
      Math.max(
        max,
        Math.abs((line.inkMinX + line.inkMaxX) / 2 - layout.template.contentAxisX),
      ),
    0,
  );
}
