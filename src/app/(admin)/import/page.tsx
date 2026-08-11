"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

const FIELDS = [
  "idNumber",
  "firstName",
  "middleName",
  "lastName",
  "designation",
  "officeLine",
  "emergencyContactName",
  "emergencyContactPhone",
] as const;

export default function ImportPage() {
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [busy, setBusy] = useState(false);

  async function onFile(f: File) {
    setFile(f);
    setResult(null);
    if (f.name.endsWith(".csv")) {
      const text = await f.text();
      const first = text.split(/\r?\n/)[0] ?? "";
      const cols = first.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
      setHeaders(cols);
      const auto: Record<string, string> = {};
      for (const field of FIELDS) {
        const hit = cols.find(
          (c) => c.toLowerCase().replace(/\s+/g, "") === field.toLowerCase(),
        );
        if (hit) auto[field] = hit;
      }
      setMapping(auto);
    } else {
      setHeaders([]);
      setMapping({
        idNumber: "idNumber",
        firstName: "firstName",
        lastName: "lastName",
        designation: "designation",
      });
    }
  }

  async function run(dryRun: boolean) {
    if (!file) return;
    setBusy(true);
    setResult(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("mapping", JSON.stringify(mapping));
      fd.append("dryRun", dryRun ? "1" : "0");
      const res = await fetch("/api/staff/import", { method: "POST", body: fd });
      const data = await res.json();
      setResult(data);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="nsc-page-title">Import</h1>
        <p className="nsc-page-sub">
          Dry-run first. Imported rows stay pending until photos are added.
        </p>
      </div>

      <div className="nsc-surface space-y-5 p-5 sm:p-6">
        <div className="space-y-1.5">
          <Label htmlFor="import-file">Spreadsheet</Label>
          <input
            id="import-file"
            type="file"
            accept=".csv,.xlsx"
            className="block w-full text-[13px] text-[var(--nsc-secondary)] file:mr-3 file:rounded-full file:border-0 file:bg-[var(--nsc-fill)] file:px-3 file:py-1.5 file:text-[13px] file:font-medium file:text-[var(--nsc-ink)]"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onFile(f);
            }}
          />
          {file ? (
            <p className="text-[12px] text-[var(--nsc-secondary)]">{file.name}</p>
          ) : null}
        </div>

        <div className="space-y-3">
          <p className="text-[15px] font-semibold tracking-tight">Column mapping</p>
          {FIELDS.map((field) => (
            <label key={field} className="flex flex-col gap-1.5 text-[13px] sm:flex-row sm:items-center sm:gap-3">
              <span className="w-48 shrink-0 text-[var(--nsc-secondary)]">{field}</span>
              {headers.length ? (
                <select
                  className="nsc-field flex-1"
                  value={mapping[field] ?? ""}
                  onChange={(e) =>
                    setMapping((m) => ({ ...m, [field]: e.target.value }))
                  }
                >
                  <option value="">—</option>
                  {headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  className="nsc-field flex-1"
                  placeholder="Exact spreadsheet header"
                  value={mapping[field] ?? ""}
                  onChange={(e) =>
                    setMapping((m) => ({ ...m, [field]: e.target.value }))
                  }
                />
              )}
            </label>
          ))}
        </div>

        <div className="flex flex-wrap gap-2 border-t border-[var(--nsc-separator)] pt-4">
          <Button
            type="button"
            variant="outline"
            disabled={!file || busy}
            onClick={() => run(true)}
            className="rounded-full"
          >
            Dry run
          </Button>
          <Button
            type="button"
            disabled={!file || busy}
            onClick={() => run(false)}
            className="rounded-full bg-[var(--nsc-green)] hover:bg-[var(--nsc-green-hover)]"
          >
            Import
          </Button>
        </div>
      </div>

      {result ? (
        <pre className="nsc-surface overflow-auto bg-[#1d1d1f] p-4 text-[12px] text-[#f5f5f7]">
          {JSON.stringify(result, null, 2)}
        </pre>
      ) : null}
    </div>
  );
}
