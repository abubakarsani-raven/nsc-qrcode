import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { can } from "@/lib/auth";
import { publicVerifyUrl, assertUrlBudget } from "@/lib/qr";
import { roundedQrSvg } from "@/lib/qr-render";
import { roundedQrPngBuffer } from "@/lib/qr-render-png";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  const gate = await requireSession();
  if (gate.error) return gate.error;

  const role = gate.session.user.role;
  if (!can(role, "createEdit") && !can(role, "print")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const format = (req.nextUrl.searchParams.get("format") || "png").toLowerCase();
  const staff = await prisma.staff.findUnique({
    where: { id },
    select: { idNumber: true, qrToken: true },
  });
  if (!staff) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const url = publicVerifyUrl(staff.qrToken);
  assertUrlBudget(url);
  const baseName = `nsc-qr-${staff.idNumber}`;

  if (format === "svg") {
    const svg = await roundedQrSvg(url, { size: 512, quietModules: 1 });
    return new NextResponse(svg, {
      headers: {
        "Content-Type": "image/svg+xml",
        "Content-Disposition": `attachment; filename="${baseName}.svg"`,
        "Cache-Control": "no-store",
      },
    });
  }

  const png = await roundedQrPngBuffer(url, 512);
  return new NextResponse(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Content-Disposition": `attachment; filename="${baseName}.png"`,
      "Cache-Control": "no-store",
    },
  });
}
