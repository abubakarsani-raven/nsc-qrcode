import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";

type Ctx = { params: Promise<{ id: string }> };

/** Clear a staff record's audit history. Admin only. */
export async function DELETE(_req: Request, ctx: Ctx) {
  const gate = await requirePermission("clearAudit");
  if (gate.error) return gate.error;
  const { id } = await ctx.params;

  const staff = await prisma.staff.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!staff) {
    return NextResponse.json({ error: "Staff not found" }, { status: 404 });
  }

  // One transaction: the trail is never left wiped without its marker.
  const [{ count }] = await prisma.$transaction(async (tx) => {
    const deleted = await tx.auditEvent.deleteMany({ where: { staffId: id } });
    await tx.auditEvent.create({
      data: {
        staffId: id,
        actorId: gate.session.user.id,
        type: "AUDIT_CLEARED",
        metadata: JSON.stringify({ removed: deleted.count }),
      },
    });
    return [deleted];
  });

  return NextResponse.json({ removed: count });
}
