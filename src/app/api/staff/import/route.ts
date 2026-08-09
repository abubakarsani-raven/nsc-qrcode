import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { generateQrToken, publicVerifyUrl, assertUrlBudget } from "@/lib/qr";
import { audit } from "@/lib/audit";
import { defaultBackFor } from "@/lib/staff";

type RowMap = Record<string, string>;

function cellText(v: ExcelJS.CellValue): string {
  if (v == null) return "";
  if (typeof v === "object" && v && "text" in v) return String((v as { text?: string }).text ?? "");
  if (typeof v === "object" && v && "result" in v) return String((v as { result?: unknown }).result ?? "");
  return String(v);
}

function parseCsv(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length);
  if (!lines.length) return { headers: [], rows: [] };
  const headers = lines[0].split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
  const rows = lines.slice(1).map((line) => {
    const cols = line.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => {
      obj[h] = cols[i] ?? "";
    });
    return obj;
  });
  return { headers, rows };
}

export async function POST(req: NextRequest) {
  const gate = await requirePermission("createEdit");
  if ("error" in gate && gate.error) return gate.error;

  const form = await req.formData();
  const file = form.get("file");
  const mappingRaw = form.get("mapping");
  const dryRun = form.get("dryRun") === "1" || form.get("dryRun") === "true";

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file required" }, { status: 400 });
  }
  if (typeof mappingRaw !== "string") {
    return NextResponse.json({ error: "mapping JSON required" }, { status: 400 });
  }

  let mapping: RowMap;
  try {
    mapping = JSON.parse(mappingRaw);
  } catch {
    return NextResponse.json({ error: "invalid mapping" }, { status: 400 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  let rows: Record<string, string>[] = [];

  if (file.name.toLowerCase().endsWith(".csv")) {
    rows = parseCsv(buf.toString("utf8")).rows;
  } else {
    const wb = new ExcelJS.Workbook();
    // exceljs typings expect Buffer; Node Buffer is fine at runtime
    await wb.xlsx.load(buf as unknown as ExcelJS.Buffer);
    const sheet = wb.worksheets[0];
    if (!sheet) {
      return NextResponse.json({ error: "empty workbook" }, { status: 400 });
    }
    const headers: string[] = [];
    sheet.getRow(1).eachCell((cell, col) => {
      headers[col] = cellText(cell.value).trim();
    });
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const obj: Record<string, string> = {};
      row.eachCell((cell, col) => {
        const h = headers[col];
        if (h) obj[h] = cellText(cell.value).trim();
      });
      rows.push(obj);
    });
  }

  const fieldOf = (row: Record<string, string>, field: string) => {
    const col = mapping[field];
    return col ? (row[col] ?? "").trim() : "";
  };

  const errors: { row: number; error: string }[] = [];
  const preview: Record<string, string>[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const idNumber = fieldOf(row, "idNumber");
    const firstName = fieldOf(row, "firstName");
    const lastName = fieldOf(row, "lastName");
    const designation = fieldOf(row, "designation");
    const middleName = fieldOf(row, "middleName") || "";
    const officeLine = fieldOf(row, "officeLine") || "";
    const emergencyContactName = fieldOf(row, "emergencyContactName") || "";
    const emergencyContactPhone = fieldOf(row, "emergencyContactPhone") || "";

    if (!idNumber || !firstName || !lastName || !designation) {
      errors.push({ row: i + 2, error: "Missing required fields" });
      continue;
    }
    if (seen.has(idNumber)) {
      errors.push({ row: i + 2, error: `Duplicate idNumber in file: ${idNumber}` });
      continue;
    }
    seen.add(idNumber);

    const existing = await prisma.staff.findUnique({ where: { idNumber } });
    if (existing) {
      errors.push({
        row: i + 2,
        error: `ID ${idNumber} already exists (${existing.id})`,
      });
      continue;
    }

    preview.push({
      idNumber,
      firstName,
      middleName,
      lastName,
      designation,
      officeLine,
      emergencyContactName,
      emergencyContactPhone,
    });
  }

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
    return NextResponse.json({
      dryRun: false,
      blocked: true,
      rowCount: rows.length,
      validCount: preview.length,
      errorCount: errors.length,
      errors,
    }, { status: 400 });
  }

  let createdCount = 0;
  for (const p of preview) {
    const qrToken = generateQrToken();
    assertUrlBudget(publicVerifyUrl(qrToken));
    await prisma.staff.create({
      data: {
        idNumber: p.idNumber,
        firstName: p.firstName,
        middleName: p.middleName || null,
        lastName: p.lastName,
        designation: p.designation,
        officeLine: p.officeLine || null,
        emergencyContactName: p.emergencyContactName || null,
        emergencyContactPhone: p.emergencyContactPhone || null,
        frontTemplate: "WAVE_GREEN",
        backTemplate: defaultBackFor("WAVE_GREEN"),
        qrToken,
        approvalState: "PENDING",
      },
    });
    createdCount++;
  }

  const batch = await prisma.importBatch.create({
    data: {
      filename: file.name,
      actorId: gate.session!.user.id,
      rowCount: rows.length,
      createdCount,
      errorCount: 0,
      report: JSON.stringify({ createdCount }),
    },
  });

  await audit(gate.session!.user.id, "IMPORTED", null, {
    batchId: batch.id,
    createdCount,
  });

  return NextResponse.json({ batch, createdCount });
}
