/**
 * Per-record type sizing for the card's dynamic text.
 *
 * Each value is a multiplier on the size that slot would otherwise use — the
 * auto-fitted size for the name, a flat 6 pt for the designation and ID line.
 * Stored on Staff as JSON so the preview, the print PDF and the operator all
 * read one source of truth.
 */

export type CardTypeSlot = "name" | "designation" | "idNo";

export type CardTypeScale = Record<CardTypeSlot, number>;

export const DEFAULT_TYPE_SCALE: CardTypeScale = {
  name: 1,
  designation: 1,
  idNo: 1,
};

export const TYPE_SCALE_MIN = 0.75;
export const TYPE_SCALE_MAX = 1.25;
export const TYPE_SCALE_STEP = 0.05;

/** Base point size for the slots that aren't auto-fitted. */
export const BASE_PT = { designation: 6, idNo: 6 } as const;

export const TYPE_SLOT_LABELS: Record<CardTypeSlot, string> = {
  name: "Name",
  designation: "Designation",
  idNo: "ID number",
};

export function clampScale(value: number) {
  if (!Number.isFinite(value)) return 1;
  // Snap to the step, then to 2dp — stepping in 0.05 otherwise accumulates
  // float noise (1.1500000000000001) into stored JSON and equality checks.
  const stepped = Math.round(value / TYPE_SCALE_STEP) * TYPE_SCALE_STEP;
  const rounded = Math.round(stepped * 100) / 100;
  return Math.min(TYPE_SCALE_MAX, Math.max(TYPE_SCALE_MIN, rounded));
}

/** Tolerant of missing, malformed or out-of-range stored values. */
export function parseTypeScale(raw?: string | null): CardTypeScale {
  if (!raw) return { ...DEFAULT_TYPE_SCALE };
  try {
    const parsed = JSON.parse(raw) as Partial<Record<CardTypeSlot, unknown>>;
    return {
      name: clampScale(Number(parsed.name ?? 1)),
      designation: clampScale(Number(parsed.designation ?? 1)),
      idNo: clampScale(Number(parsed.idNo ?? 1)),
    };
  } catch {
    return { ...DEFAULT_TYPE_SCALE };
  }
}

/** `null` when everything is default, so untouched records stay clean. */
export function serializeTypeScale(scale: CardTypeScale): string | null {
  const clamped: CardTypeScale = {
    name: clampScale(scale.name),
    designation: clampScale(scale.designation),
    idNo: clampScale(scale.idNo),
  };
  const isDefault = (Object.keys(clamped) as CardTypeSlot[]).every(
    (k) => Math.abs(clamped[k] - 1) < 0.001,
  );
  return isDefault ? null : JSON.stringify(clamped);
}

/** Point size a slot ends up at, for showing the operator real numbers. */
export function scaledPt(basePt: number, scale: number) {
  return Math.round(basePt * scale * 10) / 10;
}
