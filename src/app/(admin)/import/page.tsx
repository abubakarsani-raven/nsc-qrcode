"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

const FIELD_LABELS: Record<(typeof FIELDS)[number], string> = {
  idNumber: "ID number",
  firstName: "First name",
  middleName: "Middle name",
  lastName: "Surname",
  designation: "Designation",
  officeLine: "Office line",
  emergencyContactName: "Emergency contact",
  emergencyContactPhone: "Emergency phone",
};

const REQUIRED = new Set(["idNumber", "firstName", "lastName", "designation"]);

type ImportResult = {
  dryRun?: boolean;
  blocked?: boolean;
  rowCount?: number;
  validCount?: number;
  errorCount?: number;
  createdCount?: number;
  errors?: { row: number; error: string }[];
  preview?: Record<string, string>[];
  error?: string;
  batch?: { id: string; filename: string };
};

export default function ImportPage() {
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
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
      const data = (await res.json()) as ImportResult;
      setResult(data);
      if (!res.ok) {
        toast.error(data.error || "Import blocked — fix errors and try again");
        return;
      }
      if (dryRun) {
        toast.success(
          `${data.validCount ?? 0} ready · ${data.errorCount ?? 0} issues`,
        );
      } else {
        toast.success(`Imported ${data.createdCount ?? 0} staff records`);
      }
    } finally {
      setBusy(false);
    }
  }

  const headerItems = Object.fromEntries(
    [["__none__", "—"], ...headers.map((h) => [h, h])] as [string, string][],
  );

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
          <p className="text-[15px] font-semibold tracking-tight">
            Column mapping
          </p>
          {FIELDS.map((field) => (
            <div
              key={field}
              className="flex flex-col gap-1.5 text-[13px] sm:flex-row sm:items-center sm:gap-3"
            >
              <span className="w-48 shrink-0 text-[var(--nsc-secondary)]">
                {FIELD_LABELS[field]}
                {REQUIRED.has(field) ? (
                  <span className="text-[#c41e16]"> *</span>
                ) : null}
              </span>
              {headers.length ? (
                <Select
                  value={mapping[field] || "__none__"}
                  onValueChange={(value) => {
                    setMapping((m) => ({
                      ...m,
                      [field]:
                        value == null || value === "__none__" ? "" : value,
                    }));
                  }}
                  items={headerItems}
                >
                  <SelectTrigger className="w-full flex-1">
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">—</SelectItem>
                    {headers.map((h) => (
                      <SelectItem key={h} value={h}>
                        {h}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
            </div>
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
            {busy ? "Working…" : "Import"}
          </Button>
        </div>
      </div>

      {result ? <ImportSummary result={result} /> : null}
    </div>
  );
}

function ImportSummary({ result }: { result: ImportResult }) {
  if (result.error && !result.rowCount) {
    return (
      <div className="nsc-surface border border-[#ffeceb] bg-[#ffeceb]/40 p-5">
        <p className="font-semibold text-[#c41e16]">Import failed</p>
        <p className="mt-1 text-[13px] text-[#c41e16]">{result.error}</p>
      </div>
    );
  }

  const created = result.createdCount ?? 0;
  const valid = result.validCount ?? created;
  const errors = result.errors ?? [];
  const errorCount = result.errorCount ?? errors.length;

  return (
    <div className="nsc-surface space-y-4 p-5 sm:p-6">
      <div>
        <h2 className="text-[17px] font-semibold tracking-tight">
          {result.dryRun
            ? "Dry run results"
            : result.blocked
              ? "Import blocked"
              : "Import complete"}
        </h2>
        <p className="mt-1 text-[13px] text-[var(--nsc-secondary)]">
          {result.rowCount ?? 0} rows in file · {valid} ready · {errorCount}{" "}
          {errorCount === 1 ? "issue" : "issues"}
          {!result.dryRun && !result.blocked ? ` · ${created} created` : ""}
        </p>
      </div>

      {errors.length > 0 ? (
        <div className="rounded-xl bg-[#ffeceb]/50 p-3">
          <p className="text-[13px] font-semibold text-[#c41e16]">Issues</p>
          <ul className="mt-2 max-h-48 space-y-1 overflow-auto text-[12px] text-[#c41e16]">
            {errors.slice(0, 40).map((e, i) => (
              <li key={`${e.row}-${i}`}>
                Row {e.row}: {e.error}
              </li>
            ))}
            {errors.length > 40 ? (
              <li>…and {errors.length - 40} more</li>
            ) : null}
          </ul>
        </div>
      ) : null}

      {result.preview && result.preview.length > 0 ? (
        <div>
          <p className="text-[13px] font-semibold">Preview (first rows)</p>
          <ul className="mt-2 max-h-40 space-y-1 overflow-auto text-[12px] text-[var(--nsc-secondary)]">
            {result.preview.slice(0, 8).map((p) => (
              <li key={p.idNumber}>
                {p.lastName} {p.firstName} · {p.idNumber} · {p.designation}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {!result.dryRun && !result.blocked && created > 0 ? (
        <div className="flex flex-wrap gap-2 border-t border-[var(--nsc-separator)] pt-4">
          <Link href="/staff?missingPhoto=1">
            <Button className="rounded-full bg-[var(--nsc-green)] hover:bg-[var(--nsc-green-hover)]">
              Open photo queue
            </Button>
          </Link>
          <Link href="/staff?approvalState=PENDING">
            <Button variant="outline" className="rounded-full">
              View pending
            </Button>
          </Link>
        </div>
      ) : null}
    </div>
  );
}
