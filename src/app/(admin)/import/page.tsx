"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { parseCsvRows } from "@/lib/csv";
import { errorMessage, networkMessage, readJson } from "@/lib/client-api";
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
      const cols = (parseCsvRows(text)[0] ?? []).map((c) => c.trim()).filter(Boolean);
      setHeaders(cols);
      const auto: Record<string, string> = {};
      for (const field of FIELDS) {
        const norm = (v: string) => v.toLowerCase().replace(/[^a-z]/g, "");
        const hit = cols.find(
          (c) => norm(c) === norm(field) || norm(c) === norm(FIELD_LABELS[field]),
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
      const data = await readJson<ImportResult>(res);
      setResult(data);
      if (!res.ok) {
        toast.error(errorMessage(res, data, "Import blocked — fix errors and try again"));
        return;
      }
      if (dryRun) {
        toast.success(
          `${data.validCount ?? 0} ready · ${data.errorCount ?? 0} issues`,
        );
      } else {
        toast.success(`Imported ${data.createdCount ?? 0} staff records`);
      }
    } catch (error) {
      toast.error(networkMessage(error, "Import failed"));
    } finally {
      setBusy(false);
    }
  }

  const headerItems = Object.fromEntries(
    [["__none__", "—"], ...headers.map((h) => [h, h])] as [string, string][],
  );

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="nsc-page-title">Import</h1>
        <p className="nsc-page-sub">
          Dry-run first. Imported rows stay pending until photos are added.
        </p>
      </div>

      <div className="md-card space-y-6 p-4 sm:p-6">
        <div>
          <Label htmlFor="import-file" className="md-field-label">
            Spreadsheet
          </Label>
          <input
            id="import-file"
            type="file"
            accept=".csv,.xlsx"
            className="mt-2 block w-full text-sm text-[var(--md-on-surface-variant)] file:mr-3 file:h-10 file:rounded-full file:border file:border-[var(--md-outline)] file:bg-transparent file:px-4 file:text-sm file:font-medium file:text-[var(--md-primary)]"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onFile(f);
            }}
          />
          {file ? (
            <p className="md-supporting-text">{file.name}</p>
          ) : null}
        </div>

        <div className="space-y-3">
          <p className="md-title-medium">Column mapping</p>
          {FIELDS.map((field) => (
            <div
              key={field}
              className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3"
            >
              <span className="md-body-medium w-48 shrink-0 text-[var(--md-on-surface-variant)]">
                {FIELD_LABELS[field]}
                {REQUIRED.has(field) ? (
                  <span className="text-[var(--md-error)]"> *</span>
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
                  className="md-field mt-0 flex-1"
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

        <div className="flex flex-wrap gap-2 border-t border-[var(--md-outline-variant)] pt-5">
          <Button
            type="button"
            variant="outline"
            disabled={!file || busy}
            onClick={() => run(true)}
          >
            Dry run
          </Button>
          <Button
            type="button"
            disabled={!file || busy}
            onClick={() => run(false)}
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
      <div className="rounded-[var(--md-shape-md)] bg-[var(--md-error-container)] p-4 text-[var(--md-on-error-container)]">
        <p className="md-title-small text-[var(--md-on-error-container)]">
          Import failed
        </p>
        <p className="md-body-medium mt-1">{result.error}</p>
      </div>
    );
  }

  const created = result.createdCount ?? 0;
  const valid = result.validCount ?? created;
  const errors = result.errors ?? [];
  const errorCount = result.errorCount ?? errors.length;

  return (
    <div className="md-card space-y-5 p-4 sm:p-6">
      <div>
        <h2 className="md-title-medium">
          {result.dryRun
            ? "Dry run results"
            : result.blocked
              ? "Import blocked"
              : "Import complete"}
        </h2>
        <p className="md-body-medium mt-1 text-[var(--md-on-surface-variant)]">
          {result.rowCount ?? 0} rows in file · {valid} ready · {errorCount}{" "}
          {errorCount === 1 ? "issue" : "issues"}
          {!result.dryRun && !result.blocked ? ` · ${created} created` : ""}
        </p>
      </div>

      {errors.length > 0 ? (
        <div className="rounded-[var(--md-shape-md)] bg-[var(--md-error-container)] p-3 text-[var(--md-on-error-container)]">
          <p className="md-title-small text-[var(--md-on-error-container)]">
            Issues
          </p>
          <ul className="md-body-small mt-2 max-h-48 space-y-1 overflow-auto text-[var(--md-on-error-container)]">
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
          <p className="md-title-small">Preview (first rows)</p>
          <ul className="md-body-small mt-2 max-h-40 space-y-1 overflow-auto">
            {result.preview.slice(0, 8).map((p) => (
              <li key={p.idNumber}>
                {p.lastName} {p.firstName} · {p.idNumber} · {p.designation}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {!result.dryRun && !result.blocked && created > 0 ? (
        <div className="flex flex-wrap gap-2 border-t border-[var(--md-outline-variant)] pt-5">
          <Link href="/staff?missingPhoto=1">
            <Button>Open photo queue</Button>
          </Link>
          <Link href="/staff?approvalState=PENDING">
            <Button variant="outline">View pending</Button>
          </Link>
        </div>
      ) : null}
    </div>
  );
}
