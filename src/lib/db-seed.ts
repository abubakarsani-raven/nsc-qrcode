import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { generateQrToken, publicVerifyUrl, assertUrlBudget } from "@/lib/qr";

type SeedRole = "ADMIN" | "DATA_ENTRY" | "APPROVER" | "PRINTER";

const DEFAULT_ADMIN_PASSWORD = "ChangeMeAdmin1!";

/** Production deploy (Vercel/Railway/NODE_ENV) — demo data stays out. */
function isProduction() {
  return (
    process.env.VERCEL_ENV === "production" ||
    process.env.RAILWAY_ENVIRONMENT_NAME === "production" ||
    process.env.NODE_ENV === "production"
  );
}

/**
 * Create the user if missing. An existing user's password is only replaced
 * when `resetPassword` is set — the seed runs on every build, and silently
 * resetting passwords (and re-activating disabled accounts) each deploy is
 * not something production should do.
 */
async function ensureUser(
  email: string,
  name: string,
  role: SeedRole,
  password: string,
  resetPassword = false,
) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    if (!resetPassword) return existing;
    return prisma.user.update({
      where: { email },
      data: { passwordHash: await bcrypt.hash(password, 12) },
    });
  }
  return prisma.user.create({
    data: { email, name, role, passwordHash: await bcrypt.hash(password, 12) },
  });
}

/** Idempotent seed — safe for build, startup, and repeated deploys. */
export async function seedDatabase() {
  const prod = isProduction();
  const envPassword = process.env.ADMIN_PASSWORD?.trim();
  const adminPassword = envPassword || DEFAULT_ADMIN_PASSWORD;
  const adminEmail = (
    process.env.ADMIN_EMAIL ?? "admin@shipperscouncil.gov.ng"
  ).toLowerCase();
  const resetAdmin = process.env.ADMIN_PASSWORD_RESET === "1";

  // Never *write* the well-known default password in production.
  const adminExists = await prisma.user.findUnique({ where: { email: adminEmail }, select: { id: true } });
  if (prod && adminPassword === DEFAULT_ADMIN_PASSWORD && (!adminExists || resetAdmin)) {
    throw new Error("Set ADMIN_PASSWORD to a strong, non-default value before seeding production.");
  }

  // ADMIN_PASSWORD_RESET=1 is the deliberate way to recover the admin login.
  const admin = await ensureUser(adminEmail, "System Admin", "ADMIN", adminPassword, resetAdmin);

  // Demo accounts with well-known passwords: development only, or opt-in.
  const seedDemo = !prod || process.env.SEED_DEMO === "1";
  if (!seedDemo) {
    return { adminEmail, adminPassword: "(from ADMIN_PASSWORD)", sampleUrl: "(skipped in production)" };
  }
  await ensureUser("entry@shipperscouncil.gov.ng", "Data Entry", "DATA_ENTRY", "ChangeMeEntry1!");
  await ensureUser("approver@shipperscouncil.gov.ng", "Approver", "APPROVER", "ChangeMeApprove1!");
  await ensureUser("printer@shipperscouncil.gov.ng", "Printer", "PRINTER", "ChangeMePrint1!");

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
