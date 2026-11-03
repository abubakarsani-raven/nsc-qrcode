/**
 * Minimal Code 128 encoder (code sets B and C) returning bar geometry in
 * modules, so the preview (SVG), the raster card and the print PDF (vector
 * rectangles) draw identical bars.
 */

/** Bar/space widths for symbol values 0–106 (106 = stop). */
const PATTERNS = [
  "212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312", "132212", "221213",
  "221312", "231212", "112232", "122132", "122231", "113222", "123122", "123221", "223211", "221132",
  "221231", "213212", "223112", "312131", "311222", "321122", "321221", "312212", "322112", "322211",
  "212123", "212321", "232121", "111323", "131123", "131321", "112313", "132113", "132311", "211313",
  "231113", "231311", "112133", "112331", "132131", "113123", "113321", "133121", "313121", "211331",
  "231131", "213113", "213311", "213131", "311123", "311321", "331121", "312113", "312311", "332111",
  "314111", "221411", "431111", "111224", "111422", "121124", "121421", "141122", "141221", "112214",
  "112412", "122114", "122411", "142112", "142211", "241211", "221114", "413111", "241112", "134111",
  "111242", "121142", "121241", "114212", "124112", "124211", "411212", "421112", "421211", "212141",
  "214121", "412121", "111143", "111341", "131141", "114113", "114311", "411113", "411311", "113141",
  "114131", "311141", "411131", "211412", "211214", "211232", "2331112",
];

const START_B = 104;
const START_C = 105;
const CODE_B = 100;
const CODE_C = 99;
const STOP = 106;

export type Code128 = {
  /** Symbol values including start, checksum and stop. */
  values: number[];
  /** Dark bars as [startModule, widthModules]. */
  bars: Array<[number, number]>;
  totalModules: number;
};

function digitRun(text: string, from: number) {
  let i = from;
  while (i < text.length && text.charCodeAt(i) >= 48 && text.charCodeAt(i) <= 57) i++;
  return i - from;
}

/**
 * `compactDigits` packs digit runs two-per-symbol (code set C). Turning it off
 * keeps everything in code set B: a longer, denser-looking symbol that still
 * decodes to the same text.
 */
export function encodeCode128(
  input: string,
  { compactDigits = true }: { compactDigits?: boolean } = {},
): Code128 {
  // Code set B covers printable ASCII; anything else is dropped.
  const text = Array.from(input)
    .filter((ch) => ch.charCodeAt(0) >= 32 && ch.charCodeAt(0) <= 126)
    .join("");
  const values: number[] = [];
  let set: "B" | "C" | null = null;
  const switchTo = (next: "B" | "C") => {
    if (set === next) return;
    values.push(set === null ? (next === "B" ? START_B : START_C) : next === "B" ? CODE_B : CODE_C);
    set = next;
  };

  let i = 0;
  while (i < text.length) {
    let run = digitRun(text, i);
    const atEdge = i === 0 || i + run === text.length;
    if (compactDigits && (run >= 6 || (atEdge && run >= 4))) {
      if (run % 2 === 1) {
        switchTo("B");
        values.push(text.charCodeAt(i) - 32);
        i++;
        run--;
      }
      switchTo("C");
      for (let end = i + run; i < end; i += 2) values.push(Number(text.slice(i, i + 2)));
    } else {
      switchTo("B");
      values.push(text.charCodeAt(i) - 32);
      i++;
    }
  }
  if (values.length === 0) switchTo("B");

  const checksum =
    values.reduce((sum, v, idx) => sum + v * (idx === 0 ? 1 : idx), 0) % 103;
  values.push(checksum, STOP);

  const bars: Array<[number, number]> = [];
  let x = 0;
  for (const v of values) {
    const widths = PATTERNS[v];
    for (let k = 0; k < widths.length; k++) {
      const w = Number(widths[k]);
      if (k % 2 === 0) bars.push([x, w]);
      x += w;
    }
  }
  return { values, bars, totalModules: x };
}

export type BarcodeFit = {
  /** Prefer code set B (denser look) when its bars stay printable. */
  compactDigits: boolean;
  /** Narrowest module a card printer reproduces reliably (2 dots at 300 dpi ≈ 0.48 pt). */
  minModulePt: number;
  /** The symbol may grow past `box.w` up to this width, centred on the box. */
  maxWidthPt: number;
};

/**
 * Bars for `text`, stretched to fill `box`. Falls back to compact digits, then
 * widens symmetrically, rather than letting modules drop below `minModulePt`.
 */
export function code128Rects(
  text: string,
  box: { x: number; y: number; w: number; h: number },
  fit: Partial<BarcodeFit> = {},
) {
  const minModule = fit.minModulePt ?? 0;
  const candidates = fit.compactDigits === false
    ? [encodeCode128(text, { compactDigits: false }), encodeCode128(text)]
    : [encodeCode128(text)];
  let code = candidates.find((c) => box.w / c.totalModules >= minModule);
  let width = box.w;
  if (!code) {
    code = candidates[candidates.length - 1];
    width = Math.min(fit.maxWidthPt ?? box.w, code.totalModules * minModule);
    width = Math.max(width, box.w);
  }
  const x0 = box.x + (box.w - width) / 2;
  const modulePt = width / code.totalModules;
  return code.bars.map(([start, w]) => ({
    x: x0 + start * modulePt,
    y: box.y,
    w: w * modulePt,
    h: box.h,
  }));
}

/** Inverse of the encoder, for tests: returns the text or null when invalid. */
export function decodeCode128(values: number[]): string | null {
  if (values.length < 3 || values[values.length - 1] !== STOP) return null;
  const data = values.slice(0, -2);
  const check =
    data.reduce((sum, v, idx) => sum + v * (idx === 0 ? 1 : idx), 0) % 103;
  if (check !== values[values.length - 2]) return null;
  let set: "B" | "C" = data[0] === START_C ? "C" : "B";
  let out = "";
  for (const v of data.slice(1)) {
    if (v === CODE_B) set = "B";
    else if (v === CODE_C) set = "C";
    else out += set === "C" ? String(v).padStart(2, "0") : String.fromCharCode(v + 32);
  }
  return out;
}
