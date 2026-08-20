import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { authConfig } from "@/lib/auth.config";
import type { Role } from "@/generated/prisma/client";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email.toLowerCase() },
        });
        if (!user || !user.active) return null;

        const valid = await bcrypt.compare(
          parsed.data.password,
          user.passwordHash,
        );
        if (!valid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        };
      },
    }),
  ],
});

export type AppRole = Role;

const ROLE_PERMS = {
  createEdit: ["DATA_ENTRY", "APPROVER", "ADMIN"] as Role[],
  photo: ["DATA_ENTRY", "APPROVER", "ADMIN"] as Role[],
  medical: ["APPROVER", "ADMIN"] as Role[],
  approve: ["APPROVER", "ADMIN"] as Role[],
  print: ["APPROVER", "PRINTER", "ADMIN"] as Role[],
  suspend: ["APPROVER", "ADMIN"] as Role[],
  regenerateQr: ["APPROVER", "ADMIN"] as Role[],
  manageUsers: ["ADMIN"] as Role[],
  clearAudit: ["ADMIN"] as Role[],
};

export function can(role: Role, action: keyof typeof ROLE_PERMS) {
  return ROLE_PERMS[action].includes(role);
}
