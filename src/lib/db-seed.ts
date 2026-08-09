import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { generateQrToken, publicVerifyUrl, assertUrlBudget } from "@/lib/qr";

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

/** Idempotent seed — safe for build, startup, and repeated deploys. */
export async function seedDatabase() {
  const adminPassword = process.env.ADMIN_PASSWORD ?? "ChangeMeAdmin1!";
  const adminEmail = (
    process.env.ADMIN_EMAIL ?? "admin@shipperscouncil.gov.ng"
  ).toLowerCase();

  const admin = await upsertUser(
    adminEmail,
    "System Admin",
    "ADMIN",
    adminPassword,
  );
  await upsertUser(
    "entry@shipperscouncil.gov.ng",
    "Data Entry",
    "DATA_ENTRY",
    "ChangeMeEntry1!",
  );
  await upsertUser(
    "approver@shipperscouncil.gov.ng",
    "Approver",
    "APPROVER",
    "ChangeMeApprove1!",
  );
  await upsertUser(
    "printer@shipperscouncil.gov.ng",
    "Printer",
    "PRINTER",
    "ChangeMePrint1!",
  );

  const existing = await prisma.staff.findUnique({
    where: { idNumber: "1234567890" },
    select: { id: true, qrToken: true },
  });

  const token = existing?.qrToken ?? generateQrToken();
  const url = publicVerifyUrl(token);
  assertUrlBudget(url);

  const sample = await prisma.staff.upsert({
    where: { idNumber: "1234567890" },
    update: {
      firstName: "PIUS",
      middleName: "UKEYIMA",
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
      middleName: "UKEYIMA",
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

  return { adminEmail, adminPassword, sampleUrl: url };
}
