"use client";

type ApiBody = { error?: unknown; [key: string]: unknown };

/**
 * Parse a response body without throwing. A crashed route or proxy returns an
 * HTML error page, and `res.json()` on that throws "Unexpected token <" —
 * which used to surface to users as the toast text.
 */
export async function readJson<T = ApiBody>(res: Response): Promise<T & ApiBody> {
  try {
    return (await res.json()) as T & ApiBody;
  } catch {
    return {} as T & ApiBody;
  }
}

/** Best human-readable message from an API error body. */
export function errorMessage(res: Response, data: ApiBody, fallback: string) {
  if (typeof data.error === "string" && data.error) return data.error;
  if (res.status === 401) return "Your session has expired — sign in again.";
  if (res.status === 403) return "You don't have permission to do that.";
  if (res.status === 413) return "That's too large for the server to accept.";
  if (res.status >= 500) return `${fallback} — server error (${res.status}). Try again.`;
  return fallback;
}

/** Network failures (offline, DNS, CORS) arrive as a TypeError from fetch. */
export function networkMessage(err: unknown, fallback: string) {
  if (err instanceof TypeError) return "Couldn't reach the server. Check your connection.";
  return err instanceof Error && err.message ? err.message : fallback;
}

/** Save a blob as a file. The URL is revoked later — revoking immediately can cancel the download. */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
