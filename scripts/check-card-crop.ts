/**
 * Checks that dragging/zooming the photo on the card shows exactly what the
 * server will cut: the SVG placement (card-crop.ts) is rasterised next to the
 * sharp pipeline's crop + cover-fit, for several crops including rotation and
 * a crop dragged past the photo's top edge (edge-padded).
 *
 *   node --import tsx scripts/check-card-crop.ts <photo>
 */
import sharp from "sharp";
import { FRONT_TEMPLATES } from "../src/lib/id-card/slots.generated";
import {
  clampCrop,
  cropOverhang,
  defaultCrop,
  panCrop,
  placement,
  rotatedBounds,
  roundCrop,
  zoomCrop,
  type CardCrop,
} from "../src/lib/photo/card-crop";

const DPI = 600;
const px = (pt: number) => (pt / 72) * DPI;

async function serverCut(source: Buffer, crop: CardCrop, rotation: number) {
  const { data, info } = await sharp(source).rotate(rotation).raw().toBuffer({ resolveWithObject: true });
  const raw = { width: info.width, height: info.height, channels: info.channels };
  const pad = {
    left: Math.max(0, -crop.x),
    top: Math.max(0, -crop.y),
    right: Math.max(0, crop.x + crop.width - info.width),
    bottom: Math.max(0, crop.y + crop.height - info.height),
  };
  const padded = await sharp(data, { raw }).extend({ ...pad, extendWith: "copy" }).raw().toBuffer();
  return sharp(padded, {
    raw: { ...raw, width: raw.width + pad.left + pad.right, height: raw.height + pad.top + pad.bottom },
  }).extract({ left: crop.x + pad.left, top: crop.y + pad.top, width: crop.width, height: crop.height });
}

async function main() {
  const file = process.argv[2];
  if (!file) throw new Error("usage: check-card-crop.ts <photo>");
  const source = await sharp(file).jpeg().toBuffer();
  const meta = await sharp(source).metadata();
  const natural = { w: meta.width!, h: meta.height! };
  const frame = FRONT_TEMPLATES.NPERA_GREEN.photoFrame;
  const W = Math.round(px(frame.w));
  const H = Math.round(px(frame.h));
  const b64 = `data:image/jpeg;base64,${source.toString("base64")}`;

  const cases: [string, number][] = [
    ["default", 0],
    ["zoomed+panned", 0],
    ["rotated 7°", 7],
    ["rotated 90°", 90],
    ["dragged down", 0],
  ];
  let worst = 0;
  for (const [label, rotation] of cases) {
    const bounds = rotatedBounds(natural, rotation);
    let crop: CardCrop = defaultCrop(bounds, rotation);
    if (label === "dragged down") {
      crop = panCrop({ ...crop, y: 0 }, frame, 0, 40, bounds);
    } else if (label !== "default") {
      crop = zoomCrop(crop, 1.6, bounds);
      crop = panCrop(crop, frame, 6, -4, bounds);
    }
    crop = roundCrop(clampCrop(crop, bounds), bounds);
    if (label === "dragged down" && crop.y >= 0) {
      console.error("FAIL: the crop could not be dragged past the photo's top edge");
      process.exit(1);
    }

    const server = await (await serverCut(source, crop, rotation))
      .resize(W, H, { fit: "cover", position: "centre" })
      .removeAlpha()
      .raw()
      .toBuffer();

    const { s, ox, oy } = placement(frame, crop);
    const k = DPI / 72;
    const ix = (bounds.w - natural.w) / 2;
    const iy = (bounds.h - natural.h) / 2;
    const { w: nw, h: nh } = natural;
    const p = Math.max(nw, nh);
    const strip = (view: number[], x: number, y: number, w: number, h: number) =>
      `<svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox="${view.join(" ")}" preserveAspectRatio="none">
        <image xlink:href="${b64}" width="${nw}" height="${nh}" preserveAspectRatio="none"/></svg>`;
    const strips =
      cropOverhang(crop).w > 0
        ? [
            strip([0, 0, nw, 1], ix, iy - p, nw, p),
            strip([0, nh - 1, nw, 1], ix, iy + nh, nw, p),
            strip([0, 0, 1, nh], ix - p, iy, p, nh),
            strip([nw - 1, 0, 1, nh], ix + nw, iy, p, nh),
          ].join("")
        : "";
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}">
      <g transform="scale(${k}) translate(${-frame.x} ${-frame.y}) translate(${ox} ${oy}) scale(${s})">
        <g transform="rotate(${rotation} ${bounds.w / 2} ${bounds.h / 2})">
          ${strips}
          <image xlink:href="${b64}" x="${ix}" y="${iy}"
            width="${nw}" height="${nh}" preserveAspectRatio="none"/>
        </g>
      </g></svg>`;
    const preview = await sharp(Buffer.from(svg))
      .flatten({ background: "#000" })
      .removeAlpha()
      .raw()
      .toBuffer();

    // Compare the inner 90% (edge pixels differ only by resampling).
    let sum = 0;
    let n = 0;
    for (let y = Math.round(H * 0.05); y < H * 0.95; y += 2) {
      for (let x = Math.round(W * 0.05); x < W * 0.95; x += 2) {
        const i = (y * W + x) * 3;
        for (let c = 0; c < 3; c++) sum += Math.abs(server[i + c] - preview[i + c]);
        n += 3;
      }
    }
    const mean = sum / n;
    worst = Math.max(worst, mean);
    console.log(`${label.padEnd(14)} crop ${crop.width}×${crop.height} @${crop.x},${crop.y}  mean |Δ| = ${mean.toFixed(2)}`);
  }
  if (worst > 6) {
    console.error(`FAIL: preview and print cut differ (mean |Δ| ${worst.toFixed(2)})`);
    process.exit(1);
  }
  console.log("OK: on-card placement matches the print cut");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
