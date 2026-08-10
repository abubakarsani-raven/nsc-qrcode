import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { audit } from "@/lib/audit";
import {
  effectiveDpi,
  minSourcePixels,
  saveOriginal,
  writePreviewFromCrop,
  type CropParams,
} from "@/lib/photo/pipeline";
import { PHOTO_DPI_FLOOR } from "@/lib/id-card/slots.generated";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  const gate = await requirePermission("photo");
  if ("error" in gate && gate.error) return gate.error;
  const { id } = await ctx.params;

  const staff = await prisma.staff.findUnique({ where: { id } });
  if (!staff) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Two intake shapes:
  //  - JSON  { crop, uploaded: true }  the browser already pushed the original
  //          to Cloudinary; nothing large crosses this function. This is the
  //          only path that works on Vercel, whose body limit is 4.5 MB.
  //  - multipart with a `file`         legacy/local path, still used when
  //          Cloudinary is unconfigured (development).
  let crop: CropParams;
  let file: File | null = null;

  const contentType = req.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    let body: { crop?: unknown; uploaded?: unknown };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "invalid body" }, { status: 400 });
    }
    if (!body.uploaded) {
      return NextResponse.json(
        { error: "uploaded flag required when posting JSON" },
        { status: 400 },
      );
    }
    try {
      crop =
        typeof body.crop === "string"
          ? JSON.parse(body.crop)
          : (body.crop as CropParams);
    } catch {
      return NextResponse.json({ error: "invalid crop" }, { status: 400 });
    }
    if (!crop) {
      return NextResponse.json({ error: "crop required" }, { status: 400 });
    }
  } else {
    const form = await req.formData();
    const maybeFile = form.get("file");
    const cropRaw = form.get("crop");
    if (!(maybeFile instanceof File) || typeof cropRaw !== "string") {
      return NextResponse.json(
        { error: "file and crop required" },
        { status: 400 },
      );
    }
    file = maybeFile;
    try {
      crop = JSON.parse(cropRaw);
    } catch {
      return NextResponse.json({ error: "invalid crop" }, { status: 400 });
    }
  }

  const dpi = effectiveDpi(crop.width, crop.height);
  const floor = minSourcePixels();
  if (crop.width < floor.width || crop.height < floor.height || dpi < PHOTO_DPI_FLOOR) {
    return NextResponse.json(
      {
        error: `Crop below ${PHOTO_DPI_FLOOR} dpi floor`,
        dpi,
        min: floor,
      },
      { status: 400 },
    );
  }

  // When the browser uploaded direct to Cloudinary the original is already at
  // the id derived from the staff id, so there is nothing to store here.
  let originalKey: string;
  if (file) {
    const buffer = Buffer.from(await file.arrayBuffer());
    originalKey = await saveOriginal(id, buffer, file.type || "image/jpeg");
  } else {
    originalKey = "original.jpg";
  }

  let previewKey: string;
  try {
    previewKey = await writePreviewFromCrop(id, originalKey, crop);
  } catch (err) {
    console.error(`[photo] preview generation failed for staff ${id}:`, err);
    return NextResponse.json(
      { error: "Could not read the uploaded photo. Please try again." },
      { status: 502 },
    );
  }

  const wasApproved = staff.approvalState === "APPROVED";
  const updated = await prisma.staff.update({
    where: { id },
    data: {
      photoOriginalKey: originalKey,
      photoPreviewKey: previewKey,
      photoCrop: JSON.stringify(crop),
      photoCapturedAt: new Date(),
      ...(wasApproved ? { hasPendingEdits: true } : {}),
    },
  });

  await audit(gate.session!.user.id, "PHOTO_REPLACED", id, { dpi });

  return NextResponse.json({ staff: updated, dpi });
}
