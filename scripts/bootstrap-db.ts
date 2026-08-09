/**
 * Push Prisma schema to DATABASE_URL (Railway Postgres) and run idempotent seed.
 * Used on Vercel build and local `npm run db:setup`.
 */
import "dotenv/config";
import { execSync } from "node:child_process";
import { seedDatabase } from "../src/lib/db-seed";
import { prisma } from "../src/lib/prisma";

function requireDatabaseUrl() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is required. Set your Railway Postgres connection string.",
    );
  }
  return url;
}

async function main() {
  const url = requireDatabaseUrl();
  console.log(
    `[bootstrap-db] Pushing schema → ${url.replace(/:[^:@/]+@/, ":****@")}`,
  );

  execSync("npx prisma db push", {
    stdio: "inherit",
    env: process.env,
  });

  console.log("[bootstrap-db] Seeding…");
  const result = await seedDatabase();
  console.log("[bootstrap-db] Seed complete.");
  console.log(`  Admin: ${result.adminEmail}`);
  console.log(`  Sample QR: ${result.sampleUrl}`);
}

main()
  .catch((e) => {
    console.error("[bootstrap-db] failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
