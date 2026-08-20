"use client";

import {
  FRONT_TEMPLATES,
  PAGE,
  type BackTemplateId,
  type FrontTemplateId,
} from "@/lib/id-card/slots.generated";
import { layoutName } from "@/lib/id-card/name-layout";
import {
  CARD_THEMES,
  ID_TRACKING_EM,
  NAME_TOP_NUDGE_PT,
  TITLE_RULE,
} from "@/lib/id-card/theme";
import {
  BASE_PT,
  DEFAULT_TYPE_SCALE,
  type CardTypeScale,
} from "@/lib/id-card/type-scale";
import { publicVerifyUrl } from "@/lib/qr";
import { roundedQrDataUrl } from "@/lib/qr-render";
import { useEffect, useMemo, useState } from "react";

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
  scale?: number;
  /** Per-record type sizing for name / designation / ID line. */
  typeScale?: CardTypeScale;
};

export function CardPreview(props: Props) {
  const scale = props.scale ?? 2.2;
  const width = PAGE.width * scale;
  const height = PAGE.height * scale;
  const front = FRONT_TEMPLATES[props.frontTemplate];
  const theme = CARD_THEMES[front.colorMatch];
  const given = [props.firstName, props.middleName].filter(Boolean).join(" ");
  const type = props.typeScale ?? DEFAULT_TYPE_SCALE;
  const name = useMemo(
    () => layoutName(props.lastName, given, props.frontTemplate, type.name),
    [props.lastName, given, props.frontTemplate, type.name],
  );
  const designationPt = BASE_PT.designation * type.designation;
  const idPt = BASE_PT.idNo * type.idNo;
  const [qrDataUrl, setQrDataUrl] = useState<string>("");

  useEffect(() => {
    const url = publicVerifyUrl(props.qrToken, window.location.origin);
    roundedQrDataUrl(url, 320).then(setQrDataUrl);
  }, [props.qrToken]);

  if (props.side === "back") {
    return (
      <div
        className="relative overflow-hidden bg-white shadow-lg"
        style={{ width, height }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/id-card/templates/backs/${props.backTemplate}.png?v=17`}
          alt=""
          className="absolute inset-0 h-full w-full object-fill"
        />
      </div>
    );
  }

  // Use measured circular frame (square bbox) — not border-radius:50% on the 4:5 image box (that becomes a tall oval).
  const frame = front.photoFrame;
  const photoStyle = {
    left: frame.x * scale,
    top: frame.y * scale,
    width: frame.w * scale,
    height: frame.h * scale,
    borderRadius:
      front.photoMask === "circle"
        ? "50%"
        : `${(front.photoRadiusPt ?? 6) * scale}px`,
    overflow: "hidden" as const,
    backgroundColor: "#ffffff",
    // Photo halo matches Canva #D3DCF1 — thin ring, not spread far
    boxShadow: `0 0 0 ${3.5 * scale}px #D3DCF1`,
    zIndex: 2,
  };

  // Sample QR has no white plate — sit modules on the card art with a thin quiet margin.
  const moduleBox = front.qr.moduleBox;
  const modulePt = moduleBox.w / 33; // version-4 module pitch
  const qrPad = 1 * modulePt;
  const qrStyle = {
    left: (moduleBox.x - qrPad) * scale,
    top: (moduleBox.y - qrPad) * scale,
    width: (moduleBox.w + qrPad * 2) * scale,
    height: (moduleBox.h + qrPad * 2) * scale,
    zIndex: 2,
  };

  const ruleY =
    (front.designation.y + front.designation.h + TITLE_RULE.offsetPt) * scale;
  const ruleX = (front.contentAxisX - TITLE_RULE.widthPt / 2) * scale;
  const ruleW = TITLE_RULE.widthPt * scale;
  const ruleH = Math.max(1, TITLE_RULE.thicknessPt * scale);

  const idLabel = `ID NO. ${props.idNumber}`;
  const idFontPx = idPt * scale;
  const idTrackingPx = idTracking(idLabel, idFontPx, front.idNo.w * scale);

  return (
    <div
      className="relative overflow-hidden bg-white shadow-lg"
      // Card typography is Poppins at its own metrics — never inherit the UI
      // font stack or its Material letter-spacing.
      style={{
        width,
        height,
        fontFamily: "Poppins, sans-serif",
        letterSpacing: "normal",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/id-card/templates/fronts/${props.frontTemplate}.png?v=17`}
        alt=""
        className="absolute inset-0 h-full w-full object-fill"
      />
      <div className="absolute" style={photoStyle}>
        {props.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={props.photoUrl}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-neutral-100 text-[10px] text-neutral-500">
            No photo
          </div>
        )}
      </div>
      {/* One name stack — sample leading ~11pt; never overlap absolute line boxes */}
      <div
        className="absolute text-center uppercase"
        style={{
          left: front.nameLine1.x * scale,
          top: (front.nameLine1.y + NAME_TOP_NUDGE_PT) * scale,
          width: front.nameLine1.w * scale,
          fontSize: name.fontSizePt * scale,
          lineHeight: `${name.leadingPt * scale}px`,
          color: theme.name,
          zIndex: 3,
        }}
      >
        <div className="whitespace-nowrap font-normal">
          <span className="font-bold">{name.surname}</span>
          {name.line1Given ? (
            <>
              {" "}
              <span>{name.line1Given}</span>
            </>
          ) : null}
        </div>
        {name.line2 ? (
          <div className="whitespace-nowrap font-normal">{name.line2}</div>
        ) : null}
      </div>
      <div
        className="absolute whitespace-nowrap text-center uppercase"
        style={{
          left: front.designation.x * scale,
          top: front.designation.y * scale,
          width: front.designation.w * scale,
          fontSize: designationPt * scale,
          letterSpacing: "normal",
          color: theme.designation,
          zIndex: 3,
        }}
      >
        {props.designation}
      </div>
      {/* Single rule under designation (replaces the erased line in template art) */}
      <div
        className="absolute"
        style={{
          left: ruleX,
          top: ruleY,
          width: ruleW,
          height: ruleH,
          backgroundColor: theme.rule,
          zIndex: 3,
        }}
      />
      <div
        className="absolute whitespace-nowrap text-center font-bold"
        style={{
          left: (front.contentAxisX - front.idNo.w / 2) * scale,
          top: front.idNo.y * scale,
          width: front.idNo.w * scale,
          fontSize: idFontPx,
          letterSpacing: idTrackingPx,
          color: theme.idNo,
          zIndex: 3,
        }}
      >
        {/* letter-spacing also trails the last glyph — pull it back so the
            centred line sits on the same axis the PDF stamps it on. */}
        <span style={{ marginRight: -idTrackingPx }}>
          ID NO. {props.idNumber}
        </span>
      </div>
      {qrDataUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={qrDataUrl}
          alt="QR"
          className="absolute"
          style={qrStyle}
        />
      ) : null}
    </div>
  );
}

/** Sample tracking on the ID line, tightened only if the number would overflow. */
function idTracking(text: string, fontSizePx: number, maxWidthPx: number) {
  if (text.length < 2) return 0;
  let natural = 0;
  for (const ch of text) {
    natural += ch === " " ? fontSizePx * 0.28 : fontSizePx * 0.58;
  }
  const spacing = ID_TRACKING_EM * fontSizePx;
  const gaps = text.length - 1;
  if (natural + spacing * gaps <= maxWidthPx) return spacing;
  return Math.max(0, (maxWidthPx - natural) / gaps);
}
