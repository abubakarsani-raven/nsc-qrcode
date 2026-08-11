"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function StaffBulkActions({
  staff,
}: {
  staff: { id: string; label: string }[];
}) {
  const [busy, setBusy] = useState(false);

  async function exportMode(mode: string) {
    setBusy(true);
    try {
      const res = await fetch("/api/staff/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: staff.map((s) => s.id), mode }),
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

  if (!staff.length) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 text-[13px]">
      <span className="text-[var(--nsc-secondary)]">
        Export these {staff.length} result{staff.length === 1 ? "" : "s"}
      </span>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={busy}
        onClick={() => exportMode("batch")}
        className="rounded-full"
      >
        Batch PDF
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={busy}
        onClick={() => exportMode("impose-a4")}
        className="rounded-full"
      >
        Impose A4
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={busy}
        onClick={() => exportMode("impose-a3")}
        className="rounded-full"
      >
        Impose A3
      </Button>
    </div>
  );
}
