/**
 * Photo blob storage.
 *
 * Staff photos cannot live on the local filesystem in production: Vercel's
 * runtime filesystem is read-only outside /tmp and is discarded between
 * invocations, so a written file is gone before the next request reads it.
 * That produced the "saved successfully, but No photo" symptom — the DB row
 * recorded a key whose bytes no longer existed anywhere.
 *
 * Cloudinary is the backend whenever it is configured.
 *
 * Originals are uploaded straight from the browser to Cloudinary, not through
 * this app: Vercel Serverless Functions reject request bodies over 4.5 MB, and
 * a print-resolution portrait is comfortably larger than that (the symptom was
 * a 413 on POST /api/staff/<id>/photo). The browser therefore sends the bytes
 * to Cloudinary and sends this app only the resulting id plus the crop box.
 * Uploads are still *signed* by /api/photos/sign, so only a logged-in admin
 * can put anything in the account.
 *
 * Delivery is public (`type: "upload"`) by explicit product decision: photos
 * are served as plain CDN URLs and are viewable by anyone holding the link,
 * without signing in.
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

/** Credentials, from either the single-URL or split form. */
export function cloudinaryCredentials() {
  const url = process.env.CLOUDINARY_URL;
  if (url) {
    // cloudinary://<api_key>:<api_secret>@<cloud_name>
    const m = /^cloudinary:\/\/([^:]+):([^@]+)@(.+)$/.exec(url.trim());
    if (!m) throw new Error("CLOUDINARY_URL is malformed");
    return { apiKey: m[1], apiSecret: m[2], cloudName: m[3] };
  }
  return {
    apiKey: process.env.CLOUDINARY_API_KEY ?? "",
    apiSecret: process.env.CLOUDINARY_API_SECRET ?? "",
    cloudName: process.env.CLOUDINARY_CLOUD_NAME ?? "",
  };
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
export function publicId(staffId: string, key: string) {
  return `${FOLDER}/${staffId}/${key.replace(/\.[^.]+$/, "")}`;
}

/**
 * Public CDN URL for a stored photo. `v=<version>` is deliberately omitted and
 * cache invalidation is left to `invalidate: true` on upload, so callers can
 * derive the URL without a database round-trip.
 */
export function photoUrl(staffId: string, key: string): string | null {
  if (!usingCloudinary()) return null;
  const { cloudName } = cloudinaryCredentials();
  if (!cloudName) return null;
  return `https://res.cloudinary.com/${cloudName}/image/upload/${publicId(staffId, key)}`;
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
        type: "upload",
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
  const url = cloudinary.url(publicId(staffId, key), {
    resource_type: "image",
    type: "upload",
    secure: true,
  });

  // Cloudinary serves a stale CDN copy for a short window after overwrite;
  // re-cropping the previous original would silently produce a wrong preview.
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(
      `Cloudinary fetch failed for ${staffId}/${key}: ${res.status} ${res.statusText}`,
    );
  }
  return Buffer.from(await res.arrayBuffer());
}
