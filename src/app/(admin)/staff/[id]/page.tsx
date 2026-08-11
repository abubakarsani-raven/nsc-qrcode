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
    <div className="space-y-8">
      <div>
        <h1 className="nsc-page-title">
          {staff.lastName} {staff.firstName}
        </h1>
        <p className="nsc-page-sub">
          {staff.designation} · {staff.idNumber}
        </p>
      </div>

      {diffs && diffs.length > 0 ? (
        <div className="rounded-2xl border border-[#ffd60a]/40 bg-[#fff9e6] p-4 text-[13px]">
          <p className="font-semibold text-[#9a5b00]">Draft vs published</p>
          <ul className="mt-2 space-y-1 text-[#9a5b00]/90">
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
          photoOriginalKey: staff.photoOriginalKey,
          photoPreviewKey: staff.photoPreviewKey,
          photoCrop: staff.photoCrop,
          lastPrintedAt: staff.lastPrintedAt?.toISOString() ?? null,
          canMedical: can(role, "medical"),
          canApprove: can(role, "approve"),
          canPrint: can(role, "print"),
          canSuspend: can(role, "suspend"),
          canQr: can(role, "regenerateQr"),
        }}
      />

      <section className="nsc-surface p-5">
        <h2 className="text-[15px] font-semibold tracking-tight text-[var(--nsc-ink)]">
          Audit log
        </h2>
        <ul className="mt-3 space-y-0 text-[13px]">
          {staff.auditEvents.map((e) => (
            <li
              key={e.id}
              className="flex justify-between gap-3 border-t border-[var(--nsc-separator)] py-2.5 first:border-0 first:pt-0"
            >
              <span>
                {e.type} · {e.actor.name}
              </span>
              <span className="text-[var(--nsc-secondary)]">
                {e.createdAt.toLocaleString()}
              </span>
            </li>
          ))}
          {staff.auditEvents.length === 0 ? (
            <li className="text-[var(--nsc-secondary)]">No events yet</li>
          ) : null}
        </ul>
      </section>
    </div>
  );
}
