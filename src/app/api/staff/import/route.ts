import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { generateQrToken, publicVerifyUrl, assertUrlBudget } from "@/lib/qr";
import { defaultBackFor } from "@/lib/staff";
import { parseCsv } from "@/lib/csv";
import { prismaErrorResponse } from "@/lib/api";

/** Parsing + validating a large sheet can exceed the default 10s on Vercel. */
export const maxDuration = 60;

const MAX_BYTES = 5 * 1024 * 1024;
const MAX_ROWS = 2000;

const IMPORT_FIELDS = [
  "idNumber",
  "firstName",
  "middleName",
  "lastName",
  "designation",
  "officeLine",
  "emergencyContactName",
  "emergencyContactPhone",
] as const;
type ImportField = (typeof IMPORT_FIELDS)[number];

const mappingSchema = z.partialRecord(z.enum(IMPORT_FIELDS), z.string().max(200));

function cellText(v: ExcelJS.CellValue): string {
  if (v == null) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object") {
    if ("richText" in v && Array.isArray(v.richText)) {
      return v.richText.map((r) => r.text).join("");
    }
    if ("text" in v) return String(v.text ?? "");
    if ("result" in v) return String(v.result ?? "");
    if ("error" in v) return "";
  }
  return String(v);
}

async function readXlsx(buf: Buffer): Promise<Record<string, string>[] | null> {
  const wb = new ExcelJS.Workbook();
  // exceljs typings expect its own Buffer type; Node's Buffer is fine at runtime.
  await wb.xlsx.load(buf as unknown as ExcelJS.Buffer);
  const sheet = wb.worksheets[0];
  if (!sheet) return null;
  const headers: string[] = [];
  sheet.getRow(1).eachCell((cell, col) => {
    headers[col] = cellText(cell.value).trim();
  });
  const rows: Record<string, string>[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const obj: Record<string, string> = {};
    row.eachCell((cell, col) => {
      const h = headers[col];
      if (h) obj[h] = cellText(cell.value).trim();
    });
    if (Object.values(obj).some(Boolean)) rows.push(obj);
  });
  return rows;
}

const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });

export async function POST(req: NextRequest) {
  const gate = await requirePermission("createEdit");
  if (gate.error) return gate.error;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return bad("Upload a CSV or XLSX file");
  }
  const file = form.get("file");
  const mappingRaw = form.get("mapping");
  const dryRun = form.get("dryRun") === "1" || form.get("dryRun") === "true";

  if (!(file instanceof File)) return bad("Choose a file to import");
  if (file.size > MAX_BYTES) return bad("File is larger than 5 MB — split it into smaller files", 413);
  if (typeof mappingRaw !== "string") return bad("Column mapping is missing");

  let mapping: Partial<Record<ImportField, string>>;
  try {
    mapping = mappingSchema.parse(JSON.parse(mappingRaw));
  } catch {
    return bad("Column mapping is invalid");
  }

  const name = file.name.toLowerCase();
  const buf = Buffer.from(await file.arrayBuffer());
  let rows: Record<string, string>[];
  try {
    if (name.endsWith(".csv")) {
      rows = parseCsv(buf.toString("utf8")).rows;
    } else if (name.endsWith(".xlsx")) {
      const parsed = await readXlsx(buf);
      if (!parsed) return bad("The workbook has no sheets");
      rows = parsed;
    } else {
      return bad("Only .csv and .xlsx files are supported (save .xls files as .xlsx)", 415);
    }
  } catch (err) {
    console.error("[import] could not parse file:", err);
    return bad("Could not read that file — check it is a valid CSV or XLSX");
  }
  if (!rows.length) return bad("No data rows found under the header row");
  if (rows.length > MAX_ROWS) {
    return bad(`At most ${MAX_ROWS} rows per import (this file has ${rows.length})`, 413);
  }

  const fieldOf = (row: Record<string, string>, field: ImportField) => {
    const col = mapping[field];
    return col ? (row[col] ?? "").trim() : "";
  };

  // One query for every ID in the file instead of one per row.
  const fileIds = rows.map((r) => fieldOf(r, "idNumber")).filter(Boolean);
  const existing = new Map(
    (
      await prisma.staff.findMany({
        where: { idNumber: { in: fileIds } },
        select: { id: true, idNumber: true },
      })
    ).map((s) => [s.idNumber, s.id]),
  );

  const errors: { row: number; error: string }[] = [];
  const preview: Record<ImportField, string>[] = [];
  const seen = new Set<string>();

  rows.forEach((row, i) => {
    const line = i + 2; // 1-based, after the header row
    const rec = Object.fromEntries(IMPORT_FIELDS.map((f) => [f, fieldOf(row, f)])) as Record<
      ImportField,
      string
    >;
    const missing = (["idNumber", "firstName", "lastName", "designation"] as const).filter(
      (f) => !rec[f],
    );
    if (missing.length) {
      errors.push({ row: line, error: `Missing ${missing.join(", ")}` });
      return;
    }
    if (seen.has(rec.idNumber)) {
      errors.push({ row: line, error: `Duplicate ID ${rec.idNumber} in this file` });
      return;
    }
    seen.add(rec.idNumber);
    if (existing.has(rec.idNumber)) {
      errors.push({ row: line, error: `ID ${rec.idNumber} already exists` });
      return;
    }
    preview.push(rec);
  });

  if (dryRun) {
    return NextResponse.json({
      dryRun: true,
      rowCount: rows.length,
      validCount: preview.length,
      errorCount: errors.length,
      errors,
      preview: preview.slice(0, 50),
    });
  }

  if (errors.length) {
    return NextResponse.json(
      {
        dryRun: false,
        blocked: true,
        error: `${errors.length} row${errors.length === 1 ? "" : "s"} need fixing before import`,
        rowCount: rows.length,
        validCount: preview.length,
        errorCount: errors.length,
        errors,
      },
      { status: 400 },
    );
  }

  const actorId = gate.session.user.id;
  const back = defaultBackFor("WAVE_GREEN");
  const data = preview.map((p) => {
    const qrToken = generateQrToken();
    assertUrlBudget(publicVerifyUrl(qrToken));
    return {
      idNumber: p.idNumber,
      firstName: p.firstName,
      middleName: p.middleName || null,
      lastName: p.lastName,
      designation: p.designation,
      officeLine: p.officeLine || null,
      emergencyContactName: p.emergencyContactName || null,
      emergencyContactPhone: p.emergencyContactPhone || null,
      frontTemplate: "WAVE_GREEN" as const,
      backTemplate: back,
      qrToken,
      approvalState: "PENDING" as const,
    };
  });

  try {
    // All-or-nothing: a failure mid-way never leaves a partial import behind.
    const batch = await prisma.$transaction(async (tx) => {
      const created = await tx.staff.createMany({ data });
      const batch = await tx.importBatch.create({
        data: {
          filename: file.name,
          actorId,
          rowCount: rows.length,
          createdCount: created.count,
          errorCount: 0,
          report: JSON.stringify({ createdCount: created.count }),
        },
      });
      await tx.auditEvent.create({
        data: {
          actorId,
          type: "IMPORTED",
          metadata: JSON.stringify({ batchId: batch.id, createdCount: created.count }),
        },
      });
      return batch;
    });
    return NextResponse.json({ batch, createdCount: batch.createdCount });
  } catch (err) {
    // Someone created one of these IDs between validation and insert.
    const mapped = prismaErrorResponse(err);
    if (mapped) return mapped;
    throw err;
  }
}
