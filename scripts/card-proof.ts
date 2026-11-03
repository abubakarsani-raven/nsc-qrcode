/**
 * Render proof cards and check layout fidelity without a database.
 *
 *   node -r ./scripts/mock-server-only.cjs --import tsx scripts/card-proof.ts
 *
 * - Every text line on every front template (including long names) must have
 *   its ink centred within 0.5 pt of the template's content axis.
 * - Writes tmp/proofs/*.pdf (one card per file) and a CR80 imposition sheet.
 *
 * Photos come from tmp/proof-photos/<staffId>/preview.png when present.
 */
import fs from "fs/promises";
import path from "path";
import assert from "assert";

delete process.env.CLOUDINARY_URL;
delete process.env.CLOUDINARY_CLOUD_NAME;
process.env.PHOTO_STORAGE_DIR = path.join(process.cwd(), "tmp", "proof-photos");

const MAX_AXIS_DEVIATION_PT = 0.5;

const NAMES = [
  { firstName: "Mohammed", lastName: "Audu", designation: "Deputy Director", idNumber: "20050578" },
  { firstName: "Ifeoma", middleName: "Chinwendu", lastName: "Okonkwo-Adeyemi", designation: "Assistant Chief Administrative Officer", idNumber: "20231145" },
  { firstName: "Abdulrahman", middleName: "Oluwaseun Babatunde", lastName: "Mohammed-Bello", designation: "Principal Manager, Legal", idNumber: "NPERA/2024/00117" },
  { firstName: "Ada", lastName: "Eze", designation: "Driver", idNumber: "7" },
];

async function main() {
  const { FRONT_TEMPLATES, FRONT_DEFAULT_BACK } = await import("../src/lib/id-card/slots.generated");
  const { layoutFront, maxAxisDeviation } = await import("../src/lib/id-card/card-layout");
  const { renderStaffCardPdf, renderImposedSheet } = await import("../src/lib/id-card/render-pdf");
  type FrontId = keyof typeof FRONT_TEMPLATES;

  let failures = 0;
  for (const front of Object.keys(FRONT_TEMPLATES) as FrontId[]) {
    for (const person of NAMES) {
      for (const [surname, otherNames] of [[1, 1], [1.25, 0.75], [0.75, 1.25]]) {
        const layout = layoutFront({
          frontTemplate: front,
          ...person,
          text: { scale: { surname, otherNames, designation: 1, idNo: 1 }, tightName: false },
        });
        const dev = maxAxisDeviation(layout);
        if (dev > MAX_AXIS_DEVIATION_PT) {
          failures++;
          console.error(`AXIS ${front} ${person.lastName} (${surname}/${otherNames}): ${dev.toFixed(3)} pt off`);
        }
        if (surname === 1 && otherNames === 1) {
          if (layout.name.lineCount !== 2) {
            failures++;
            console.error(`LINES ${front} ${person.lastName}: ${layout.name.lineCount} name lines`);
          }
          if (layout.name.overflow) {
            failures++;
            console.error(`FIT ${front} ${person.lastName}: name doesn't fit at 100%`);
          }
        }
      }
    }
  }
  assert.equal(failures, 0, `${failures} layouts off-axis`);
  console.log("axis: every line within", MAX_AXIS_DEVIATION_PT, "pt of its template axis");

  const { BACK_TEMPLATES } = await import("../src/lib/id-card/slots.generated");
  const { code128Rects, decodeCode128, encodeCode128 } = await import("../src/lib/barcode/code128");
  for (const back of Object.values(BACK_TEMPLATES)) {
    if (!back.barcode) continue;
    const { rect, ...fit } = back.barcode;
    for (const { idNumber } of NAMES) {
      for (const compactDigits of [false, true]) {
        assert.equal(decodeCode128(encodeCode128(idNumber, { compactDigits }).values), idNumber);
      }
      const bars = code128Rects(idNumber, rect, fit);
      const narrowest = Math.min(...bars.map((b) => b.w));
      const left = bars[0].x;
      const right = bars[bars.length - 1].x + bars[bars.length - 1].w;
      assert.ok(narrowest >= fit.minModulePt - 1e-6, `${back.id} ${idNumber}: module ${narrowest}pt`);
      assert.ok(right - left <= fit.maxWidthPt + 1e-6, `${back.id} ${idNumber}: too wide`);
      assert.ok(
        Math.abs((left + right) / 2 - (rect.x + rect.w / 2)) < 0.01,
        `${back.id} ${idNumber}: barcode off-centre`,
      );
    }
  }
  console.log("barcode: every sample ID round-trips, stays centred and printable");

  const outDir = path.join(process.cwd(), "tmp", "proofs");
  await fs.mkdir(outDir, { recursive: true });

  const cards = [
    { id: "proof-npera", front: "NPERA_GREEN" as FrontId, person: NAMES[0] },
    { id: "proof-npera-long", front: "NPERA_GREEN" as FrontId, person: NAMES[2] },
    { id: "proof-npera-mid", front: "NPERA_GREEN" as FrontId, person: NAMES[1] },
    { id: "proof-nsc", front: "WAVE_GREEN" as FrontId, person: NAMES[1] },
    { id: "proof-nsc-long", front: "WAVE_BLUE" as FrontId, person: NAMES[2] },
    { id: "proof-nsc-bar", front: "BAR_BLUE_SQUARE" as FrontId, person: NAMES[0] },
  ];
  const inputs = [];
  for (const card of cards) {
    const photoDir = path.join(process.env.PHOTO_STORAGE_DIR!, card.id);
    const hasPhoto = await fs
      .access(path.join(photoDir, "preview.png"))
      .then(() => true)
      .catch(() => false);
    const input = {
      id: card.id,
      ...card.person,
      qrToken: "proofqrtoken0001",
      frontTemplate: card.front,
      backTemplate: FRONT_DEFAULT_BACK[card.front],
      photoPreviewKey: hasPhoto ? "preview.png" : null,
    };
    inputs.push(input);
    const bytes = await renderStaffCardPdf(input);
    const file = path.join(outDir, `${card.id}.pdf`);
    await fs.writeFile(file, bytes);
    const layout = layoutFront({ frontTemplate: card.front, ...card.person });
    console.log(
      `${card.id}: surname ${layout.surname.sizePt.toFixed(2)}pt, other names ${layout.otherNames.sizePt.toFixed(2)}pt, ` +
        `designation ${layout.designation.sizePt.toFixed(2)}pt, axis dev ${maxAxisDeviation(layout).toFixed(3)}pt -> ${file}`,
    );
  }
  const sheet = await renderImposedSheet(inputs, "A4");
  await fs.writeFile(path.join(outDir, "imposed-a4.pdf"), sheet);
  console.log("imposed sheet ->", path.join(outDir, "imposed-a4.pdf"));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
