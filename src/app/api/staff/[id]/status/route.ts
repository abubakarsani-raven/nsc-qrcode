import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { audit } from "@/lib/audit";

const schema = z.object({ status: z.enum(["ACTIVE", "SUSPENDED"]) });

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  const gate = await requirePermission("suspend");
  if ("error" in gate && gate.error) return gate.error;
  const { id } = await ctx.params;
  const body = schema.safeParse(await req.json());
  if (!body.success) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const staff = await prisma.staff.update({
    where: { id },
    data: { status: body.data.status },
  });

  await audit(
    gate.session!.user.id,
    body.data.status === "SUSPENDED" ? "SUSPENDED" : "REACTIVATED",
    id,
  );

  return NextResponse.json({ staff });
}
