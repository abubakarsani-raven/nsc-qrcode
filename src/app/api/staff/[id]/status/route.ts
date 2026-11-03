import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { audit } from "@/lib/audit";
import { parseJson } from "@/lib/api";

const schema = z.object({ status: z.enum(["ACTIVE", "SUSPENDED"]) });

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  const gate = await requirePermission("suspend");
  if (gate.error) return gate.error;
  const { id } = await ctx.params;
  const body = await parseJson(req, schema);
  if (body.error) return body.error;

  const existing = await prisma.staff.findUnique({ where: { id }, select: { status: true } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (existing.status === body.data.status) {
    // Already in that state (double click, two tabs) — nothing to record.
    const staff = await prisma.staff.findUnique({ where: { id } });
    return NextResponse.json({ staff, unchanged: true });
  }

  const staff = await prisma.staff.update({
    where: { id },
    data: { status: body.data.status },
  });

  await audit(
    gate.session.user.id,
    body.data.status === "SUSPENDED" ? "SUSPENDED" : "REACTIVATED",
    id,
  );

  return NextResponse.json({ staff });
}
