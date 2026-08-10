/**
 * Browser-side downscale applied before a photo is uploaded or cropped.
 *
 * Two hard ceilings sit above this app: Cloudinary rejects uploads over 10 MB,
 * and a camera original can exceed that. Capping the long edge keeps uploads
 * comfortably inside it.
 *
 * This costs no print quality. The card's photo slot is ~0.975in × 1.218in and
 * the print target is 600 dpi, so a full-height crop only needs ~731px. A
 * 2400px long edge still yields roughly 2000 dpi — over three times the target
 * — while the untouched originals were arriving at ~3000 dpi, which the
 * cropper already flagged as "High DPI".
 *
 * Crucially this runs at file-selection time, before cropping. The crop box is
 * expressed in pixels of the image the user cropped, so shrinking the image
 * afterwards would silently misalign every crop.
 */

/** Long-edge cap. Keeps a 4:5 portrait around 2400×3000. */
const MAX_EDGE = 2400;

/** Re-encode anything above this even if dimensions are already small. */
const MAX_BYTES = 8 * 1024 * 1024;

export type NormalizedPhoto = {
  file: File;
  dataUrl: string;
  resized: boolean;
  originalBytes: number;
};

function loadImage(dataUrl: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not decode that image file"));
    img.src = dataUrl;
  });
}

function readAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read that file"));
    reader.readAsDataURL(file);
  });
}

export async function normalizePhoto(file: File): Promise<NormalizedPhoto> {
  const originalBytes = file.size;
  const dataUrl = await readAsDataUrl(file);
  const img = await loadImage(dataUrl);

  const longEdge = Math.max(img.naturalWidth, img.naturalHeight);
  const needsResize = longEdge > MAX_EDGE || originalBytes > MAX_BYTES;
  if (!needsResize) {
    return { file, dataUrl, resized: false, originalBytes };
  }

  const scale = Math.min(1, MAX_EDGE / longEdge);
  const width = Math.max(1, Math.round(img.naturalWidth * scale));
  const height = Math.max(1, Math.round(img.naturalHeight * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return { file, dataUrl, resized: false, originalBytes };
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, width, height);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.92),
  );
  if (!blob) return { file, dataUrl, resized: false, originalBytes };

  const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
  return {
    file: new File([blob], name, { type: "image/jpeg" }),
    dataUrl: canvas.toDataURL("image/jpeg", 0.92),
    resized: true,
    originalBytes,
  };
}
