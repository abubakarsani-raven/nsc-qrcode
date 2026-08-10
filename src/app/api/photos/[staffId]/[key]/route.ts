import { NextRequest, NextResponse } from "next/server";
import { readPhotoFile, writePreviewFromCrop, type CropParams } from "@/lib/photo/pipeline";
import { getPhoto } from "@/lib/photo/storage";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Ctx = { params: Promise<{ staffId: string; key: string }> };

function isAllowedKey(key: string) {
  return (
    key === "preview.jpg" ||
    key === "original.jpg" ||
    key === "original.png" ||
    key === "original.webp" ||
    key.startsWith("original.")
  );
}

async function loadOrRebuildPreview(staffId: string): Promise<Buffer> {
  try {
    return await getPhoto(staffId, "preview.jpg");
  } catch {
    // Preview is what the live card shows. PDF can rebuild from original+crop,
    // so a missing preview asset left the browser broken while Download PDF
    // still looked fine. Rebuild once and persist.
    const staff = await prisma.staff.findUnique({
      where: { id: staffId },
      select: {
        photoOriginalKey: true,
        photoCrop: true,
      },
    });
    if (!staff?.photoOriginalKey || !staff.photoCrop) throw new Error("no source");
    let crop: CropParams;
    try {
      crop = JSON.parse(staff.photoCrop) as CropParams;
    } catch {
      throw new Error("bad crop");
    }
    const key = await writePreviewFromCrop(
      staffId,
      staff.photoOriginalKey,
      crop,
    );
    return getPhoto(staffId, key);
  }
}

export async function GET(req: NextRequest, ctx: Ctx) {
  const { staffId, key } = await ctx.params;
  if (!isAllowedKey(key)) {
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
    const buf =
      key === "preview.jpg"
        ? await loadOrRebuildPreview(staffId)
        : await readPhotoFile(staffId, key);
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
  } catch (err) {
    console.error(`[api/photos] failed ${staffId}/${key}:`, err);
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
