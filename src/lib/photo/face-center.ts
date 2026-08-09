import { FACE_FRAMING } from "@/lib/id-card/slots.generated";

export type FaceHint = {
  centerX: number;
  centerY: number;
  eyeLineFromTop: number;
  faceHeightRatio: number;
};

/**
 * Client-side face auto-center hook point.
 * When MediaPipe assets are present under /vendor/mediapipe, wire detection here.
 * Fallback: calibrated framing constants from the sample card.
 */
export function fallbackFaceHint(): FaceHint {
  return {
    centerX: 0.5,
    centerY: FACE_FRAMING.eyeLineFromTop,
    eyeLineFromTop: FACE_FRAMING.eyeLineFromTop,
    faceHeightRatio: FACE_FRAMING.faceHeightRatio,
  };
}
