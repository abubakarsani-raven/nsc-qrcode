import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission, requireSession } from "@/lib/session";
import { can } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { requiresReapproval } from "@/lib/staff";
import type { Role } from "@/generated/prisma/client";

const patchSchema = z.object({
  idNumber: z.string().min(1).optional(),
  firstName: z.string().min(1).optional(),
  middleName: z.string().nullable().optional(),
  lastName: z.string().min(1).optional(),
  designation: z.string().min(1).optional(),
  posting: z.string().nullable().optional(),
  department: z.string().nullable().optional(),
  dateIssued: z.string().nullable().optional(),
  officeLine: z.string().nullable().optional(),
  emergencyContactName: z.string().nullable().optional(),
  emergencyContactPhone: z.string().nullable().optional(),
  bloodGroup: z.string().nullable().optional(),
  genotype: z.string().nullable().optional(),
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

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const gate = await requireSession();
  if ("error" in gate && gate.error) return gate.error;
  const { id } = await ctx.params;

  const staff = await prisma.staff.findUnique({
    where: { id },
    include: {
      published: true,
      approvedBy: { select: { id: true, name: true, email: true } },
      auditEvents: {
        orderBy: { createdAt: "desc" },
        take: 50,
        include: { actor: { select: { name: true, email: true } } },
      },
    },
  });
  if (!staff) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const role = gate.session!.user.role as Role;
  if (!can(role, "medical")) {
    const { bloodGroup: _b, genotype: _g, ...rest } = staff;
    return NextResponse.json({ staff: rest });
  }
  return NextResponse.json({ staff });
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const gate = await requirePermission("createEdit");
  if ("error" in gate && gate.error) return gate.error;
  const { id } = await ctx.params;

  const body = patchSchema.safeParse(await req.json());
  if (!body.success) {
    return NextResponse.json({ error: body.error.flatten() }, { status: 400 });
  }

  const existing = await prisma.staff.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (body.data.idNumber && body.data.idNumber !== existing.idNumber) {
    const clash = await prisma.staff.findUnique({
      where: { idNumber: body.data.idNumber },
    });
    if (clash) {
      return NextResponse.json({ error: "ID number already exists" }, { status: 409 });
    }
  }

  const role = gate.session!.user.role as Role;
  const data = { ...body.data };
  if (!can(role, "medical")) {
    delete data.bloodGroup;
    delete data.genotype;
  }

  const needsReapproval =
    existing.approvalState === "APPROVED" &&
    requiresReapproval(existing, data as Partial<typeof existing>);

  const staff = await prisma.staff.update({
    where: { id },
    data: {
      ...data,
      ...(needsReapproval ? { hasPendingEdits: true } : {}),
    },
    include: { published: true },
  });

  await audit(gate.session!.user.id, "EDITED", staff.id, { fields: Object.keys(data) });

  return NextResponse.json({ staff });
}
