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

  const form = await req.formData();
  const file = form.get("file");
  const cropRaw = form.get("crop");
  if (!(file instanceof File) || typeof cropRaw !== "string") {
    return NextResponse.json({ error: "file and crop required" }, { status: 400 });
  }

  let crop: CropParams;
  try {
    crop = JSON.parse(cropRaw);
  } catch {
    return NextResponse.json({ error: "invalid crop" }, { status: 400 });
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

  const buffer = Buffer.from(await file.arrayBuffer());
  const originalKey = await saveOriginal(id, buffer, file.type || "image/jpeg");
  const previewKey = await writePreviewFromCrop(id, originalKey, crop);

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
