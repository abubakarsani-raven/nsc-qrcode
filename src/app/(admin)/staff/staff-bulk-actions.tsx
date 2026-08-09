"use client";

import { useState } from "react";

export function StaffBulkActions({
  staff,
}: {
  staff: { id: string; label: string }[];
}) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function exportMode(mode: string) {
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/staff/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: staff.map((s) => s.id), mode }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setMsg(data.error || "Export failed");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "nsc-id-cards.pdf";
      a.click();
      URL.revokeObjectURL(url);
      setMsg("Download started");
    } finally {
      setBusy(false);
    }
  }

  if (!staff.length) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="text-neutral-600">Export filtered ({staff.length}):</span>
      <button
        disabled={busy}
        onClick={() => exportMode("batch")}
        className="rounded-md border px-2 py-1 hover:bg-white"
      >
        Batch PDF
      </button>
      <button
        disabled={busy}
        onClick={() => exportMode("impose-a4")}
        className="rounded-md border px-2 py-1 hover:bg-white"
      >
        Impose A4
      </button>
      <button
        disabled={busy}
        onClick={() => exportMode("impose-a3")}
        className="rounded-md border px-2 py-1 hover:bg-white"
      >
        Impose A3
      </button>
      {msg ? <span className="text-neutral-500">{msg}</span> : null}
    </div>
  );
}
