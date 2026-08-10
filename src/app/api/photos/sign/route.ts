import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { requirePermission } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import {
  cloudinaryCredentials,
  publicId,
  usingCloudinary,
} from "@/lib/photo/storage";

/**
 * Issues a short-lived signature so the browser can upload an original photo
 * straight to Cloudinary, bypassing Vercel's 4.5 MB request-body limit.
 *
 * The signature is scoped to one exact public_id derived from the staff id, so
 * a caller cannot use it to overwrite an unrelated asset. Uploading still
 * requires the same "photo" permission as the old server-side route.
 */
export async function POST(req: NextRequest) {
  const gate = await requirePermission("photo");
  if ("error" in gate && gate.error) return gate.error;

  if (!usingCloudinary()) {
    return NextResponse.json(
      { error: "Cloudinary is not configured on this deployment" },
      { status: 501 },
    );
  }

  let body: { staffId?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const staffId = typeof body.staffId === "string" ? body.staffId : null;
  if (!staffId) {
    return NextResponse.json({ error: "staffId required" }, { status: 400 });
  }

  const staff = await prisma.staff.findUnique({
    where: { id: staffId },
    select: { id: true },
  });
  if (!staff) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { apiKey, apiSecret, cloudName } = cloudinaryCredentials();
  const timestamp = Math.floor(Date.now() / 1000);
  const id = publicId(staffId, "original");

  // Cloudinary signs the sorted, &-joined set of upload params it will receive.
  // These must match exactly what the browser sends, or the upload is rejected.
  const params: Record<string, string> = {
    invalidate: "true",
    overwrite: "true",
    public_id: id,
    timestamp: String(timestamp),
  };
  const toSign = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&");
  const signature = crypto
    .createHash("sha1")
    .update(toSign + apiSecret)
    .digest("hex");

  return NextResponse.json({
    cloudName,
    apiKey,
    timestamp,
    publicId: id,
    signature,
    uploadUrl: `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
  });
}
