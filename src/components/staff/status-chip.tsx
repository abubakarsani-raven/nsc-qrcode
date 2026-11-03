"use client";

import Chip from "@mui/material/Chip";

export type StatusInput = {
  status: "ACTIVE" | "SUSPENDED";
  approvalState: "PENDING" | "APPROVED";
  hasPendingEdits: boolean;
  hasPhoto: boolean;
};

/** Only the exceptions carry colour; a ready card is plain text. */
export function StatusChip({ s }: { s: StatusInput }) {
  if (s.status === "SUSPENDED") {
    return <Chip size="small" color="error" label="Suspended" />;
  }
  const attention = s.hasPendingEdits
    ? "Edits pending"
    : !s.hasPhoto
      ? "No photo"
      : s.approvalState !== "APPROVED"
        ? "Pending"
        : null;
  if (attention) {
    return (
      <Chip
        size="small"
        label={attention}
        sx={{ bgcolor: "var(--md-warning-container)", color: "var(--md-on-warning-container)" }}
      />
    );
  }
  return (
    <Chip
      size="small"
      variant="outlined"
      label="Ready"
      sx={{ borderColor: "var(--md-outline-variant)", color: "text.secondary" }}
    />
  );
}
