/**
 * Per-record type settings for the card's dynamic text.
 *
 * Scale values are multipliers on the size that slot would otherwise use — the
 * auto-fitted size for each name line, the template's nominal size for the
 * designation and ID line. Stored on Staff (cardTypeScale, JSON) so the
 * preview, the print PDF and the operator all read one source of truth.
 */

/** The name is always two lines: surname on top, other names below. */
export type CardTypeSlot = "surname" | "otherNames" | "designation" | "idNo";

export type CardTypeScale = Record<CardTypeSlot, number>;

export type CardTextSettings = {
  scale: CardTypeScale;
  /** Tighter letter-spacing on both name lines, for long names. */
  tightName: boolean;
};

export const DEFAULT_TYPE_SCALE: CardTypeScale = {
  surname: 1,
  otherNames: 1,
  designation: 1,
  idNo: 1,
};

export const DEFAULT_TEXT_SETTINGS: CardTextSettings = {
  scale: DEFAULT_TYPE_SCALE,
  tightName: false,
};

export const TYPE_SCALE_MIN = 0.75;
export const TYPE_SCALE_MAX = 1.25;
export const TYPE_SCALE_STEP = 0.05;

/** Extra name tracking (em) when `tightName` is on. */
export const TIGHT_NAME_TRACKING_EM = -0.03;

export const TYPE_SLOT_LABELS: Record<CardTypeSlot, string> = {
  surname: "Surname",
  otherNames: "Other names",
  designation: "Designation",
  idNo: "ID number",
};

const SLOTS = Object.keys(DEFAULT_TYPE_SCALE) as CardTypeSlot[];

export function clampScale(value: number) {
  if (!Number.isFinite(value)) return 1;
  // Snap to the step, then to 2dp — stepping in 0.05 otherwise accumulates
  // float noise (1.1500000000000001) into stored JSON and equality checks.
  const stepped = Math.round(value / TYPE_SCALE_STEP) * TYPE_SCALE_STEP;
  const rounded = Math.round(stepped * 100) / 100;
  return Math.min(TYPE_SCALE_MAX, Math.max(TYPE_SCALE_MIN, rounded));
}

function defaults(): CardTextSettings {
  return { ...DEFAULT_TEXT_SETTINGS, scale: { ...DEFAULT_TYPE_SCALE } };
}

/** Tolerant of missing, malformed or out-of-range stored values. */
export function parseTextSettings(raw?: string | null): CardTextSettings {
  if (!raw) return defaults();
  try {
    const parsed = JSON.parse(raw) as Partial<
      Record<CardTypeSlot | "name", unknown> & { tightName: unknown }
    >;
    // Records saved before the name was split carry one `name` scale for both lines.
    const legacyName = parsed.name ?? 1;
    return {
      scale: {
        surname: clampScale(Number(parsed.surname ?? legacyName)),
        otherNames: clampScale(Number(parsed.otherNames ?? legacyName)),
        designation: clampScale(Number(parsed.designation ?? 1)),
        idNo: clampScale(Number(parsed.idNo ?? 1)),
      },
      tightName: parsed.tightName === true,
    };
  } catch {
    return defaults();
  }
}

export function parseTypeScale(raw?: string | null): CardTypeScale {
  return parseTextSettings(raw).scale;
}

export function isDefaultTextSettings(settings: CardTextSettings) {
  return (
    SLOTS.every((k) => Math.abs(clampScale(settings.scale[k]) - 1) < 0.001) &&
    !settings.tightName
  );
}

/** `null` when everything is default, so untouched records stay clean. */
export function serializeTextSettings(settings: CardTextSettings): string | null {
  if (isDefaultTextSettings(settings)) return null;
  return JSON.stringify({
    surname: clampScale(settings.scale.surname),
    otherNames: clampScale(settings.scale.otherNames),
    designation: clampScale(settings.scale.designation),
    idNo: clampScale(settings.scale.idNo),
    ...(settings.tightName ? { tightName: true } : {}),
  });
}

/** Point size a slot ends up at, for showing the operator real numbers. */
export function scaledPt(basePt: number, scale: number) {
  return Math.round(basePt * scale * 10) / 10;
}
