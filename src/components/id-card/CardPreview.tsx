"use client";

import {
  BACK_TEMPLATES,
  FRONT_TEMPLATES,
  type BackTemplateId,
  type FrontTemplateId,
} from "@/lib/id-card/slots.generated";
import { layoutFront, type TextRun } from "@/lib/id-card/card-layout";
import type { CardFontId } from "@/lib/id-card/font-metrics.generated";
import {
  DEFAULT_TEXT_SETTINGS,
  type CardTextSettings,
} from "@/lib/id-card/type-scale";
import { code128Rects } from "@/lib/barcode/code128";
import { publicVerifyUrl } from "@/lib/qr";
import { roundedQrDataUrl } from "@/lib/qr-render";
import { useEffect, useId, useMemo, useState } from "react";
import {
  PhotoAdjustHitArea,
  PhotoAdjustImage,
  type PhotoAdjust,
} from "@/components/id-card/photo-adjust-layer";

/** Bump when template PNGs are regenerated. */
const TEMPLATE_VERSION = 18;

const FONT_CSS: Record<CardFontId, { family: string; weight: number }> = {
  "poppins-regular": { family: "Poppins", weight: 400 },
  "poppins-bold": { family: "Poppins", weight: 700 },
  "inter-display-regular": { family: "Inter Display", weight: 400 },
  "inter-display-extrabold": { family: "Inter Display", weight: 800 },
};

type Props = {
  side: "front" | "back";
  frontTemplate: FrontTemplateId;
  backTemplate: BackTemplateId;
  firstName: string;
  middleName?: string | null;
  lastName: string;
  designation: string;
  idNumber: string;
  qrToken: string;
  photoUrl?: string | null;
  /** Pixels per point. */
  scale?: number;
  /** Per-record type sizing and name breaking. */
  text?: CardTextSettings;
  /** When set, the photo is shown from the original and can be dragged / zoomed. */
  photoAdjust?: PhotoAdjust;
};

export function CardPreview(props: Props) {
  const scale = props.scale ?? 2.2;
  return props.side === "back" ? (
    <CardBack {...props} scale={scale} />
  ) : (
    <CardFront {...props} scale={scale} />
  );
}

function CardBack(props: Props & { scale: number }) {
  const back = BACK_TEMPLATES[props.backTemplate];
  const { width, height } = back.page;
  const bars = useMemo(
    () =>
      back.barcode && props.idNumber.trim()
        ? code128Rects(props.idNumber.trim(), back.barcode.rect, back.barcode)
        : [],
    [back.barcode, props.idNumber],
  );
  return (
    <div
      className="relative overflow-hidden bg-white shadow-lg"
      style={{ width: width * props.scale, height: height * props.scale }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/id-card/templates/backs/${props.backTemplate}.png?v=${TEMPLATE_VERSION}`}
        alt=""
        className="absolute inset-0 h-full w-full object-fill"
      />
      {bars.length ? (
        <svg
          className="absolute inset-0 h-full w-full"
          viewBox={`0 0 ${width} ${height}`}
          aria-label={`Barcode ${props.idNumber}`}
        >
          {bars.map((bar, i) => (
            <rect
              key={i}
              x={bar.x}
              y={bar.y}
              width={bar.w}
              height={bar.h}
              fill={back.barcode!.color}
              shapeRendering="crispEdges"
            />
          ))}
        </svg>
      ) : null}
    </div>
  );
}

function CardFront(props: Props & { scale: number }) {
  const front = FRONT_TEMPLATES[props.frontTemplate];
  const { width, height } = front.page;
  const clipId = useId();
  const layout = useMemo(
    () =>
      layoutFront({
        frontTemplate: props.frontTemplate,
        firstName: props.firstName,
        middleName: props.middleName,
        lastName: props.lastName,
        designation: props.designation,
        idNumber: props.idNumber,
        text: props.text ?? DEFAULT_TEXT_SETTINGS,
      }),
    [
      props.frontTemplate,
      props.firstName,
      props.middleName,
      props.lastName,
      props.designation,
      props.idNumber,
      props.text,
    ],
  );

  const [qrDataUrl, setQrDataUrl] = useState("");
  const hasQr = front.qr !== null;
  useEffect(() => {
    if (!hasQr) return;
    const url = publicVerifyUrl(props.qrToken, window.location.origin);
    roundedQrDataUrl(url, 320).then(setQrDataUrl);
  }, [props.qrToken, hasQr]);

  const frame = front.photoFrame;
  const radius = front.photoMask === "circle" ? frame.w / 2 : (front.photoRadiusPt ?? 6);
  const halo = front.halo;

  // Sample QR has no white plate — sit modules on the card art with a thin quiet margin.
  const qrBox = front.qr
    ? (() => {
        const m = front.qr.moduleBox;
        const pad = m.w / 33;
        return { x: m.x - pad, y: m.y - pad, w: m.w + pad * 2, h: m.h + pad * 2 };
      })()
    : null;

  return (
    <div
      className="relative overflow-hidden bg-white shadow-lg"
      style={{ width: width * props.scale, height: height * props.scale }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/id-card/templates/fronts/${props.frontTemplate}.png?v=${TEMPLATE_VERSION}`}
        alt=""
        className="absolute inset-0 h-full w-full object-fill"
      />
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`${props.lastName} ${props.firstName} — ${props.designation}`}
      >
        <defs>
          <clipPath id={clipId}>
            <rect x={frame.x} y={frame.y} width={frame.w} height={frame.h} rx={radius} />
          </clipPath>
        </defs>

        {halo?.position === "outside" ? (
          <rect
            x={frame.x - halo.pt}
            y={frame.y - halo.pt}
            width={frame.w + halo.pt * 2}
            height={frame.h + halo.pt * 2}
            rx={radius + halo.pt}
            fill={halo.color}
          />
        ) : null}
        <g clipPath={`url(#${clipId})`}>
          <rect x={frame.x} y={frame.y} width={frame.w} height={frame.h} fill="#f1f1f1" />
          {props.photoAdjust ? null : props.photoUrl ? (
            <image
              href={props.photoUrl}
              x={frame.x}
              y={frame.y}
              width={frame.w}
              height={frame.h}
              preserveAspectRatio="xMidYMid slice"
            />
          ) : (
            <text
              x={frame.x + frame.w / 2}
              y={frame.y + frame.h / 2}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={4.5}
              fill="#737373"
              fontFamily="sans-serif"
            >
              No photo
            </text>
          )}
        </g>
        {props.photoAdjust ? (
          <PhotoAdjustImage adjust={props.photoAdjust} frame={frame} clipId={clipId} />
        ) : null}
        {halo?.position === "inside" ? (
          <rect
            x={frame.x + halo.pt / 2}
            y={frame.y + halo.pt / 2}
            width={frame.w - halo.pt}
            height={frame.h - halo.pt}
            rx={Math.max(0, radius - halo.pt / 2)}
            fill="none"
            stroke={halo.color}
            strokeWidth={halo.pt}
            pointerEvents="none"
          />
        ) : null}

        {layout.runs.map((run, i) => (
          <SvgRun key={i} run={run} />
        ))}
        <rect
          x={layout.rule.x}
          y={layout.rule.y}
          width={layout.rule.w}
          height={layout.rule.h}
          fill={layout.rule.color}
        />

        {qrBox && qrDataUrl ? (
          <image href={qrDataUrl} x={qrBox.x} y={qrBox.y} width={qrBox.w} height={qrBox.h} />
        ) : null}
        {props.photoAdjust ? (
          <PhotoAdjustHitArea
            adjust={props.photoAdjust}
            frame={frame}
            page={{ w: width, h: height }}
            radius={radius}
          />
        ) : null}
      </svg>
    </div>
  );
}

/**
 * One text run with every glyph pinned to the layout's x — the browser gets no
 * say in kerning, tracking or space collapsing, so it matches the PDF.
 */
function SvgRun({ run }: { run: TextRun }) {
  const chars = Array.from(run.text);
  const kept = chars
    .map((ch, i) => ({ ch, x: run.glyphX[i] }))
    .filter((g) => g.ch !== " ");
  const css = FONT_CSS[run.font];
  return (
    <text
      x={kept.map((g) => g.x.toFixed(3)).join(" ")}
      y={run.baseline}
      fontFamily={`"${css.family}", sans-serif`}
      fontWeight={css.weight}
      fontSize={run.sizePt}
      fill={run.color}
      style={{
        fontKerning: "none",
        fontFeatureSettings: '"liga" 0, "calt" 0',
        letterSpacing: 0,
      }}
    >
      {kept.map((g) => g.ch).join("")}
    </text>
  );
}
