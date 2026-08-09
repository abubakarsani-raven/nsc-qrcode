import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { audit } from "@/lib/audit";
import { generateQrToken, publicVerifyUrl, assertUrlBudget } from "@/lib/qr";

const schema = z.object({ confirm: z.literal("REGENERATE") });

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  const gate = await requirePermission("regenerateQr");
  if ("error" in gate && gate.error) return gate.error;
  const { id } = await ctx.params;
  const body = schema.safeParse(await req.json());
  if (!body.success) {
    return NextResponse.json(
      { error: 'Type confirmation "REGENERATE" required' },
      { status: 400 },
    );
  }

  const existing = await prisma.staff.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const qrToken = generateQrToken();
  assertUrlBudget(publicVerifyUrl(qrToken));

  const staff = await prisma.staff.update({
    where: { id },
    data: { qrToken },
  });

  await audit(gate.session!.user.id, "QR_REGENERATED", id, {
    previousPrintedAt: existing.lastPrintedAt,
  });

  return NextResponse.json({
    staff,
    url: publicVerifyUrl(qrToken),
    warning: existing.lastPrintedAt
      ? `Previously printed ${existing.lastPrintedAt.toISOString()} — old cards are now invalid.`
      : null,
  });
}
