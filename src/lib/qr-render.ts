import { qrMatrix } from "@/lib/qr-matrix";

/**
 * Sample Canva cards use rounded-module QR (circular dots + rounded finders)
 * with a transparent background — card art shows through, no white plate.
 */
export async function roundedQrSvg(
  text: string,
  opts: { size?: number; quietModules?: number } = {},
) {
  const sizePx = opts.size ?? 256;
  const quiet = opts.quietModules ?? 1;
  const { size, rows } = await qrMatrix(text, "M");
  const total = size + quiet * 2;
  const modulePx = sizePx / total;
  const offset = quiet * modulePx;

  const parts: string[] = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${sizePx}" height="${sizePx}" viewBox="0 0 ${sizePx} ${sizePx}" shape-rendering="geometricPrecision">`,
  );

  const isFinder = (x: number, y: number) => {
    const inTL = x < 7 && y < 7;
    const inTR = x >= size - 7 && y < 7;
    const inBL = x < 7 && y >= size - 7;
    return inTL || inTR || inBL;
  };

  // Non-finder modules as circles (transparent between modules)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (!rows[y][x] || isFinder(x, y)) continue;
      const cx = offset + (x + 0.5) * modulePx;
      const cy = offset + (y + 0.5) * modulePx;
      const r = modulePx * 0.42;
      parts.push(
        `<circle cx="${cx.toFixed(2)}" cy="${cy.toFixed(2)}" r="${r.toFixed(2)}" fill="#000000"/>`,
      );
    }
  }

  // Rounded finders: black ring (evenodd hole) + black eye — no white fill
  const finders: [number, number][] = [
    [0, 0],
    [size - 7, 0],
    [0, size - 7],
  ];
  for (const [fx, fy] of finders) {
    const x = offset + fx * modulePx;
    const y = offset + fy * modulePx;
    const s = 7 * modulePx;
    const rOuter = modulePx * 1.1;
    const inset = modulePx;
    const sMid = 5 * modulePx;
    const rMid = modulePx * 0.85;
    const sInner = 3 * modulePx;
    const rInner = modulePx * 0.55;
    // Outer rounded square with transparent hole
    parts.push(
      `<path fill="#000000" fill-rule="evenodd" d="` +
        `M ${(x + rOuter).toFixed(2)} ${y.toFixed(2)} ` +
        `H ${(x + s - rOuter).toFixed(2)} ` +
        `A ${rOuter.toFixed(2)} ${rOuter.toFixed(2)} 0 0 1 ${(x + s).toFixed(2)} ${(y + rOuter).toFixed(2)} ` +
        `V ${(y + s - rOuter).toFixed(2)} ` +
        `A ${rOuter.toFixed(2)} ${rOuter.toFixed(2)} 0 0 1 ${(x + s - rOuter).toFixed(2)} ${(y + s).toFixed(2)} ` +
        `H ${(x + rOuter).toFixed(2)} ` +
        `A ${rOuter.toFixed(2)} ${rOuter.toFixed(2)} 0 0 1 ${x.toFixed(2)} ${(y + s - rOuter).toFixed(2)} ` +
        `V ${(y + rOuter).toFixed(2)} ` +
        `A ${rOuter.toFixed(2)} ${rOuter.toFixed(2)} 0 0 1 ${(x + rOuter).toFixed(2)} ${y.toFixed(2)} Z ` +
        `M ${(x + inset + rMid).toFixed(2)} ${(y + inset).toFixed(2)} ` +
        `H ${(x + inset + sMid - rMid).toFixed(2)} ` +
        `A ${rMid.toFixed(2)} ${rMid.toFixed(2)} 0 0 1 ${(x + inset + sMid).toFixed(2)} ${(y + inset + rMid).toFixed(2)} ` +
        `V ${(y + inset + sMid - rMid).toFixed(2)} ` +
        `A ${rMid.toFixed(2)} ${rMid.toFixed(2)} 0 0 1 ${(x + inset + sMid - rMid).toFixed(2)} ${(y + inset + sMid).toFixed(2)} ` +
        `H ${(x + inset + rMid).toFixed(2)} ` +
        `A ${rMid.toFixed(2)} ${rMid.toFixed(2)} 0 0 1 ${(x + inset).toFixed(2)} ${(y + inset + sMid - rMid).toFixed(2)} ` +
        `V ${(y + inset + rMid).toFixed(2)} ` +
        `A ${rMid.toFixed(2)} ${rMid.toFixed(2)} 0 0 1 ${(x + inset + rMid).toFixed(2)} ${(y + inset).toFixed(2)} Z` +
        `"/>`,
    );
    parts.push(
      `<rect x="${(x + inset * 2).toFixed(2)}" y="${(y + inset * 2).toFixed(2)}" width="${sInner.toFixed(2)}" height="${sInner.toFixed(2)}" rx="${rInner.toFixed(2)}" fill="#000000"/>`,
    );
  }

  parts.push(`</svg>`);
  return parts.join("");
}

export async function roundedQrDataUrl(text: string, size = 256) {
  const svg = await roundedQrSvg(text, { size, quietModules: 1 });
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
