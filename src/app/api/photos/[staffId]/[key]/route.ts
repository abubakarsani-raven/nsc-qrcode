import { NextRequest, NextResponse } from "next/server";
import { readPhotoFile } from "@/lib/photo/pipeline";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Ctx = { params: Promise<{ staffId: string; key: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  const { staffId, key } = await ctx.params;
  if (!["preview.jpg", "original.jpg", "original.png", "original.webp"].includes(key) &&
      !key.startsWith("original.")) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Public verify page may request preview via token query
  const token = req.nextUrl.searchParams.get("token");
  const session = await auth();

  if (!session?.user) {
    if (!token || key !== "preview.jpg") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const staff = await prisma.staff.findFirst({
      where: { id: staffId, qrToken: token, published: { isNot: null } },
    });
    if (!staff) return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const buf = await readPhotoFile(staffId, key);
    const type = key.endsWith(".png")
      ? "image/png"
      : key.endsWith(".webp")
        ? "image/webp"
        : "image/jpeg";
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": type,
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
