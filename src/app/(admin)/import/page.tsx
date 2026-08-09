"use client";

import { useState } from "react";

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
    // Quick header peek via dry-run with identity mapping after reading names client-side for xlsx is heavy;
    // ask user to type mapping against known headers from a dry run with empty mapping using first row.
    // Simpler: parse CSV headers locally; for xlsx user fills mapping with exact header names.
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
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-[#0d4720]">Spreadsheet import</h1>
        <p className="text-sm text-neutral-600">
          Dry-run first. Imported rows are PENDING with no photo (see Photo queue).
        </p>
      </div>

      <input
        type="file"
        accept=".csv,.xlsx"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
        }}
      />

      <div className="space-y-2 rounded-xl border bg-white p-4">
        <p className="text-sm font-medium">Column mapping</p>
        {FIELDS.map((field) => (
          <label key={field} className="flex items-center gap-3 text-sm">
            <span className="w-48 text-neutral-600">{field}</span>
            {headers.length ? (
              <select
                className="flex-1 rounded-md border px-2 py-1"
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
                className="flex-1 rounded-md border px-2 py-1"
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

      <div className="flex gap-2">
        <button
          disabled={!file || busy}
          onClick={() => run(true)}
          className="rounded-md border px-3 py-2 text-sm"
        >
          Dry run
        </button>
        <button
          disabled={!file || busy}
          onClick={() => run(false)}
          className="rounded-md bg-[#0d4720] px-3 py-2 text-sm text-white"
        >
          Import
        </button>
      </div>

      {result ? (
        <pre className="overflow-auto rounded-xl border bg-neutral-950 p-4 text-xs text-neutral-100">
          {JSON.stringify(result, null, 2)}
        </pre>
      ) : null}
    </div>
  );
}
