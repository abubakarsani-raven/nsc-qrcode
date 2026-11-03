import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { publishedSnapshot } from "@/lib/staff";
import { layoutFront } from "@/lib/id-card/card-layout";
import { parseTextSettings } from "@/lib/id-card/type-scale";
import type { FrontTemplateId } from "@/lib/id-card/slots.generated";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, ctx: Ctx) {
  const gate = await requirePermission("approve");
  if (gate.error) return gate.error;
  const { id } = await ctx.params;

  const staff = await prisma.staff.findUnique({ where: { id } });
  if (!staff) return NextResponse.json({ error: "Not found" }, { status: 404 });
  // The editor disables Approve without a photo; enforce it here too so a
  // direct API call can't publish a photo-less card.
  if (!staff.photoPreviewKey) {
    return NextResponse.json({ error: "Add a photo before approving" }, { status: 422 });
  }

  const layout = layoutFront({
    frontTemplate: staff.frontTemplate as FrontTemplateId,
    firstName: staff.firstName,
    middleName: staff.middleName,
    lastName: staff.lastName,
    designation: staff.designation,
    idNumber: staff.idNumber,
    text: parseTextSettings(staff.cardTypeScale),
  });
  if (layout.name.overflow || layout.designation.overflow || layout.idNo.overflow) {
    return NextResponse.json(
      {
        error:
          "Card text does not fit. Reduce the size, split the name or tighten its spacing, then approve.",
      },
      { status: 422 },
    );
  }

  const snap = publishedSnapshot(staff);
  const actorId = gate.session.user.id;

  // Publish + audit atomically: the trail never claims a publish that rolled back.
  const updated = await prisma.$transaction(async (tx) => {
    await tx.staffPublished.upsert({
      where: { staffId: id },
      create: { staffId: id, publishedById: actorId, ...snap },
      update: { publishedById: actorId, publishedAt: new Date(), ...snap },
    });
    await tx.auditEvent.createMany({
      data: [
        { actorId, staffId: id, type: "APPROVED" },
        { actorId, staffId: id, type: "PUBLISHED" },
      ],
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

  return NextResponse.json({ staff: updated });
}
