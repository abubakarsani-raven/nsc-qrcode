"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function StaffBulkActions({ ids }: { ids: string[] }) {
  const [busy, setBusy] = useState(false);

  async function exportMode(mode: string) {
    setBusy(true);
    try {
      const res = await fetch("/api/staff/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, mode }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Export failed");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "nsc-id-cards.pdf";
      a.click();
      URL.revokeObjectURL(url);
      toast.success("PDF download started");
    } finally {
      setBusy(false);
    }
  }

  if (!ids.length) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 pb-3">
      <span className="md-eyebrow mr-1">
        Export all {ids.length} matching
      </span>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={busy}
        onClick={() => exportMode("batch")}
      >
        Batch PDF
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={busy}
        onClick={() => exportMode("impose-a4")}
      >
        Impose A4
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={busy}
        onClick={() => exportMode("impose-a3")}
      >
        Impose A3
      </Button>
    </div>
  );
}
