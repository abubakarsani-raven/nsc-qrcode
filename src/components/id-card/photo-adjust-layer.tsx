"use client";

import { useEffect, useRef, useState } from "react";
import type { Rect } from "@/lib/id-card/slots.generated";
import {
  cropOverhang,
  cropZoom,
  panCrop,
  placement,
  rotatedBounds,
  zoomCrop,
  type CardCrop,
  type Size,
} from "@/lib/photo/card-crop";

export type PhotoAdjust = {
  /** The uncropped original. */
  src: string;
  natural: Size;
  crop: CardCrop;
  onChange: (crop: CardCrop) => void;
};

/**
 * One row/column (or corner pixel) of the original, stretched over `w × h` at
 * (x, y) — the SVG counterpart of sharp's `extend({ extendWith: "copy" })`.
 */
function EdgeStrip({
  src,
  natural,
  view,
  x,
  y,
  w,
  h,
}: {
  src: string;
  natural: Size;
  view: [number, number, number, number];
  x: number;
  y: number;
  w: number;
  h: number;
}) {
  return (
    <svg x={x} y={y} width={w} height={h} viewBox={view.join(" ")} preserveAspectRatio="none">
      <image href={src} width={natural.w} height={natural.h} preserveAspectRatio="none" />
    </svg>
  );
}

/** The original, positioned so `crop` fills the frame exactly as the print cut will. */
function PlacedOriginal({
  adjust,
  frame,
  extendEdges = false,
}: {
  adjust: PhotoAdjust;
  frame: Rect;
  /** Repeat the edge pixels outward, as the print does where the crop overhangs. */
  extendEdges?: boolean;
}) {
  const { natural, crop, src } = adjust;
  const bounds = rotatedBounds(natural, crop.rotation);
  const { s, ox, oy } = placement(frame, crop);
  const ix = (bounds.w - natural.w) / 2;
  const iy = (bounds.h - natural.h) / 2;
  const { w: nw, h: nh } = natural;
  // Longer than any allowed overhang.
  const p = Math.max(nw, nh);
  const strip = (view: [number, number, number, number], x: number, y: number, w: number, h: number) => (
    <EdgeStrip src={src} natural={natural} view={view} x={x} y={y} w={w} h={h} />
  );
  return (
    <g transform={`translate(${ox} ${oy}) scale(${s})`}>
      <g transform={`rotate(${crop.rotation ?? 0} ${bounds.w / 2} ${bounds.h / 2})`}>
        {extendEdges && cropOverhang(crop).w > 0 ? (
          <g>
            {strip([0, 0, nw, 1], ix, iy - p, nw, p)}
            {strip([0, nh - 1, nw, 1], ix, iy + nh, nw, p)}
            {strip([0, 0, 1, nh], ix - p, iy, p, nh)}
            {strip([nw - 1, 0, 1, nh], ix + nw, iy, p, nh)}
            {strip([0, 0, 1, 1], ix - p, iy - p, p, p)}
            {strip([nw - 1, 0, 1, 1], ix + nw, iy - p, p, p)}
            {strip([0, nh - 1, 1, 1], ix - p, iy + nh, p, p)}
            {strip([nw - 1, nh - 1, 1, 1], ix + nw, iy + nh, p, p)}
          </g>
        ) : null}
        <image
          href={src}
          x={ix}
          y={iy}
          width={nw}
          height={nh}
          preserveAspectRatio="none"
        />
      </g>
    </g>
  );
}

/**
 * Photo layer while adjusting: a faint ghost of the whole original for
 * context, and the part inside the frame at full strength.
 */
export function PhotoAdjustImage({
  adjust,
  frame,
  clipId,
}: {
  adjust: PhotoAdjust;
  frame: Rect;
  clipId: string;
}) {
  return (
    <g pointerEvents="none">
      <g opacity={0.3}>
        <PlacedOriginal adjust={adjust} frame={frame} />
      </g>
      <g clipPath={`url(#${clipId})`}>
        <PlacedOriginal adjust={adjust} frame={frame} extendEdges />
      </g>
    </g>
  );
}

/**
 * Full-card hit area, drawn last so it sits above the text: drag to move the
 * photo, wheel / +/- to zoom, arrow keys to nudge by half a point.
 */
export function PhotoAdjustHitArea({
  adjust,
  frame,
  page,
  radius,
}: {
  adjust: PhotoAdjust;
  frame: Rect;
  page: Size;
  radius: number;
}) {
  const hitRef = useRef<SVGRectElement>(null);
  const latest = useRef(adjust);
  latest.current = adjust;
  const drag = useRef<{ x: number; y: number; id: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  const bounds = () => rotatedBounds(latest.current.natural, latest.current.crop.rotation);
  const ptPerPx = () => {
    const rect = hitRef.current?.getBoundingClientRect();
    return rect && rect.width ? page.w / rect.width : 1;
  };
  const zoomBy = (factor: number) => {
    const { crop, onChange } = latest.current;
    onChange(zoomCrop(crop, cropZoom(crop, bounds()) * factor, bounds()));
  };

  useEffect(() => {
    const el = hitRef.current;
    if (!el) return;
    // React's onWheel is passive; zooming must stop the page from scrolling.
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      zoomBy(Math.exp(-e.deltaY * 0.0015));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <rect
        x={frame.x}
        y={frame.y}
        width={frame.w}
        height={frame.h}
        rx={radius}
        fill="none"
        stroke="#0E7490"
        strokeWidth={0.6}
        strokeDasharray="2 1.5"
        pointerEvents="none"
      />
      <rect
        ref={hitRef}
        x={0}
        y={0}
        width={page.w}
        height={page.h}
        fill="transparent"
        tabIndex={0}
        role="slider"
        aria-label="Photo position — drag to move, scroll to zoom"
        aria-valuenow={Math.round(cropZoom(adjust.crop, bounds()) * 100)}
        style={{ cursor: dragging ? "grabbing" : "grab", touchAction: "none", outline: "none" }}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          drag.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
          setDragging(true);
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d || d.id !== e.pointerId) return;
          const k = ptPerPx();
          const { crop, onChange } = latest.current;
          onChange(panCrop(crop, frame, (e.clientX - d.x) * k, (e.clientY - d.y) * k, bounds()));
          drag.current = { ...d, x: e.clientX, y: e.clientY };
        }}
        onPointerUp={(e) => {
          if (drag.current?.id === e.pointerId) drag.current = null;
          setDragging(false);
        }}
        onPointerCancel={() => {
          drag.current = null;
          setDragging(false);
        }}
        onKeyDown={(e) => {
          const { crop, onChange } = latest.current;
          const nudge: Record<string, [number, number]> = {
            ArrowLeft: [-0.5, 0],
            ArrowRight: [0.5, 0],
            ArrowUp: [0, -0.5],
            ArrowDown: [0, 0.5],
          };
          if (nudge[e.key]) {
            e.preventDefault();
            const [dx, dy] = nudge[e.key];
            onChange(panCrop(crop, frame, dx, dy, bounds()));
          } else if (e.key === "+" || e.key === "=") {
            e.preventDefault();
            zoomBy(1.05);
          } else if (e.key === "-") {
            e.preventDefault();
            zoomBy(1 / 1.05);
          }
        }}
      />
    </>
  );
}
