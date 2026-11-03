/**
 * Minimal RFC 4180 CSV parser: quoted fields, escaped quotes (""), commas and
 * newlines inside quotes, CRLF line endings, and a leading UTF-8 BOM (Excel
 * adds one when saving "CSV UTF-8"). Safe to run in the browser and on the server.
 */
export function parseCsvRows(text: string): string[][] {
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        field += c;
      }
      continue;
    }
    if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  // Drop blank lines.
  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

/** Header row + records keyed by trimmed header name. */
export function parseCsv(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const [head, ...body] = parseCsvRows(text);
  if (!head) return { headers: [], rows: [] };
  const headers = head.map((h) => h.trim());
  const rows = body.map((cols) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => {
      if (h) obj[h] = (cols[i] ?? "").trim();
    });
    return obj;
  });
  return { headers, rows };
}
