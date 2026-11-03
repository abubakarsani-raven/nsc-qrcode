/**
 * Small WebP thumbnails of every template for the staff table and the
 * template picker (the full PNGs are ~600 dpi and far too heavy for lists).
 *
 *   node --import tsx scripts/gen-template-thumbs.ts
 */
import { mkdirSync, readdirSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const root = path.join(process.cwd(), "public/id-card/templates");
const out = path.join(root, "thumbs");
mkdirSync(out, { recursive: true });

async function main() {
  for (const side of ["fronts", "backs"]) {
    for (const file of readdirSync(path.join(root, side))) {
      if (!file.endsWith(".png")) continue;
      const id = file.replace(/\.png$/, "");
      await sharp(path.join(root, side, file))
        .resize({ width: 240 })
        .webp({ quality: 82 })
        .toFile(path.join(out, `${id}.webp`));
      console.log(`thumbs/${id}.webp`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
