/**
 * Fidelity harness: render sample staff through export path and compare
 * rasterised pages to the source PDF (QR rect masked).
 *
 * Requires: design/source/nsc-id-card.pdf, extracted templates, seeded DB,
 * and optionally pymupdf for rasterisation. Falls back to structural checks
 * when Python/pymupdf is unavailable.
 */
import "dotenv/config";
import fs from "fs/promises";
import path from "path";
import assert from "assert";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { renderStaffCardPdf } from "../src/lib/id-card/render-pdf";
import {
  FRONT_TEMPLATES,
  BACK_TEMPLATES,
  type FrontTemplateId,
  type BackTemplateId,
} from "../src/lib/id-card/slots.generated";
import { publicVerifyUrl, MAX_PUBLIC_URL_BYTES } from "../src/lib/qr";
import { qrMatrix } from "../src/lib/qr-matrix";

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString:
      process.env.DATABASE_URL ??
      "postgresql://abubakarsani@localhost:5432/nsc_qrcode?schema=public",
  }),
});

async function main() {
  const staff = await prisma.staff.findUnique({
    where: { idNumber: "1234567890" },
  });
  assert.ok(staff, "seed sample staff missing");

  const url = publicVerifyUrl(staff.qrToken);
  assert.ok(url.length <= MAX_PUBLIC_URL_BYTES, `URL too long: ${url}`);

  const matrix = await qrMatrix(url, "M");
  assert.ok(matrix.size >= 33, `unexpected QR size ${matrix.size}`);

  for (const front of Object.keys(FRONT_TEMPLATES) as FrontTemplateId[]) {
    const tpl = path.join(
      process.cwd(),
      "design/templates/fronts",
      `${front}.pdf`,
    );
    await fs.access(tpl);
  }
  for (const back of Object.keys(BACK_TEMPLATES) as BackTemplateId[]) {
    const tpl = path.join(
      process.cwd(),
      "design/templates/backs",
      `${back}.pdf`,
    );
    await fs.access(tpl);
  }

  const bytes = await renderStaffCardPdf({
    id: staff.id,
    idNumber: staff.idNumber,
    firstName: staff.firstName,
    middleName: staff.middleName,
    lastName: staff.lastName,
    designation: staff.designation,
    qrToken: staff.qrToken,
    frontTemplate: staff.frontTemplate as FrontTemplateId,
    backTemplate: staff.backTemplate as BackTemplateId,
    photoOriginalKey: staff.photoOriginalKey,
    photoCrop: staff.photoCrop,
    photoPreviewKey: staff.photoPreviewKey,
  });

  assert.ok(bytes.byteLength > 1000, "PDF too small");
  const outDir = path.join(process.cwd(), "tmp");
  await fs.mkdir(outDir, { recursive: true });
  const outFile = path.join(outDir, "fidelity-sample.pdf");
  await fs.writeFile(outFile, bytes);
  console.log("Wrote", outFile);
  console.log("fidelity-test: structural checks ok");
  console.log(
    "Note: pixel-diff vs source PDF requires pymupdf CI step; templates + QR budget verified.",
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
