"use client";

import { MinusIcon, PlusIcon } from "lucide-react";
import {
  BASE_PT,
  TYPE_SCALE_MAX,
  TYPE_SCALE_MIN,
  TYPE_SCALE_STEP,
  TYPE_SLOT_LABELS,
  clampScale,
  scaledPt,
  type CardTypeScale,
  type CardTypeSlot,
} from "@/lib/id-card/type-scale";

type Props = {
  value: CardTypeScale;
  onChange: (next: CardTypeScale) => void;
  /** Fitted point size of the name at 100%, so the row can show real numbers. */
  nameBasePt: number;
  /** True when the name no longer fits its slot at the current size. */
  nameOverflows?: boolean;
};

const SLOTS: CardTypeSlot[] = ["name", "designation", "idNo"];

/**
 * Point-size nudges for the three dynamic slots on the card. Operators think
 * in points, so each row shows the resulting size next to the percentage.
 */
export function TypeScaleControl({
  value,
  onChange,
  nameBasePt,
  nameOverflows,
}: Props) {
  const isDefault = SLOTS.every((s) => Math.abs(value[s] - 1) < 0.001);

  function step(slot: CardTypeSlot, direction: 1 | -1) {
    onChange({
      ...value,
      [slot]: clampScale(value[slot] + direction * TYPE_SCALE_STEP),
    });
  }

  function basePt(slot: CardTypeSlot) {
    return slot === "name" ? nameBasePt : BASE_PT[slot];
  }

  const stepButton =
    "inline-flex size-8 shrink-0 items-center justify-center rounded-full border border-[var(--md-outline)] text-[var(--md-primary)] transition-colors hover:bg-[color-mix(in_srgb,var(--md-primary)_8%,transparent)] disabled:border-[color-mix(in_srgb,var(--md-on-surface)_12%,transparent)] disabled:text-[color-mix(in_srgb,var(--md-on-surface)_38%,transparent)]";

  return (
    <fieldset className="rounded-[var(--md-shape-md)] border border-[var(--md-outline-variant)] p-4">
      <legend className="md-field-label px-1">Card type size</legend>
      <p className="md-supporting-text mt-0 mb-3">
        Nudge a slot when a long name or title sits awkwardly. The preview and
        the printed PDF both follow these sizes.
      </p>

      <div className="space-y-2">
        {SLOTS.map((slot) => {
          const pt = scaledPt(basePt(slot), value[slot]);
          const percent = Math.round(value[slot] * 100);
          return (
            <div key={slot} className="flex items-center gap-3">
              <span className="md-body-medium flex-1">
                {TYPE_SLOT_LABELS[slot]}
              </span>
              <span className="md-data w-24 text-right text-[var(--md-on-surface-variant)]">
                {pt.toFixed(1)} pt
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className={stepButton}
                  onClick={() => step(slot, -1)}
                  disabled={value[slot] <= TYPE_SCALE_MIN}
                  aria-label={`Decrease ${TYPE_SLOT_LABELS[slot]} size`}
                >
                  <MinusIcon className="size-4" />
                </button>
                <span className="md-data w-12 text-center tabular-nums">
                  {percent}%
                </span>
                <button
                  type="button"
                  className={stepButton}
                  onClick={() => step(slot, 1)}
                  disabled={value[slot] >= TYPE_SCALE_MAX}
                  aria-label={`Increase ${TYPE_SLOT_LABELS[slot]} size`}
                >
                  <PlusIcon className="size-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {nameOverflows ? (
        <p className="md-body-medium mt-3 rounded-[var(--md-shape-xs)] bg-[var(--md-warning-container)] px-3 py-2 text-[var(--md-on-warning-container)]">
          The name is wider than its space on the card. Reduce the name size or
          shorten the middle name.
        </p>
      ) : null}

      {!isDefault ? (
        <button
          type="button"
          onClick={() =>
            onChange({ name: 1, designation: 1, idNo: 1 })
          }
          className="md-label-large mt-3 text-[var(--md-primary)] hover:underline"
        >
          Reset to default sizes
        </button>
      ) : null}
    </fieldset>
  );
}
