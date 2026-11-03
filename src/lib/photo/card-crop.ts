/**
 * Geometry for positioning a photo directly on the card.
 *
 * A crop is a 4:5 box in the coordinates of the (rotated) original — the same
 * shape react-easy-crop produces and the server pipeline cuts
 * (`sharp().rotate(r)`, edge-padded where the crop overhangs, then
 * `.extract(crop)`). The card frame then shows that cut
 * `cover`-fitted and centred, so the frame's centre is the crop's centre and
 * the scale is set by whichever side fills the frame first.
 */

import type { Rect } from "@/lib/id-card/slots.generated";
import { PHOTO_DPI_FLOOR, PHOTO_SLOT_INCHES } from "@/lib/id-card/slots.generated";

export const CROP_ASPECT = 4 / 5;

export type CardCrop = {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  zoom?: number;
};

export type Size = { w: number; h: number };

/** Bounding box of the original after rotation (what the crop is relative to). */
export function rotatedBounds(natural: Size, rotation = 0): Size {
  const rad = (rotation * Math.PI) / 180;
  const cos = Math.abs(Math.cos(rad));
  const sin = Math.abs(Math.sin(rad));
  return {
    w: natural.w * cos + natural.h * sin,
    h: natural.w * sin + natural.h * cos,
  };
}

/** Points per source pixel, and where the rotated bounds' top-left lands on the card. */
export function placement(frame: Rect, crop: CardCrop) {
  const s = Math.max(frame.w / crop.width, frame.h / crop.height);
  const cx = frame.x + frame.w / 2;
  const cy = frame.y + frame.h / 2;
  return {
    s,
    ox: cx - (crop.x + crop.width / 2) * s,
    oy: cy - (crop.y + crop.height / 2) * s,
  };
}

/** Smallest crop width the print floor allows. */
export function minCropWidth() {
  return Math.ceil(PHOTO_SLOT_INCHES.width * PHOTO_DPI_FLOOR);
}

export function maxCropWidth(bounds: Size) {
  return Math.min(bounds.w, bounds.h * CROP_ASPECT);
}

export function cropDpi(crop: CardCrop) {
  return Math.min(crop.width / PHOTO_SLOT_INCHES.width, crop.height / PHOTO_SLOT_INCHES.height);
}

/**
 * How far the crop may run past the photo's edges, as a fraction of its own
 * size. The print pads that strip by repeating the edge pixels (so a head near
 * the top of a photo can still sit lower in a circle). Only for right-angle
 * rotations — other angles have blank corners that would smear.
 */
export const CROP_OVERHANG = 0.3;

export function cropOverhang(crop: Pick<CardCrop, "width" | "height" | "rotation">): Size {
  if ((crop.rotation ?? 0) % 90 !== 0) return { w: 0, h: 0 };
  return { w: Math.floor(crop.width * CROP_OVERHANG), h: Math.floor(crop.height * CROP_OVERHANG) };
}

function clampAxis(start: number, size: number, extent: number, overhang: number) {
  return Math.min(extent - size + overhang, Math.max(-overhang, start));
}

/** Keep the crop 4:5, within reach of the bounds, and no smaller than the dpi floor allows. */
export function clampCrop(crop: CardCrop, bounds: Size): CardCrop {
  const maxW = maxCropWidth(bounds);
  const width = Math.min(maxW, Math.max(Math.min(minCropWidth(), maxW), crop.width));
  const height = width / CROP_ASPECT;
  const cx = crop.x + crop.width / 2;
  const cy = crop.y + crop.height / 2;
  const over = cropOverhang({ width, height, rotation: crop.rotation });
  return {
    ...crop,
    width,
    height,
    x: clampAxis(cx - width / 2, width, bounds.w, over.w),
    y: clampAxis(cy - height / 2, height, bounds.h, over.h),
  };
}

/** Whole pixels, within the image plus its allowed overhang. */
export function roundCrop(crop: CardCrop, bounds: Size): CardCrop {
  const maxW = Math.floor(bounds.w);
  const maxH = Math.floor(bounds.h);
  const width = Math.min(maxW, Math.round(crop.width));
  const height = Math.min(maxH, Math.round(crop.height));
  const over = cropOverhang({ width, height, rotation: crop.rotation });
  return {
    ...crop,
    width,
    height,
    x: clampAxis(Math.round(crop.x), width, maxW, over.w),
    y: clampAxis(Math.round(crop.y), height, maxH, over.h),
  };
}

/** Move the photo by (dx, dy) card points — the crop moves the opposite way. */
export function panCrop(crop: CardCrop, frame: Rect, dxPt: number, dyPt: number, bounds: Size) {
  const { s } = placement(frame, crop);
  return clampCrop({ ...crop, x: crop.x - dxPt / s, y: crop.y - dyPt / s }, bounds);
}

/** Zoom level 1 = the largest crop that fits; higher shows a tighter cut. */
export function cropZoom(crop: CardCrop, bounds: Size) {
  return maxCropWidth(bounds) / crop.width;
}

export function maxZoom(bounds: Size) {
  return Math.max(1, maxCropWidth(bounds) / Math.min(minCropWidth(), maxCropWidth(bounds)));
}

/** Set the zoom level, keeping the crop centred where it was. */
export function zoomCrop(crop: CardCrop, zoom: number, bounds: Size): CardCrop {
  const width = maxCropWidth(bounds) / Math.max(1, zoom);
  const height = width / CROP_ASPECT;
  const cx = crop.x + crop.width / 2;
  const cy = crop.y + crop.height / 2;
  return clampCrop({ ...crop, width, height, x: cx - width / 2, y: cy - height / 2 }, bounds);
}

/** Centred crop at zoom 1, with the eyes roughly on the sample's eye line. */
export function defaultCrop(bounds: Size, rotation = 0): CardCrop {
  const width = maxCropWidth(bounds);
  const height = width / CROP_ASPECT;
  return {
    x: (bounds.w - width) / 2,
    y: Math.max(0, (bounds.h - height) / 3),
    width,
    height,
    rotation,
  };
}
