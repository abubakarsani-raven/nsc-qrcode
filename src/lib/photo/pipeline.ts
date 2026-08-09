import fs from "fs/promises";
import path from "path";
import sharp from "sharp";
import {
  PHOTO_DPI_FLOOR,
  PHOTO_MASTER,
  PHOTO_SLOT_INCHES,
} from "@/lib/id-card/slots.generated";

export type CropParams = {
  x: number;
  y: number;
  width: number;
  height: number;
  zoom?: number;
  rotation?: number;
};

function storageRoot() {
  return path.resolve(
    process.cwd(),
    process.env.PHOTO_STORAGE_DIR ?? "./storage/photos",
  );
}

export function photoPaths(staffId: string) {
  const dir = path.join(storageRoot(), staffId);
  return {
    dir,
    original: (ext: string) => path.join(dir, `original${ext}`),
    preview: path.join(dir, "preview.jpg"),
  };
}

export function minSourcePixels() {
  return {
    width: Math.ceil(PHOTO_SLOT_INCHES.width * PHOTO_DPI_FLOOR),
    height: Math.ceil(PHOTO_SLOT_INCHES.height * PHOTO_DPI_FLOOR),
  };
}

export function effectiveDpi(cropPxW: number, cropPxH: number) {
  const dpiW = cropPxW / PHOTO_SLOT_INCHES.width;
  const dpiH = cropPxH / PHOTO_SLOT_INCHES.height;
  return Math.min(dpiW, dpiH);
}

export async function saveOriginal(
  staffId: string,
  buffer: Buffer,
  mime: string,
) {
  const ext =
    mime.includes("png") ? ".png" : mime.includes("webp") ? ".webp" : ".jpg";
  const paths = photoPaths(staffId);
  await fs.mkdir(paths.dir, { recursive: true });
  const key = `original${ext}`;
  await fs.writeFile(path.join(paths.dir, key), buffer);
  return key;
}

export async function writePreviewFromCrop(
  staffId: string,
  originalKey: string,
  crop: CropParams,
  sharpen = false,
) {
  const paths = photoPaths(staffId);
  const src = path.join(paths.dir, originalKey);
  const pipeline = sharp(src).rotate(crop.rotation ?? 0).extract({
    left: Math.max(0, Math.round(crop.x)),
    top: Math.max(0, Math.round(crop.y)),
    width: Math.max(1, Math.round(crop.width)),
    height: Math.max(1, Math.round(crop.height)),
  });

  if (sharpen) pipeline.sharpen();

  await pipeline
    .resize(PHOTO_MASTER.width, PHOTO_MASTER.height, {
      fit: "fill",
      kernel: sharp.kernel.lanczos3,
    })
    .jpeg({ quality: 92 })
    .toFile(paths.preview);

  return "preview.jpg";
}

/** Re-cut for print at native slot density × 2 (≈600 dpi equivalent) */
export async function printCutBuffer(
  staffId: string,
  originalKey: string,
  crop: CropParams,
  sharpen = false,
) {
  const paths = photoPaths(staffId);
  const src = path.join(paths.dir, originalKey);
  const targetW = Math.round(PHOTO_SLOT_INCHES.width * 600);
  const targetH = Math.round(PHOTO_SLOT_INCHES.height * 600);

  let pipeline = sharp(src).rotate(crop.rotation ?? 0).extract({
    left: Math.max(0, Math.round(crop.x)),
    top: Math.max(0, Math.round(crop.y)),
    width: Math.max(1, Math.round(crop.width)),
    height: Math.max(1, Math.round(crop.height)),
  });

  if (sharpen) pipeline = pipeline.sharpen();

  return pipeline
    .resize(targetW, targetH, { fit: "fill", kernel: sharp.kernel.lanczos3 })
    .jpeg({ quality: 95 })
    .toBuffer();
}

export async function readPhotoFile(staffId: string, key: string) {
  return fs.readFile(path.join(photoPaths(staffId).dir, key));
}

/** Estimate final file size in KB based on DPI and crop dimensions */
export function estimateFileSize(dpi: number, width: number, height: number): number {
  // Rough estimate: smaller DPI = smaller file
  // Quality 92 JPEG ≈ 0.04-0.06 bytes per pixel
  const megapixels = (width / 72) * (height / 72) * (dpi / 150);
  const estimatedBytes = megapixels * 1000000 * 0.05; // ~50 bytes per megapixel at quality 92
  return Math.round(estimatedBytes / 1024); // Convert to KB
}

/** Read basic image metadata from buffer */
export async function readImageMetadata(
  buffer: Buffer
): Promise<{ width: number; height: number; colorSpace?: string }> {
  // Simple metadata extraction - look for JPEG markers
  try {
    // Find SOF (Start of Frame) marker in JPEG
    let offset = 2; // Skip SOI marker (FFD8)
    while (offset < buffer.length) {
      if (buffer[offset] === 0xff) {
        const marker = buffer[offset + 1];
        // SOF0-SOF15 (except SOF4, SOF8, SOF12)
        if ((marker >= 0xc0 && marker <= 0xcf) && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
          const height = buffer.readUInt16BE(offset + 5);
          const width = buffer.readUInt16BE(offset + 7);
          // Byte at offset+9 tells us components (1=gray, 3=RGB, 4=CMYK)
          const components = buffer[offset + 9];
          const colorSpace = components === 1 ? "Grayscale" : components === 3 ? "RGB" : components === 4 ? "CMYK" : "Unknown";
          return { width, height, colorSpace };
        }
        const segmentLength = buffer.readUInt16BE(offset + 2);
        offset += 2 + segmentLength;
      } else {
        offset++;
      }
    }
  } catch {
    // Fall through to default
  }
  return { width: 0, height: 0, colorSpace: "Unknown" };
}
