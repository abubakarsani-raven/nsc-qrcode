/**
 * Photo blob storage.
 *
 * Staff photos cannot live on the local filesystem in production: Vercel's
 * runtime filesystem is read-only outside /tmp and is discarded between
 * invocations, so a written file is gone before the next request reads it.
 * That produced the "saved successfully, but No photo" symptom — the DB row
 * recorded a key whose bytes no longer existed anywhere.
 *
 * Cloudinary is the backend whenever it is configured. Assets are uploaded as
 * `type: "authenticated"`, so they have no publicly reachable delivery URL;
 * bytes are fetched server-side and streamed through the existing auth-gated
 * /api/photos route. Access control therefore stays exactly where it was.
 *
 * Without Cloudinary credentials this falls back to the filesystem, which is
 * fine for local development.
 */

import fs from "fs/promises";
import path from "path";

/** Cloudinary is used only when fully configured; otherwise local disk. */
export function usingCloudinary() {
  return Boolean(
    process.env.CLOUDINARY_URL ||
      (process.env.CLOUDINARY_CLOUD_NAME &&
        process.env.CLOUDINARY_API_KEY &&
        process.env.CLOUDINARY_API_SECRET),
  );
}

function localRoot() {
  return path.resolve(
    process.cwd(),
    process.env.PHOTO_STORAGE_DIR ?? "./storage/photos",
  );
}

function localPath(staffId: string, key: string) {
  return path.join(localRoot(), staffId, key);
}

/** Folder prefix keeps one staff member's assets together in the media library. */
const FOLDER = process.env.CLOUDINARY_FOLDER ?? "nsc-id-photos";

/**
 * Cloudinary public_id for a stored key. The file extension is dropped: it is
 * carried separately as the asset's format, and leaving it in the id produces
 * a doubled extension on delivery.
 */
function publicId(staffId: string, key: string) {
  return `${FOLDER}/${staffId}/${key.replace(/\.[^.]+$/, "")}`;
}

async function cloudinaryClient() {
  const { v2 } = await import("cloudinary");
  // CLOUDINARY_URL is picked up from the environment automatically; the
  // explicit config covers the split-variable form.
  if (!process.env.CLOUDINARY_URL) {
    v2.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
      secure: true,
    });
  }
  return v2;
}

/** Store bytes under a stable key. Overwrites any previous value. */
export async function putPhoto(
  staffId: string,
  key: string,
  buffer: Buffer,
): Promise<void> {
  if (!usingCloudinary()) {
    const dest = localPath(staffId, key);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.writeFile(dest, buffer);
    return;
  }

  const cloudinary = await cloudinaryClient();
  await new Promise<void>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        public_id: publicId(staffId, key),
        resource_type: "image",
        // Private delivery — no guessable public URL for a staff ID photo.
        type: "authenticated",
        overwrite: true,
        invalidate: true,
      },
      (error) => (error ? reject(error) : resolve()),
    );
    stream.end(buffer);
  });
}

/** Retrieve previously stored bytes. Throws if the key does not exist. */
export async function getPhoto(staffId: string, key: string): Promise<Buffer> {
  if (!usingCloudinary()) {
    return fs.readFile(localPath(staffId, key));
  }

  const cloudinary = await cloudinaryClient();
  // Authenticated assets need a signed URL; a plain delivery URL returns 401.
  const url = cloudinary.url(publicId(staffId, key), {
    resource_type: "image",
    type: "authenticated",
    sign_url: true,
    secure: true,
  });

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(
      `Cloudinary fetch failed for ${staffId}/${key}: ${res.status} ${res.statusText}`,
    );
  }
  return Buffer.from(await res.arrayBuffer());
}
