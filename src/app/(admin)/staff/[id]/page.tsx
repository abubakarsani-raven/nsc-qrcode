import { Suspense } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { auth, can } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { draftVsPublishedDiff } from "@/lib/staff";
import { StaffEditor } from "../staff-editor";
import { AuditLog } from "../audit-log";
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

  // The list is capped at 30; the count tells the header how many exist.
  const auditCount = await prisma.auditEvent.count({
    where: { staffId: staff.id },
  });

  const role = session!.user.role as Role;
  const diffs = draftVsPublishedDiff(staff, staff.published);

  return (
    <div className="space-y-8">
      <div>
        <p className="md-body-medium mb-2 text-[var(--md-on-surface-variant)]">
          <Link href="/staff" className="hover:text-[var(--md-primary)]">
            Staff
          </Link>
          <span className="mx-1.5">/</span>
          <span className="text-[var(--md-on-surface)]">
            {staff.lastName} {staff.firstName}
          </span>
        </p>
        <h1 className="nsc-page-title">
          {staff.lastName} {staff.firstName}
        </h1>
        <p className="nsc-page-sub">
          {staff.designation} ·{" "}
          <span className="md-data">{staff.idNumber}</span>
        </p>
      </div>

      {diffs && diffs.length > 0 ? (
        <div className="rounded-[var(--md-shape-md)] bg-[var(--md-warning-container)] p-4 text-[var(--md-on-warning-container)]">
          <p className="md-title-small text-[var(--md-on-warning-container)]">
            Draft vs published
          </p>
          <ul className="md-body-medium mt-2 space-y-1">
            {diffs.map((d) => (
              <li key={d.field}>
                <span className="font-medium">{d.field}:</span> {d.published || "—"} →{" "}
                {d.draft || "—"}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <Suspense fallback={<div className="md-card h-40 animate-pulse" />}>
        <StaffEditor
          initial={{
            id: staff.id,
            idNumber: staff.idNumber,
            firstName: staff.firstName,
            middleName: staff.middleName,
            lastName: staff.lastName,
            designation: staff.designation,
            posting: staff.posting,
            department: staff.department,
            dateIssued: staff.dateIssued
              ? staff.dateIssued.toISOString().slice(0, 10)
              : null,
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
            cardTypeScale: staff.cardTypeScale,
            lastPrintedAt: staff.lastPrintedAt?.toISOString() ?? null,
            canMedical: can(role, "medical"),
            canApprove: can(role, "approve"),
            canPrint: can(role, "print"),
            canSuspend: can(role, "suspend"),
            canQr: can(role, "regenerateQr"),
          }}
        />
      </Suspense>

      <AuditLog
        staffId={staff.id}
        canClear={can(role, "clearAudit")}
        totalCount={auditCount}
        events={staff.auditEvents.map((e) => ({
          id: e.id,
          type: e.type,
          actorName: e.actor.name,
          createdAtLabel: e.createdAt.toLocaleString(),
        }))}
      />
    </div>
  );
}
