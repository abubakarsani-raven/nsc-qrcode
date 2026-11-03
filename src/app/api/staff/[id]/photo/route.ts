import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
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

/** PDF rendering / image processing can exceed the default 10s on Vercel. */
export const maxDuration = 60;

type Ctx = { params: Promise<{ id: string }> };

const finite = z.number().finite();
const cropSchema = z.object({
  x: finite,
  y: finite,
  width: finite.positive().max(20000),
  height: finite.positive().max(20000),
  zoom: finite.positive().optional(),
  rotation: finite.min(-360).max(360).optional(),
});

/** Accepts the crop as an object or a JSON string; null when invalid. */
function readCrop(raw: unknown): CropParams | null {
  let value = raw;
  if (typeof raw === "string") {
    try {
      value = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  const parsed = cropSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const gate = await requirePermission("photo");
  if (gate.error) return gate.error;
  const { id } = await ctx.params;

  const staff = await prisma.staff.findUnique({ where: { id } });
  if (!staff) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Two intake shapes:
  //  - JSON  { crop, uploaded: true }  the browser already pushed the original
  //          to Cloudinary; nothing large crosses this function. This is the
  //          only path that works on Vercel, whose body limit is 4.5 MB.
  //  - JSON  { crop, reposition: true } re-cut the stored original with a new
  //          crop (dragging / zooming the photo on the live card).
  //  - multipart with a `file`         legacy/local path, still used when
  //          Cloudinary is unconfigured (development).
  let crop: CropParams;
  let file: File | null = null;
  let reposition = false;

  const contentType = req.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    let body: { crop?: unknown; uploaded?: unknown; reposition?: unknown };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "invalid body" }, { status: 400 });
    }
    reposition = body.reposition === true;
    if (reposition && !staff.photoOriginalKey) {
      return NextResponse.json(
        { error: "No original photo to reposition — upload one first" },
        { status: 400 },
      );
    }
    if (!body.uploaded && !reposition) {
      return NextResponse.json(
        { error: "uploaded flag required when posting JSON" },
        { status: 400 },
      );
    }
    const parsedCrop = readCrop(body.crop);
    if (!parsedCrop) {
      return NextResponse.json({ error: "A valid crop box is required" }, { status: 400 });
    }
    crop = parsedCrop;
  } else {
    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      return NextResponse.json({ error: "invalid upload" }, { status: 400 });
    }
    const maybeFile = form.get("file");
    const cropRaw = form.get("crop");
    if (!(maybeFile instanceof File) || typeof cropRaw !== "string") {
      return NextResponse.json(
        { error: "file and crop required" },
        { status: 400 },
      );
    }
    if (!maybeFile.type.startsWith("image/")) {
      return NextResponse.json({ error: "Only image files can be uploaded" }, { status: 415 });
    }
    if (maybeFile.size > 15 * 1024 * 1024) {
      return NextResponse.json({ error: "Photo is larger than 15 MB" }, { status: 413 });
    }
    file = maybeFile;
    const parsedCrop = readCrop(cropRaw);
    if (!parsedCrop) {
      return NextResponse.json({ error: "A valid crop box is required" }, { status: 400 });
    }
    crop = parsedCrop;
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
  if (reposition) {
    originalKey = staff.photoOriginalKey!;
  } else if (file) {
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

  await audit(gate.session.user.id, "PHOTO_REPLACED", id, {
    dpi,
    ...(reposition ? { repositioned: true } : {}),
  });

  return NextResponse.json({ staff: updated, dpi });
}
