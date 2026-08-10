import type {
  BackTemplateId,
  FrontTemplateId,
} from "@/lib/id-card/slots.generated";

/** Human labels for template dropdowns (avoid raw ENUM_CASE noise). */
export const FRONT_TEMPLATE_LABELS: Record<FrontTemplateId, string> = {
  WAVE_GREEN: "Wave · Green",
  WAVE_BLUE: "Wave · Blue",
  BAR_BLUE_SQUARE: "Bar · Blue · Square",
  BAR_BLUE_CIRCLE: "Bar · Blue · Circle",
  BAR_GREEN_CIRCLE: "Bar · Green · Circle",
  BAR_GREEN_SQUARE: "Bar · Green · Square",
};

export const BACK_TEMPLATE_LABELS: Record<BackTemplateId, string> = {
  BACK_WAVE_GREEN: "Wave · Green",
  BACK_WAVE_BLUE: "Wave · Blue",
  BACK_BAR_BLUE: "Bar · Blue",
  BACK_BAR_GREEN: "Bar · Green",
};
