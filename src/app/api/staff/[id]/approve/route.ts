import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { audit } from "@/lib/audit";
import { publishedSnapshot } from "@/lib/staff";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, ctx: Ctx) {
  const gate = await requirePermission("approve");
  if ("error" in gate && gate.error) return gate.error;
  const { id } = await ctx.params;

  const staff = await prisma.staff.findUnique({ where: { id } });
  if (!staff) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const snap = publishedSnapshot(staff);
  const actorId = gate.session!.user.id;

  const updated = await prisma.$transaction(async (tx) => {
    await tx.staffPublished.upsert({
      where: { staffId: id },
      create: { staffId: id, publishedById: actorId, ...snap },
      update: { publishedById: actorId, publishedAt: new Date(), ...snap },
    });
    return tx.staff.update({
      where: { id },
      data: {
        approvalState: "APPROVED",
        approvedById: actorId,
        approvedAt: new Date(),
        hasPendingEdits: false,
      },
      include: { published: true },
    });
  });

  await audit(actorId, "APPROVED", id);
  await audit(actorId, "PUBLISHED", id);

  return NextResponse.json({ staff: updated });
}
