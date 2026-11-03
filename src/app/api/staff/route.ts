import { NextRequest, NextResponse } from "next/server";
import { FRONT_TEMPLATE_IDS, type FrontTemplateId } from "@/lib/id-card/slots.generated";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { can } from "@/lib/auth";
import { generateQrToken, publicVerifyUrl, assertUrlBudget } from "@/lib/qr";
import { audit } from "@/lib/audit";
import { defaultBackFor, withoutMedical } from "@/lib/staff";
import { parseTextSettings, serializeTextSettings } from "@/lib/id-card/type-scale";
import { parseJson, prismaErrorResponse } from "@/lib/api";
import { staffCreateSchema } from "@/lib/staff-schema";
import type { Prisma, Role } from "@/generated/prisma/client";

export async function GET(req: NextRequest) {
  const gate = await requireSession();
  if (gate.error) return gate.error;
  const role = gate.session.user.role as Role;
  // Editors list to work on records; printers list to export them.
  if (!can(role, "createEdit") && !can(role, "print")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const sp = req.nextUrl.searchParams;
  const q = sp.get("q")?.trim();
  const status = sp.get("status");
  const approvalState = sp.get("approvalState");
  const frontTemplate = sp.get("frontTemplate");

  const where: Prisma.StaffWhereInput = {};
  if (status === "ACTIVE" || status === "SUSPENDED") where.status = status;
  if (approvalState === "PENDING" || approvalState === "APPROVED") {
    where.approvalState = approvalState;
  }
  if (sp.get("missingPhoto") === "1") where.photoPreviewKey = null;
  if (frontTemplate && FRONT_TEMPLATE_IDS.includes(frontTemplate as FrontTemplateId)) {
    where.frontTemplate = frontTemplate as FrontTemplateId;
  }
  if (q) {
    const contains = { contains: q, mode: "insensitive" as const };
    where.OR = [
      { idNumber: contains },
      { firstName: contains },
      { lastName: contains },
      { middleName: contains },
      { designation: contains },
    ];
  }

  const staff = await prisma.staff.findMany({
    where,
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    include: { published: true, approvedBy: { select: { id: true, name: true } } },
  });

  if (!can(role, "medical")) {
    return NextResponse.json({
      staff: staff.map(withoutMedical),
    });
  }
  return NextResponse.json({ staff });
}

export async function POST(req: NextRequest) {
  const gate = await requireSession();
  if (gate.error) return gate.error;
  const role = gate.session.user.role as Role;
  if (!can(role, "createEdit")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await parseJson(req, staffCreateSchema);
  if (body.error) return body.error;
  const { cardTypeScale, ...fields } = body.data;

  // Same rule as PATCH: only medical roles may set medical fields.
  if (!can(role, "medical")) {
    fields.bloodGroup = undefined;
    fields.genotype = undefined;
  }

  const existing = await prisma.staff.findUnique({
    where: { idNumber: fields.idNumber },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json(
      { error: "ID number already exists", existingId: existing.id },
      { status: 409 },
    );
  }

  const front = fields.frontTemplate ?? "WAVE_GREEN";
  const back = fields.backTemplate ?? defaultBackFor(front);
  const qrToken = generateQrToken();
  assertUrlBudget(publicVerifyUrl(qrToken));

  try {
    const staff = await prisma.staff.create({
      data: {
        ...fields,
        cardTypeScale: serializeTextSettings(parseTextSettings(cardTypeScale)),
        frontTemplate: front,
        backTemplate: back,
        qrToken,
        approvalState: "PENDING",
      },
    });

    await audit(gate.session.user.id, "CREATED", staff.id, {
      idNumber: staff.idNumber,
    });

    return NextResponse.json({ staff }, { status: 201 });
  } catch (err) {
    // A concurrent create with the same ID number lands here (P2002).
    const mapped = prismaErrorResponse(err);
    if (mapped) return mapped;
    throw err;
  }
}
