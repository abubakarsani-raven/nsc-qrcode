"use client";

import { CheckIcon } from "lucide-react";
import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import {
  BACK_TEMPLATES,
  BACK_TEMPLATE_IDS,
  FRONT_TEMPLATES,
  FRONT_TEMPLATE_IDS,
  type BackTemplateId,
  type Brand,
  type FrontTemplateId,
} from "@/lib/id-card/slots.generated";
import {
  BACK_TEMPLATE_LABELS,
  BRAND_LABELS,
  FRONT_TEMPLATE_LABELS,
} from "@/lib/id-card/template-labels";

const BRANDS: Brand[] = ["NSC", "NPERA"];

function Tile({
  id,
  label,
  selected,
  onClick,
  width,
}: {
  id: string;
  label: string;
  selected: boolean;
  onClick: () => void;
  width: number;
}) {
  return (
    <ButtonBase
      onClick={onClick}
      aria-pressed={selected}
      sx={{
        flexDirection: "column",
        alignItems: "stretch",
        gap: 0.75,
        p: 0.75,
        width,
        borderRadius: 2,
        border: 2,
        borderColor: selected ? "primary.main" : "transparent",
        bgcolor: selected ? "var(--md-primary-container)" : "transparent",
        transition: "background-color 120ms, border-color 120ms",
        "&:hover": {
          bgcolor: selected ? "var(--md-primary-container)" : "var(--md-surface-container-low)",
        },
        "&.Mui-focusVisible": { outline: "2px solid var(--md-tertiary)", outlineOffset: 2 },
      }}
    >
      <Box sx={{ position: "relative" }}>
        <Box
          component="img"
          src={`/id-card/templates/thumbs/${id}.webp`}
          alt=""
          sx={{
            display: "block",
            width: "100%",
            borderRadius: 1,
            boxShadow: "0 0 0 1px var(--md-outline-variant)",
          }}
        />
        {selected ? (
          <Box
            sx={{
              position: "absolute",
              top: 4,
              right: 4,
              width: 20,
              height: 20,
              borderRadius: "50%",
              bgcolor: "primary.main",
              color: "primary.contrastText",
              display: "grid",
              placeItems: "center",
            }}
          >
            <CheckIcon className="size-3.5" strokeWidth={3} />
          </Box>
        ) : null}
      </Box>
      <Typography variant="caption" sx={{ lineHeight: 1.3, textAlign: "center", fontWeight: 500 }}>
        {label}
      </Typography>
    </ButtonBase>
  );
}

/** Card-design picker: fronts grouped by brand, then the backs that match. */
export function TemplatePicker({
  front,
  back,
  onFront,
  onBack,
}: {
  front: FrontTemplateId;
  back: BackTemplateId;
  onFront: (id: FrontTemplateId) => void;
  onBack: (id: BackTemplateId) => void;
}) {
  const brand = FRONT_TEMPLATES[front].brand;
  const backs = BACK_TEMPLATE_IDS.filter((id) => BACK_TEMPLATES[id].brand === brand);

  return (
    <Stack spacing={2}>
      {BRANDS.map((b) => (
        <Box key={b}>
          <Typography variant="overline" color="text.secondary" component="p" sx={{ mb: 0.5 }}>
            {BRAND_LABELS[b]}
          </Typography>
          <Stack direction="row" useFlexGap sx={{ flexWrap: "wrap", gap: 1 }}>
            {FRONT_TEMPLATE_IDS.filter((id) => FRONT_TEMPLATES[id].brand === b).map((id) => (
              <Tile
                key={id}
                id={id}
                label={FRONT_TEMPLATE_LABELS[id].replace(/^NPERA · /, "")}
                selected={front === id}
                onClick={() => onFront(id)}
                width={92}
              />
            ))}
          </Stack>
        </Box>
      ))}
      <Box>
        <Typography variant="overline" color="text.secondary" component="p" sx={{ mb: 0.5 }}>
          Back
        </Typography>
        <Stack direction="row" useFlexGap sx={{ flexWrap: "wrap", gap: 1 }}>
          {backs.map((id) => (
            <Tile
              key={id}
              id={id}
              label={BACK_TEMPLATE_LABELS[id]}
              selected={back === id}
              onClick={() => onBack(id)}
              width={80}
            />
          ))}
        </Stack>
      </Box>
    </Stack>
  );
}
