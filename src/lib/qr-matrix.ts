import QRCode from "qrcode";

/** Build a boolean module matrix for vector drawing (force v4 to match sample module pitch) */
export async function qrMatrix(text: string, ecLevel: "M" | "L" | "Q" | "H" = "M") {
  const modules = await QRCode.create(text, {
    errorCorrectionLevel: ecLevel,
    version: 4,
  });
  const size = modules.modules.size;
  const data = modules.modules.data;
  const rows: boolean[][] = [];
  for (let y = 0; y < size; y++) {
    const row: boolean[] = [];
    for (let x = 0; x < size; x++) {
      row.push(!!data[y * size + x]);
    }
    rows.push(row);
  }
  return { size, rows };
}
