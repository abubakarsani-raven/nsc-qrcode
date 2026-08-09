"use client";

import {
  FRONT_TEMPLATES,
  PAGE,
  type BackTemplateId,
  type FrontTemplateId,
} from "@/lib/id-card/slots.generated";
import { layoutName } from "@/lib/id-card/name-layout";
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
};

export function CardPreview(props: Props) {
  const scale = props.scale ?? 2.2;
  const width = PAGE.width * scale;
  const height = PAGE.height * scale;
  const front = FRONT_TEMPLATES[props.frontTemplate];
  const given = [props.firstName, props.middleName].filter(Boolean).join(" ");
  const name = useMemo(
    () => layoutName(props.lastName, given, props.frontTemplate),
    [props.lastName, given, props.frontTemplate],
  );
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
          src={`/id-card/templates/backs/${props.backTemplate}.png?v=15`}
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

  // Sample WAVE cards are light geometric + dark green text (not dark charcoal).
  const nameColor = "#0d4720";
  const titleColor = "#1a3340";
  const idColor = "#0d4720";

  return (
    <div
      className="relative overflow-hidden bg-white shadow-lg"
      style={{ width, height, fontFamily: "Poppins, sans-serif" }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/id-card/templates/fronts/${props.frontTemplate}.png?v=15`}
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
          top: (front.nameLine1.y + 4) * scale,
          width: front.nameLine1.w * scale,
          fontSize: name.fontSizePt * scale,
          lineHeight: `${name.leadingPt * scale}px`,
          color: nameColor,
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
          top: (front.designation.y + (props.frontTemplate === "WAVE_BLUE" ? -3 : 0)) * scale,
          width: front.designation.w * scale,
          fontSize: 6 * scale,
          letterSpacing: "normal",
          color: titleColor,
        }}
      >
        {props.designation}
      </div>
      <div
        className="absolute whitespace-nowrap text-center font-bold"
        style={{
          left: front.idNo.x * scale,
          top: (front.idNo.y + (props.frontTemplate === "WAVE_BLUE" ? -3 : 0)) * scale,
          width: front.idNo.w * scale,
          fontSize: 6 * scale,
          letterSpacing: trackingPx(
            `ID NO. ${props.idNumber}`,
            6 * scale,
            front.idNo.w * scale,
            0.58,
          ),
          color: idColor,
        }}
      >
        ID NO. {props.idNumber}
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

/** Open tracking that still fits on one line (sample ID/title style). */
function trackingPx(
  text: string,
  fontSizePx: number,
  maxWidthPx: number,
  avgGlyphEm: number,
) {
  let natural = 0;
  for (const ch of text) {
    natural += ch === " " ? fontSizePx * 0.28 : fontSizePx * avgGlyphEm;
  }
  if (text.length < 2 || natural >= maxWidthPx) return 0;
  return (maxWidthPx - natural) / (text.length - 1);
}

