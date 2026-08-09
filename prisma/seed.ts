import "dotenv/config";
import { seedDatabase } from "../src/lib/db-seed";
import { prisma } from "../src/lib/prisma";

async function main() {
  const result = await seedDatabase();
  console.log("Seed complete.");
  console.log(`Admin: ${result.adminEmail} / ${result.adminPassword}`);
  console.log(`Sample staff QR: ${result.sampleUrl}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
