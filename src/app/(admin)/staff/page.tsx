import { Suspense } from "react";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { fullName } from "@/lib/staff";
import { StaffFilters } from "./staff-filters";
import { StaffBulkActions } from "./staff-bulk-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type Sp = Promise<{
  q?: string;
  status?: string;
  approvalState?: string;
  missingPhoto?: string;
  frontTemplate?: string;
}>;

export default async function StaffPage({ searchParams }: { searchParams: Sp }) {
  const sp = await searchParams;
  const where: Record<string, unknown> = {};
  if (sp.status === "ACTIVE" || sp.status === "SUSPENDED") where.status = sp.status;
  if (sp.approvalState === "PENDING" || sp.approvalState === "APPROVED") {
    where.approvalState = sp.approvalState;
  }
  if (sp.missingPhoto === "1") where.photoPreviewKey = null;
  if (sp.frontTemplate) where.frontTemplate = sp.frontTemplate;
  if (sp.q) {
    where.OR = [
      { idNumber: { contains: sp.q } },
      { firstName: { contains: sp.q } },
      { lastName: { contains: sp.q } },
      { designation: { contains: sp.q } },
    ];
  }

  const [staff, missingPhotoCount, pendingCount] = await Promise.all([
    prisma.staff.findMany({
      where,
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
    prisma.staff.count({ where: { photoPreviewKey: null } }),
    prisma.staff.count({ where: { approvalState: "PENDING" } }),
  ]);

  const hasFilters = Boolean(
    sp.q || sp.status || sp.approvalState || sp.missingPhoto || sp.frontTemplate,
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="nsc-page-title">Staff</h1>
          <p className="nsc-page-sub">
            <span className="font-medium text-[var(--nsc-ink)]">{staff.length}</span>
            {" "}
            record{staff.length === 1 ? "" : "s"}
            {sp.missingPhoto === "1" ? " missing photos" : ""}
            {missingPhotoCount > 0 || pendingCount > 0 ? (
              <span className="text-[var(--nsc-secondary)]">
                {" · "}
                {missingPhotoCount > 0
                  ? `${missingPhotoCount} need photo`
                  : null}
                {missingPhotoCount > 0 && pendingCount > 0 ? " · " : null}
                {pendingCount > 0 ? `${pendingCount} pending approval` : null}
              </span>
            ) : null}
          </p>
        </div>
        <Link href="/staff/new">
          <Button className="h-10 rounded-full bg-[var(--nsc-green)] px-5 hover:bg-[var(--nsc-green-hover)]">
            Add staff
          </Button>
        </Link>
      </div>

      <Suspense fallback={<div className="nsc-surface h-24 animate-pulse" />}>
        <StaffFilters />
      </Suspense>
      <StaffBulkActions
        staff={staff.map((s) => ({ id: s.id, label: fullName(s) }))}
      />

      <div className="nsc-surface hidden overflow-hidden md:block">
        <table className="w-full min-w-max text-[13px]">
          <thead>
            <tr className="border-b border-[var(--nsc-separator)] bg-[#fafafa]">
              {[
                "Name",
                "ID",
                "Designation",
                "Status",
                "Approval",
                "Photo",
                "Template",
                "",
              ].map((h) => (
                <th
                  key={h || "action"}
                  className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--nsc-secondary)]"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {staff.map((s) => (
              <tr
                key={s.id}
                className="border-b border-[var(--nsc-separator)] last:border-0 transition-colors hover:bg-[#fafafa]"
              >
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full bg-[var(--nsc-fill)]">
                      {s.photoPreviewKey ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={`/api/photos/${s.id}/${s.photoPreviewKey}`}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : null}
                    </div>
                    <div>
                      <Link
                        href={`/staff/${s.id}`}
                        className="font-medium text-[var(--nsc-ink)] hover:text-[var(--nsc-green)]"
                      >
                        {fullName(s)}
                      </Link>
                      {s.hasPendingEdits ? (
                        <Badge variant="warning" className="ml-2">
                          Edits pending
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                </td>
                <td className="px-5 py-3.5 font-mono text-[12px] text-[var(--nsc-secondary)]">
                  {s.idNumber}
                </td>
                <td className="px-5 py-3.5 text-[var(--nsc-ink)]/80">
                  {s.designation}
                </td>
                <td className="px-5 py-3.5">
                  <Badge variant={s.status === "ACTIVE" ? "success" : "error"}>
                    {s.status === "ACTIVE" ? "Active" : "Suspended"}
                  </Badge>
                </td>
                <td className="px-5 py-3.5">
                  <Badge
                    variant={
                      s.approvalState === "APPROVED" ? "success" : "warning"
                    }
                  >
                    {s.approvalState === "APPROVED" ? "Approved" : "Pending"}
                  </Badge>
                </td>
                <td className="px-5 py-3.5">
                  <Badge variant={s.photoPreviewKey ? "success" : "warning"}>
                    {s.photoPreviewKey ? "Ready" : "No photo"}
                  </Badge>
                </td>
                <td className="px-5 py-3.5 text-[var(--nsc-secondary)]">
                  {s.frontTemplate.replace(/_/g, " ").toLowerCase()}
                </td>
                <td className="px-5 py-3.5 text-right">
                  <Link href={`/staff/${s.id}`}>
                    <Button variant="ghost" size="sm">
                      Open
                    </Button>
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {staff.length === 0 ? (
          <EmptyState hasFilters={hasFilters} />
        ) : null}
      </div>

      <div className="space-y-3 md:hidden">
        {staff.length === 0 ? (
          <div className="nsc-surface">
            <EmptyState hasFilters={hasFilters} />
          </div>
        ) : (
          staff.map((s) => (
            <Link key={s.id} href={`/staff/${s.id}`} className="block">
              <article className="nsc-surface p-4 transition-transform active:scale-[0.99]">
                <div className="flex items-start gap-3">
                  <div className="h-11 w-11 shrink-0 overflow-hidden rounded-full bg-[var(--nsc-fill)]">
                    {s.photoPreviewKey ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={`/api/photos/${s.id}/${s.photoPreviewKey}`}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[15px] font-semibold tracking-tight">
                          {fullName(s)}
                        </p>
                        <p className="mt-0.5 font-mono text-[12px] text-[var(--nsc-secondary)]">
                          {s.idNumber}
                        </p>
                      </div>
                      <Badge
                        variant={s.status === "ACTIVE" ? "success" : "error"}
                      >
                        {s.status === "ACTIVE" ? "Active" : "Suspended"}
                      </Badge>
                    </div>
                    <p className="mt-2 text-[13px] text-[var(--nsc-ink)]/80">
                      {s.designation}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Badge
                        variant={
                          s.approvalState === "APPROVED" ? "success" : "warning"
                        }
                      >
                        {s.approvalState === "APPROVED"
                          ? "Approved"
                          : "Pending"}
                      </Badge>
                      <Badge
                        variant={s.photoPreviewKey ? "success" : "warning"}
                      >
                        {s.photoPreviewKey ? "Photo ready" : "No photo"}
                      </Badge>
                    </div>
                  </div>
                </div>
              </article>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}

function EmptyState({ hasFilters }: { hasFilters: boolean }) {
  return (
    <div className="px-5 py-14 text-center">
      <p className="text-[15px] font-medium text-[var(--nsc-ink)]">
        {hasFilters ? "No staff match these filters" : "No staff records yet"}
      </p>
      <p className="mt-1 text-[13px] text-[var(--nsc-secondary)]">
        {hasFilters
          ? "Clear filters or try a different search."
          : "Add a person or import a spreadsheet to get started."}
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        {hasFilters ? (
          <Link href="/staff">
            <Button variant="outline" className="rounded-full">
              Clear filters
            </Button>
          </Link>
        ) : null}
        <Link href="/staff/new">
          <Button className="rounded-full bg-[var(--nsc-green)] hover:bg-[var(--nsc-green-hover)]">
            Add staff
          </Button>
        </Link>
        {!hasFilters ? (
          <Link href="/import">
            <Button variant="outline" className="rounded-full">
              Import
            </Button>
          </Link>
        ) : null}
      </div>
    </div>
  );
}
