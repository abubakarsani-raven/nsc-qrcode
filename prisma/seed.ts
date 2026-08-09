import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { generateQrToken, publicVerifyUrl, assertUrlBudget } from "../src/lib/qr";

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString:
      process.env.DATABASE_URL ??
      "postgresql://abubakarsani@localhost:5432/nsc_qrcode?schema=public",
  }),
});

async function upsertUser(
  email: string,
  name: string,
  role: "ADMIN" | "DATA_ENTRY" | "APPROVER" | "PRINTER",
  password: string,
) {
  const passwordHash = await bcrypt.hash(password, 12);
  return prisma.user.upsert({
    where: { email },
    update: { name, role, passwordHash, active: true },
    create: { email, name, role, passwordHash },
  });
}

async function main() {
  const adminPassword = process.env.ADMIN_PASSWORD ?? "ChangeMeAdmin1!";
  const adminEmail = (
    process.env.ADMIN_EMAIL ?? "admin@shipperscouncil.gov.ng"
  ).toLowerCase();

  const admin = await upsertUser(adminEmail, "System Admin", "ADMIN", adminPassword);
  await upsertUser("entry@shipperscouncil.gov.ng", "Data Entry", "DATA_ENTRY", "ChangeMeEntry1!");
  await upsertUser("approver@shipperscouncil.gov.ng", "Approver", "APPROVER", "ChangeMeApprove1!");
  await upsertUser("printer@shipperscouncil.gov.ng", "Printer", "PRINTER", "ChangeMePrint1!");

  const token = generateQrToken();
  const url = publicVerifyUrl(token);
  assertUrlBudget(url);

  const sample = await prisma.staff.upsert({
    where: { idNumber: "1234567890" },
    update: {
      firstName: "PIUS",
      middleName: null,
      lastName: "AKUTAH",
      designation: "EXECUTIVE SECRETARY/CEO",
      approvalState: "APPROVED",
      approvedById: admin.id,
      approvedAt: new Date(),
      hasPendingEdits: false,
      officeLine: "070987670655",
      emergencyContactName: "NSC Duty Officer",
      emergencyContactPhone: "070987670655",
      bloodGroup: "O+",
      genotype: "AA",
      frontTemplate: "WAVE_GREEN",
      backTemplate: "BACK_WAVE_GREEN",
      status: "ACTIVE",
    },
    create: {
      idNumber: "1234567890",
      firstName: "PIUS",
      lastName: "AKUTAH",
      designation: "EXECUTIVE SECRETARY/CEO",
      qrToken: token,
      approvalState: "APPROVED",
      approvedById: admin.id,
      approvedAt: new Date(),
      officeLine: "070987670655",
      emergencyContactName: "NSC Duty Officer",
      emergencyContactPhone: "070987670655",
      bloodGroup: "O+",
      genotype: "AA",
      frontTemplate: "WAVE_GREEN",
      backTemplate: "BACK_WAVE_GREEN",
    },
  });

  // Name display rule: surname bold — store surname as lastName = AKUTAH, given = PIUS UKEYIMA
  // Re-seed with correct name parts matching sample "AKUTAH PIUS UKEYIMA"
  await prisma.staff.update({
    where: { id: sample.id },
    data: {
      firstName: "PIUS",
      middleName: "UKEYIMA",
      lastName: "AKUTAH",
    },
  });

  await prisma.staffPublished.upsert({
    where: { staffId: sample.id },
    update: {
      firstName: "PIUS",
      middleName: "UKEYIMA",
      lastName: "AKUTAH",
      designation: "EXECUTIVE SECRETARY/CEO",
      idNumber: "1234567890",
      officeLine: "070987670655",
      emergencyContactName: "NSC Duty Officer",
      emergencyContactPhone: "070987670655",
      publishedById: admin.id,
      publishedAt: new Date(),
    },
    create: {
      staffId: sample.id,
      publishedById: admin.id,
      firstName: "PIUS",
      middleName: "UKEYIMA",
      lastName: "AKUTAH",
      designation: "EXECUTIVE SECRETARY/CEO",
      idNumber: "1234567890",
      officeLine: "070987670655",
      emergencyContactName: "NSC Duty Officer",
      emergencyContactPhone: "070987670655",
    },
  });

  console.log("Seed complete.");
  console.log(`Admin: ${adminEmail} / ${adminPassword}`);
  console.log(`Sample staff QR: ${url}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
