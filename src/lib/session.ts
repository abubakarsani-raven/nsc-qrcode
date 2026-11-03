import type { Session } from "next-auth";
import { NextResponse } from "next/server";
import { auth, can, type AppRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type AuthedSession = Session & { user: { id: string; role: AppRole } };
type Gate = { session: AuthedSession; error?: never } | { session?: never; error: NextResponse };

/**
 * The JWT only proves who signed in and what their role was *then*. Re-read the
 * user so a deactivated account or a changed role takes effect immediately
 * instead of when the token expires.
 */
export async function requireSession(): Promise<Gate> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { active: true, role: true },
  });
  if (!user?.active) {
    return { error: NextResponse.json({ error: "Your account is no longer active" }, { status: 401 }) };
  }
  session.user.role = user.role;
  return { session: session as AuthedSession };
}

export async function requirePermission(action: Parameters<typeof can>[1]): Promise<Gate> {
  const result = await requireSession();
  if (result.error) return result;
  if (!can(result.session.user.role, action)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return result;
}
