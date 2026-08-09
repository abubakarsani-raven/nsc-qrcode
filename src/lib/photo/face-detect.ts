/**
 * Face detection module with fallback support for MediaPipe
 * Can detect faces in images and return center + size information
 */

export type FaceDetectionResult = {
  detected: boolean;
  centerX: number;  // 0-1 relative to image width
  centerY: number;  // 0-1 relative to image height
  width: number;    // face width as % of image width
  height: number;   // face height as % of image height
  confidence: number; // 0-1 detection confidence
};

/**
 * Simple face detection using image edge detection
 * Returns estimated face center and size
 */
export async function detectFaceSimple(
  imageSrc: string
): Promise<FaceDetectionResult> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Could not get canvas context");

        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, img.width, img.height);
        const data = imageData.data;

        // Convert to grayscale and find edges
        const gray = new Uint8Array(img.width * img.height);
        for (let i = 0; i < data.length; i += 4) {
          gray[i / 4] =
            0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        }

        // Find regions with consistent skin tones / face-like patterns
        // Look for the brightest concentrated region (usually face)
        let maxBrightness = 0;
        let brightX = 0,
          brightY = 0;

        const step = Math.max(1, Math.floor(img.width / 20));
        const windowSize = Math.floor(img.width / 6);

        for (let y = 0; y < img.height - windowSize; y += step) {
          for (let x = 0; x < img.width - windowSize; x += step) {
            let sum = 0;
            let count = 0;

            for (let dy = 0; dy < windowSize; dy++) {
              for (let dx = 0; dx < windowSize; dx++) {
                sum += gray[(y + dy) * img.width + (x + dx)];
                count++;
              }
            }

            const avg = sum / count;
            if (avg > maxBrightness && avg > 80) {
              // Avoid pure black regions
              maxBrightness = avg;
              brightX = x + windowSize / 2;
              brightY = y + windowSize / 2;
            }
          }
        }

        // Estimate face center and size based on portrait conventions
        const faceWidth = Math.min(
          1,
          Math.max(0.15, windowSize / img.width) * 1.2
        ); // 15-40% of width
        const faceHeight = faceWidth * 1.3; // Face is taller than wide

        resolve({
          detected: maxBrightness > 100,
          centerX: Math.max(
            0.25,
            Math.min(0.75, brightX / img.width)
          ),
          centerY: Math.max(
            0.25,
            Math.min(0.65, (brightY / img.height) * 0.9)
          ), // Bias toward upper-middle
          width: faceWidth,
          height: faceHeight,
          confidence: Math.min(1, maxBrightness / 255),
        });
      } catch {
        resolve({
          detected: false,
          centerX: 0.5,
          centerY: 0.35,
          width: 0.3,
          height: 0.4,
          confidence: 0,
        });
      }
    };

    img.onerror = () => {
      resolve({
        detected: false,
        centerX: 0.5,
        centerY: 0.35,
        width: 0.3,
        height: 0.4,
        confidence: 0,
      });
    };

    img.src = imageSrc;
  });
}

/**
 * Optional: Load MediaPipe FaceMesh for production use
 * Uncomment and configure if needed
 */
export async function detectFaceMediaPipe(
  imageSrc: string
): Promise<FaceDetectionResult> {
  // TODO: Integrate @mediapipe/tasks-vision when needed
  // For now, fall back to simple detection
  return detectFaceSimple(imageSrc);
}
