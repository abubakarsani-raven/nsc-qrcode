"use client";

import { MinusIcon, PlusIcon } from "lucide-react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import Divider from "@mui/material/Divider";
import FormControlLabel from "@mui/material/FormControlLabel";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import type { FrontLayout } from "@/lib/id-card/card-layout";
import {
  DEFAULT_TEXT_SETTINGS,
  TYPE_SCALE_MAX,
  TYPE_SCALE_MIN,
  TYPE_SCALE_STEP,
  TYPE_SLOT_LABELS,
  clampScale,
  isDefaultTextSettings,
  scaledPt,
  type CardTextSettings,
  type CardTypeSlot,
} from "@/lib/id-card/type-scale";
import { monoFont } from "@/theme/mui-theme";

type Props = {
  value: CardTextSettings;
  onChange: (next: CardTextSettings) => void;
  /** Current layout — supplies real point sizes and overflow state. */
  layout: FrontLayout;
};

const NAME_SLOTS: CardTypeSlot[] = ["surname", "otherNames"];
const OTHER_SLOTS: CardTypeSlot[] = ["designation", "idNo"];

const stepSx = { border: 1, borderColor: "var(--md-outline)", color: "primary.main" } as const;

function overflowMessage(layout: FrontLayout) {
  if (layout.surname.overflow) {
    return "The surname is wider than its space on the card. Reduce the surname size or tighten the spacing.";
  }
  if (layout.otherNames.overflow) {
    return "The other names are wider than their space on the card. Reduce their size or tighten the spacing.";
  }
  if (layout.name.tooTall) {
    return "The two name lines are too tall and run into the rest of the card. Reduce the surname or other names size.";
  }
  return "The designation or ID number is wider than its space on the card. Reduce its size.";
}

/**
 * Point-size nudges and long-name controls for the card's dynamic text.
 * Operators think in points, so each row shows the resulting size.
 */
export function TypeScaleControl({ value, onChange, layout }: Props) {
  function step(slot: CardTypeSlot, direction: 1 | -1) {
    onChange({
      ...value,
      scale: {
        ...value.scale,
        [slot]: clampScale(value.scale[slot] + direction * TYPE_SCALE_STEP),
      },
    });
  }

  const overflow = layout.name.overflow || layout.designation.overflow || layout.idNo.overflow;

  function row(slot: CardTypeSlot) {
    const pt = scaledPt(layout.basePt[slot], value.scale[slot]);
    return (
      <Stack key={slot} direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
        <Typography variant="body2" sx={{ flex: 1 }}>
          {TYPE_SLOT_LABELS[slot]}
        </Typography>
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ fontFamily: monoFont, width: 64, textAlign: "right" }}
        >
          {pt.toFixed(1)} pt
        </Typography>
        <IconButton
          size="small"
          sx={stepSx}
          onClick={() => step(slot, -1)}
          disabled={value.scale[slot] <= TYPE_SCALE_MIN}
          aria-label={`Decrease ${TYPE_SLOT_LABELS[slot]} size`}
        >
          <MinusIcon className="size-4" />
        </IconButton>
        <Typography variant="body2" sx={{ fontFamily: monoFont, width: 44, textAlign: "center" }}>
          {Math.round(value.scale[slot] * 100)}%
        </Typography>
        <IconButton
          size="small"
          sx={stepSx}
          onClick={() => step(slot, 1)}
          disabled={value.scale[slot] >= TYPE_SCALE_MAX}
          aria-label={`Increase ${TYPE_SLOT_LABELS[slot]} size`}
        >
          <PlusIcon className="size-4" />
        </IconButton>
      </Stack>
    );
  }

  return (
    <Box
      component="fieldset"
      sx={{ border: 1, borderColor: "divider", borderRadius: 3, p: 2, m: 0, minWidth: 0 }}
    >
      <Typography component="legend" variant="overline" color="text.secondary" sx={{ px: 0.5 }}>
        Card text
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        The surname prints on the top line and the other names below it. Each line shrinks to fit
        on its own; nudge either size here — the preview and the printed PDF follow the same
        settings.
      </Typography>

      <Typography variant="overline" color="text.secondary" component="p">
        Name
      </Typography>
      <Stack spacing={1}>{NAME_SLOTS.map(row)}</Stack>
      <FormControlLabel
        sx={{ display: "flex", mt: 0.5 }}
        control={
          <Checkbox
            size="small"
            checked={value.tightName}
            onChange={(e) => onChange({ ...value, tightName: e.target.checked })}
          />
        }
        label={<Typography variant="body2">Tighter letter-spacing on both name lines</Typography>}
      />

      <Divider sx={{ my: 1.5 }} />
      <Stack spacing={1}>{OTHER_SLOTS.map(row)}</Stack>

      {overflow ? (
        <Alert severity="warning" sx={{ mt: 1.5 }}>
          {overflowMessage(layout)}
        </Alert>
      ) : null}

      {!isDefaultTextSettings(value) ? (
        <Button
          size="small"
          variant="text"
          sx={{ mt: 1.5, ml: -1 }}
          onClick={() =>
            onChange({ ...DEFAULT_TEXT_SETTINGS, scale: { ...DEFAULT_TEXT_SETTINGS.scale } })
          }
        >
          Reset to defaults
        </Button>
      ) : null}
    </Box>
  );
}
