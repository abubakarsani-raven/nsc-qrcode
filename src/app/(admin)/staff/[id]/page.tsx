import { notFound } from "next/navigation";
import { auth, can } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { draftVsPublishedDiff } from "@/lib/staff";
import { StaffEditor } from "../staff-editor";
import type {
  BackTemplateId,
  FrontTemplateId,
} from "@/lib/id-card/slots.generated";
import type { Role } from "@/generated/prisma/client";

type Ctx = { params: Promise<{ id: string }> };

export default async function StaffDetailPage({ params }: Ctx) {
  const session = await auth();
  const { id } = await params;
  const staff = await prisma.staff.findUnique({
    where: { id },
    include: {
      published: true,
      auditEvents: {
        orderBy: { createdAt: "desc" },
        take: 30,
        include: { actor: { select: { name: true } } },
      },
    },
  });
  if (!staff) notFound();

  const role = session!.user.role as Role;
  const diffs = draftVsPublishedDiff(staff, staff.published);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[#0d4720]">
          {staff.lastName} {staff.firstName}
        </h1>
        <p className="text-sm text-neutral-600">
          {staff.designation} · {staff.idNumber}
        </p>
      </div>

      {diffs && diffs.length > 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm">
          <p className="font-medium text-amber-900">Draft vs published</p>
          <ul className="mt-2 space-y-1 text-amber-900/90">
            {diffs.map((d) => (
              <li key={d.field}>
                <span className="font-medium">{d.field}:</span> {d.published || "—"} →{" "}
                {d.draft || "—"}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <StaffEditor
        initial={{
          id: staff.id,
          idNumber: staff.idNumber,
          firstName: staff.firstName,
          middleName: staff.middleName,
          lastName: staff.lastName,
          designation: staff.designation,
          officeLine: staff.officeLine,
          emergencyContactName: staff.emergencyContactName,
          emergencyContactPhone: staff.emergencyContactPhone,
          bloodGroup: can(role, "medical") ? staff.bloodGroup : null,
          genotype: can(role, "medical") ? staff.genotype : null,
          frontTemplate: staff.frontTemplate as FrontTemplateId,
          backTemplate: staff.backTemplate as BackTemplateId,
          qrToken: staff.qrToken,
          status: staff.status,
          approvalState: staff.approvalState,
          hasPendingEdits: staff.hasPendingEdits,
          photoPreviewKey: staff.photoPreviewKey,
          lastPrintedAt: staff.lastPrintedAt?.toISOString() ?? null,
          canMedical: can(role, "medical"),
          canApprove: can(role, "approve"),
          canPrint: can(role, "print"),
          canSuspend: can(role, "suspend"),
          canQr: can(role, "regenerateQr"),
        }}
      />

      <section className="rounded-xl border border-neutral-200 bg-white p-4">
        <h2 className="mb-2 font-medium text-[#0d4720]">Audit log</h2>
        <ul className="space-y-1 text-sm text-neutral-700">
          {staff.auditEvents.map((e) => (
            <li key={e.id} className="flex justify-between gap-3 border-t border-neutral-100 py-1.5">
              <span>
                {e.type} · {e.actor.name}
              </span>
              <span className="text-neutral-500">
                {e.createdAt.toLocaleString()}
              </span>
            </li>
          ))}
          {staff.auditEvents.length === 0 ? (
            <li className="text-neutral-500">No events yet</li>
          ) : null}
        </ul>
      </section>
    </div>
  );
}
