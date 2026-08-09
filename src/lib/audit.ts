import type { AuditType } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export async function audit(
  actorId: string,
  type: AuditType,
  staffId?: string | null,
  metadata?: Record<string, unknown>,
) {
  return prisma.auditEvent.create({
    data: {
      actorId,
      type,
      staffId: staffId ?? null,
      metadata: metadata ? JSON.stringify(metadata) : null,
    },
  });
}
