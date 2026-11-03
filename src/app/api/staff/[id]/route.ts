import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, requireSession } from "@/lib/session";
import { can } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { requiresReapproval, withoutMedical } from "@/lib/staff";
import { parseTextSettings, serializeTextSettings } from "@/lib/id-card/type-scale";
import { parseJson, prismaErrorResponse } from "@/lib/api";
import { staffPatchSchema } from "@/lib/staff-schema";
import type { Staff } from "@/generated/prisma/client";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const gate = await requireSession();
  if (gate.error) return gate.error;
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

  if (!can(gate.session.user.role, "medical")) {
    return NextResponse.json({ staff: withoutMedical(staff) });
  }
  return NextResponse.json({ staff });
}

/** Compare a patch value with the stored one, treating Dates by value. */
function sameValue(a: unknown, b: unknown) {
  if (a instanceof Date || b instanceof Date) {
    const ta = a instanceof Date ? a.getTime() : a;
    const tb = b instanceof Date ? b.getTime() : b;
    return ta === tb;
  }
  return (a ?? null) === (b ?? null);
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const gate = await requirePermission("createEdit");
  if (gate.error) return gate.error;
  const { id } = await ctx.params;

  const body = await parseJson(req, staffPatchSchema);
  if (body.error) return body.error;

  const existing = await prisma.staff.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const data: Partial<Staff> = { ...body.data };
  if (body.data.cardTypeScale !== undefined) {
    // Round-trip through the parser so only clamped, known settings are stored.
    data.cardTypeScale = serializeTextSettings(parseTextSettings(body.data.cardTypeScale));
  }
  const medical = can(gate.session.user.role, "medical");
  if (!medical) {
    delete data.bloodGroup;
    delete data.genotype;
  }
  const respond = (staff: Staff | null, extra: Record<string, unknown> = {}) => {
    if (staff && !medical) return NextResponse.json({ staff: withoutMedical(staff), ...extra });
    return NextResponse.json({ staff, ...extra });
  };

  // Only what actually changed — keeps the audit trail meaningful and avoids
  // flagging an approved card for re-approval on a no-op save.
  const changed = (Object.keys(data) as (keyof Staff)[]).filter(
    (k) => data[k] !== undefined && !sameValue(data[k], existing[k]),
  );
  if (!changed.length) {
    const staff = await prisma.staff.findUnique({ where: { id }, include: { published: true } });
    return respond(staff, { unchanged: true });
  }
  const patch = Object.fromEntries(changed.map((k) => [k, data[k]])) as Partial<Staff>;

  if (patch.idNumber) {
    const clash = await prisma.staff.findUnique({
      where: { idNumber: patch.idNumber },
      select: { id: true },
    });
    if (clash && clash.id !== id) {
      return NextResponse.json({ error: "ID number already exists" }, { status: 409 });
    }
  }

  const needsReapproval =
    existing.approvalState === "APPROVED" && requiresReapproval(existing, patch);

  try {
    const staff = await prisma.staff.update({
      where: { id },
      data: { ...patch, ...(needsReapproval ? { hasPendingEdits: true } : {}) },
      include: { published: true },
    });
    await audit(gate.session.user.id, "EDITED", staff.id, { fields: changed });
    return respond(staff);
  } catch (err) {
    const mapped = prismaErrorResponse(err);
    if (mapped) return mapped;
    throw err;
  }
}
