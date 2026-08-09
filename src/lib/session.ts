import { auth, can, type AppRole } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function requireSession() {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  return { session };
}

export async function requirePermission(action: Parameters<typeof can>[1]) {
  const result = await requireSession();
  if ("error" in result && result.error) return result;
  const role = result.session!.user.role as AppRole;
  if (!can(role, action)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { session: result.session! };
}
