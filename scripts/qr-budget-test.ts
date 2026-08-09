import assert from "assert";
import {
  assertUrlBudget,
  generateQrToken,
  MAX_PUBLIC_URL_BYTES,
  publicVerifyUrl,
} from "../src/lib/qr";

process.env.APP_URL =
  process.env.APP_URL ?? "https://verify.shipperscouncil.gov.ng";

for (let i = 0; i < 20; i++) {
  const token = generateQrToken();
  const url = publicVerifyUrl(token);
  assert.ok(url.length <= MAX_PUBLIC_URL_BYTES, url);
  assertUrlBudget(url);
  assert.equal(token.length, 16);
}

console.log("qr-budget-test: ok");
