import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { generateQrToken, publicVerifyUrl, assertUrlBudget } from "@/lib/qr";
import { audit } from "@/lib/audit";
import { defaultBackFor } from "@/lib/staff";
import type { Prisma } from "@/generated/prisma/client";

const createSchema = z.object({
  idNumber: z.string().min(1),
  firstName: z.string().min(1),
  middleName: z.string().optional().nullable(),
  lastName: z.string().min(1),
  designation: z.string().min(1),
  posting: z.string().optional().nullable(),
  department: z.string().optional().nullable(),
  dateIssued: z.string().optional().nullable(),
  officeLine: z.string().optional().nullable(),
  emergencyContactName: z.string().optional().nullable(),
  emergencyContactPhone: z.string().optional().nullable(),
  bloodGroup: z.string().optional().nullable(),
  genotype: z.string().optional().nullable(),
  frontTemplate: z
    .enum([
      "WAVE_GREEN",
      "WAVE_BLUE",
      "BAR_BLUE_SQUARE",
      "BAR_BLUE_CIRCLE",
      "BAR_GREEN_CIRCLE",
      "BAR_GREEN_SQUARE",
    ])
    .optional(),
  backTemplate: z
    .enum([
      "BACK_WAVE_GREEN",
      "BACK_WAVE_BLUE",
      "BACK_BAR_BLUE",
      "BACK_BAR_GREEN",
    ])
    .optional(),
});

export async function GET(req: NextRequest) {
  const gate = await requirePermission("createEdit");
  if ("error" in gate && gate.error) {
    // Printers can list for export
    const printGate = await requirePermission("print");
    if ("error" in printGate && printGate.error) return printGate.error;
  }

  const sp = req.nextUrl.searchParams;
  const q = sp.get("q")?.trim();
  const status = sp.get("status");
  const approvalState = sp.get("approvalState");
  const missingPhoto = sp.get("missingPhoto") === "1";
  const frontTemplate = sp.get("frontTemplate");

  const where: Prisma.StaffWhereInput = {};
  if (status === "ACTIVE" || status === "SUSPENDED") where.status = status;
  if (approvalState === "PENDING" || approvalState === "APPROVED") {
    where.approvalState = approvalState;
  }
  if (missingPhoto) where.photoPreviewKey = null;
  if (frontTemplate) where.frontTemplate = frontTemplate as Prisma.EnumFrontTemplateFilter["equals"];
  if (q) {
    where.OR = [
      { idNumber: { contains: q } },
      { firstName: { contains: q } },
      { lastName: { contains: q } },
      { middleName: { contains: q } },
      { designation: { contains: q } },
    ];
  }

  const staff = await prisma.staff.findMany({
    where,
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    include: { published: true, approvedBy: { select: { id: true, name: true } } },
  });

  return NextResponse.json({ staff });
}

export async function POST(req: NextRequest) {
  const gate = await requirePermission("createEdit");
  if ("error" in gate && gate.error) return gate.error;

  const body = createSchema.safeParse(await req.json());
  if (!body.success) {
    return NextResponse.json({ error: body.error.flatten() }, { status: 400 });
  }

  const existing = await prisma.staff.findUnique({
    where: { idNumber: body.data.idNumber },
  });
  if (existing) {
    return NextResponse.json(
      { error: "ID number already exists", existingId: existing.id },
      { status: 409 },
    );
  }

  const front = body.data.frontTemplate ?? "WAVE_GREEN";
  const back = body.data.backTemplate ?? defaultBackFor(front);
  const qrToken = generateQrToken();
  assertUrlBudget(publicVerifyUrl(qrToken));

  const staff = await prisma.staff.create({
    data: {
      ...body.data,
      frontTemplate: front,
      backTemplate: back,
      qrToken,
      approvalState: "PENDING",
    },
  });

  await audit(gate.session!.user.id, "CREATED", staff.id, {
    idNumber: staff.idNumber,
  });

  return NextResponse.json({ staff }, { status: 201 });
}
