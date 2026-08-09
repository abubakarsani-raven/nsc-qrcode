import { customAlphabet } from "nanoid";

/** 16-char base32-ish alphabet (no confusing 0/O/1/I) → 80 bits */
const tokenAlphabet = "abcdefghijklmnopqrstuvwxyz234567";
const makeToken = customAlphabet(tokenAlphabet, 16);

export const QR_MODULE_BOX_PT = 38.67;
export const QR_VERSION = 4;
export const QR_EC_LEVEL = "M" as const;
export const MAX_PUBLIC_URL_BYTES = 62;

export function generateQrToken(): string {
  return makeToken();
}

export function publicVerifyUrl(
  token: string,
  appUrl = process.env.APP_URL ?? "http://localhost:3000",
) {
  const base = appUrl.replace(/\/$/, "");
  return `${base}/v/${token}`;
}

export function assertUrlBudget(url: string) {
  if (url.length > MAX_PUBLIC_URL_BYTES) {
    throw new Error(
      `Public QR URL is ${url.length} bytes; max is ${MAX_PUBLIC_URL_BYTES} for version-4 modules`,
    );
  }
}
