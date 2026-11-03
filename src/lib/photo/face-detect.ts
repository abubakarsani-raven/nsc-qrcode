/**
 * Lightweight face-position heuristic (no ML model): finds the brightest
 * concentrated region of a portrait, which in a typical ID photo against a
 * plain background is the face. Good enough to get the framing close; the
 * user fine-tunes by dragging.
 */

export type FaceDetectionResult = {
  detected: boolean;
  /** 0–1 relative to image width. */
  centerX: number;
  /** 0–1 relative to image height. */
  centerY: number;
  /** Face width as a fraction of image width. */
  width: number;
  /** Face height as a fraction of image height. */
  height: number;
  /** 0–1 detection confidence. */
  confidence: number;
};

const NOT_FOUND: FaceDetectionResult = {
  detected: false,
  centerX: 0.5,
  centerY: 0.35,
  width: 0.3,
  height: 0.4,
  confidence: 0,
};

/** Analysis resolution. The heuristic needs shape, not detail. */
const ANALYSIS_EDGE = 160;

function loadImage(src: string) {
  return new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

export async function detectFaceSimple(imageSrc: string): Promise<FaceDetectionResult> {
  const img = await loadImage(imageSrc);
  if (!img || !img.naturalWidth) return NOT_FOUND;

  try {
    const scale = Math.min(1, ANALYSIS_EDGE / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return NOT_FOUND;
    ctx.drawImage(img, 0, 0, w, h);
    const { data } = ctx.getImageData(0, 0, w, h);

    // Summed-area table of luminance: any window's sum in O(1).
    const sat = new Float64Array((w + 1) * (h + 1));
    for (let y = 0; y < h; y++) {
      let row = 0;
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        row += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        sat[(y + 1) * (w + 1) + (x + 1)] = sat[y * (w + 1) + (x + 1)] + row;
      }
    }
    const windowSum = (x: number, y: number, s: number) =>
      sat[(y + s) * (w + 1) + (x + s)] -
      sat[y * (w + 1) + (x + s)] -
      sat[(y + s) * (w + 1) + x] +
      sat[y * (w + 1) + x];

    const win = Math.max(4, Math.floor(w / 6));
    let best = 0;
    let bx = w / 2;
    let by = h / 3;
    for (let y = 0; y + win <= h; y++) {
      for (let x = 0; x + win <= w; x++) {
        const avg = windowSum(x, y, win) / (win * win);
        if (avg > best && avg > 80) {
          best = avg;
          bx = x + win / 2;
          by = y + win / 2;
        }
      }
    }

    const faceWidth = Math.min(1, Math.max(0.15, win / w) * 1.2);
    return {
      detected: best > 100,
      centerX: Math.max(0.25, Math.min(0.75, bx / w)),
      // Bias toward upper-middle, where faces sit in portraits.
      centerY: Math.max(0.25, Math.min(0.65, (by / h) * 0.9)),
      width: faceWidth,
      height: Math.min(1, ((faceWidth * w) / h) * 1.3),
      confidence: Math.min(1, best / 255),
    };
  } catch {
    // Tainted canvas (cross-origin image without CORS) or decode failure.
    return NOT_FOUND;
  }
}
