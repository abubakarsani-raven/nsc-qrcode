"use client";

import { useState } from "react";
import { toast } from "sonner";
import { downloadBlob, errorMessage, networkMessage, readJson } from "@/lib/client-api";
import { useLoading } from "@/lib/loading-context";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

type Props = {
  /** Every record the filters match, across all pages. */
  matchingIds: string[];
  /** Rows ticked in the table; when set, exports cover only these. */
  selectedIds: string[];
  onClearSelection: () => void;
};

export function StaffBulkActions({ matchingIds, selectedIds, onClearSelection }: Props) {
  const [busy, setBusy] = useState(false);
  const { startLoading, stopLoading } = useLoading();
  const ids = selectedIds.length ? selectedIds : matchingIds;

  async function exportMode(mode: string) {
    setBusy(true);
    // Roughly a third of a second per card to render.
    startLoading(`Rendering ${ids.length} card${ids.length === 1 ? "" : "s"}…`, Math.max(5, ids.length * 0.35));
    try {
      const res = await fetch("/api/staff/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, mode }),
      });
      if (!res.ok) {
        toast.error(errorMessage(res, await readJson(res), "Export failed"));
        return;
      }
      const stamp = new Date().toISOString().slice(0, 10);
      downloadBlob(await res.blob(), `nsc-id-cards-${mode}-${stamp}.pdf`);
      toast.success("PDF download started");
    } catch (error) {
      toast.error(networkMessage(error, "Export failed"));
    } finally {
      stopLoading();
      setBusy(false);
    }
  }

  if (!matchingIds.length) return null;

  return (
    <Stack
      direction="row"
      spacing={1}
      useFlexGap
      sx={{ flexWrap: "wrap", alignItems: "center", pb: 1.5 }}
    >
      <Typography variant="overline" color="text.secondary" sx={{ mr: 0.5, lineHeight: 2 }}>
        {selectedIds.length
          ? `Export ${selectedIds.length} selected`
          : `Export all ${matchingIds.length} matching`}
      </Typography>
      <Button variant="outlined" size="small" disabled={busy} onClick={() => exportMode("batch")}>
        Batch PDF
      </Button>
      <Button
        variant="outlined"
        size="small"
        disabled={busy}
        onClick={() => exportMode("impose-a4")}
      >
        Impose A4
      </Button>
      <Button
        variant="outlined"
        size="small"
        disabled={busy}
        onClick={() => exportMode("impose-a3")}
      >
        Impose A3
      </Button>
      {selectedIds.length ? (
        <Button variant="text" size="small" onClick={onClearSelection}>
          Clear selection
        </Button>
      ) : null}
    </Stack>
  );
}
