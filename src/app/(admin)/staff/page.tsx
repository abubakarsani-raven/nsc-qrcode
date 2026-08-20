import { Suspense } from "react";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { fullName } from "@/lib/staff";
import { StaffFilters } from "./staff-filters";
import { StaffBulkActions } from "./staff-bulk-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/staff/pagination";
import { StageRail, stageStates } from "@/components/staff/stage-rail";

const PAGE_SIZE = 25;

type Sp = Promise<{
  q?: string;
  status?: string;
  approvalState?: string;
  missingPhoto?: string;
  frontTemplate?: string;
  page?: string;
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

  const [total, missingPhotoCount, pendingCount] = await Promise.all([
    prisma.staff.count({ where }),
    prisma.staff.count({ where: { photoPreviewKey: null } }),
    prisma.staff.count({ where: { approvalState: "PENDING" } }),
  ]);

  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(
    Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1),
    lastPage,
  );

  const [staff, matchingIds] = await Promise.all([
    prisma.staff.findMany({
      where,
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    // Exports cover everything the filters match, not just the visible page.
    prisma.staff.findMany({
      where,
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: { id: true },
    }),
  ]);

  const hasFilters = Boolean(
    sp.q || sp.status || sp.approvalState || sp.missingPhoto || sp.frontTemplate,
  );

  // Every filter except the page number, so the steps keep the current view.
  const baseQuery = new URLSearchParams(
    Object.entries(sp).filter(
      ([k, v]) => k !== "page" && typeof v === "string" && v,
    ) as [string, string][],
  ).toString();

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="md-eyebrow">Card production</p>
          <h1 className="nsc-page-title mt-1">Staff</h1>
          <p className="nsc-page-sub">
            <span className="md-data text-[var(--md-on-surface)]">{total}</span>{" "}
            record{total === 1 ? "" : "s"}
            {sp.missingPhoto === "1" ? " missing photos" : ""}
            {missingPhotoCount > 0 || pendingCount > 0 ? (
              <span>
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
        <Link href="/staff/new" className="shrink-0">
          <Button>Add staff</Button>
        </Link>
      </header>

      <div>
        <Suspense fallback={<div className="h-24" />}>
          <StaffFilters />
        </Suspense>

        <StaffBulkActions ids={matchingIds.map((s) => s.id)} />

        <div className="manifest hidden md:block">
          <div className="overflow-x-auto">
            <table className="md-table min-w-max">
              <thead>
                <tr>
                  <th>Stage</th>
                  <th>Name</th>
                  <th>ID</th>
                  <th>Designation</th>
                  <th>State</th>
                  <th>Template</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {staff.map((s) => {
                  const states = stageStates({
                    hasPhoto: Boolean(s.photoPreviewKey),
                    approved: s.approvalState === "APPROVED",
                    suspended: s.status === "SUSPENDED",
                    printedAt: s.lastPrintedAt,
                  });
                  return (
                    <tr key={s.id}>
                      <td className="w-px pr-2">
                        <StageRail states={states} />
                      </td>
                      <td>
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full bg-[var(--md-surface-container-high)]">
                            {s.photoPreviewKey ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={`/api/photos/${s.id}/${s.photoPreviewKey}`}
                                alt=""
                                className="h-full w-full object-cover"
                              />
                            ) : null}
                          </div>
                          <Link
                            href={`/staff/${s.id}`}
                            className="md-label-large text-[var(--md-on-surface)] hover:text-[var(--md-tertiary)]"
                          >
                            {fullName(s)}
                          </Link>
                        </div>
                      </td>
                      <td className="md-data text-[var(--md-on-surface-variant)]">
                        {s.idNumber}
                      </td>
                      <td className="text-[var(--md-on-surface-variant)]">
                        {s.designation}
                      </td>
                      <td>
                        {/* Only the exceptions carry colour. */}
                        {s.status === "SUSPENDED" ? (
                          <Badge variant="error">Suspended</Badge>
                        ) : s.hasPendingEdits ? (
                          <Badge variant="warning">Edits pending</Badge>
                        ) : !s.photoPreviewKey ? (
                          <Badge variant="warning">No photo</Badge>
                        ) : s.approvalState !== "APPROVED" ? (
                          <Badge variant="warning">Pending</Badge>
                        ) : (
                          <span className="md-body-small">Ready</span>
                        )}
                      </td>
                      <td className="text-[var(--md-on-surface-variant)] capitalize">
                        {s.frontTemplate.replace(/_/g, " ").toLowerCase()}
                      </td>
                      <td className="text-right">
                        <Link href={`/staff/${s.id}`}>
                          <Button variant="ghost" size="sm">
                            Open
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {total === 0 ? (
            <EmptyState hasFilters={hasFilters} />
          ) : (
            <Pagination
              page={page}
              pageSize={PAGE_SIZE}
              total={total}
              baseQuery={baseQuery}
            />
          )}
        </div>

        <div className="space-y-3 md:hidden">
          {total === 0 ? (
            <div className="md-card">
              <EmptyState hasFilters={hasFilters} />
            </div>
          ) : (
            <>
              {staff.map((s) => {
                const states = stageStates({
                  hasPhoto: Boolean(s.photoPreviewKey),
                  approved: s.approvalState === "APPROVED",
                  suspended: s.status === "SUSPENDED",
                  printedAt: s.lastPrintedAt,
                });
                return (
                  <Link key={s.id} href={`/staff/${s.id}`} className="block">
                    <article className="md-card p-4 transition-shadow active:shadow-[var(--md-elevation-2)]">
                      <div className="flex items-start gap-3">
                        <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full bg-[var(--md-surface-container-high)]">
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
                          <p className="md-title-medium">{fullName(s)}</p>
                          <p className="md-data mt-0.5 text-[var(--md-on-surface-variant)]">
                            {s.idNumber}
                          </p>
                          <p className="md-body-medium mt-2 text-[var(--md-on-surface-variant)]">
                            {s.designation}
                          </p>
                          <div className="mt-3 flex items-center gap-3">
                            <StageRail states={states} />
                            {s.status === "SUSPENDED" ? (
                              <Badge variant="error">Suspended</Badge>
                            ) : !s.photoPreviewKey ? (
                              <Badge variant="warning">No photo</Badge>
                            ) : s.approvalState !== "APPROVED" ? (
                              <Badge variant="warning">Pending</Badge>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </article>
                  </Link>
                );
              })}
              <Pagination
                page={page}
                pageSize={PAGE_SIZE}
                total={total}
                baseQuery={baseQuery}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function EmptyState({ hasFilters }: { hasFilters: boolean }) {
  return (
    <div className="px-4 py-14 text-center">
      <p className="md-title-medium">
        {hasFilters ? "No staff match these filters" : "No staff records yet"}
      </p>
      <p className="md-body-medium mt-1 text-[var(--md-on-surface-variant)]">
        {hasFilters
          ? "Clear filters or try a different search."
          : "Add a person or import a spreadsheet to get started."}
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        {hasFilters ? (
          <Link href="/staff">
            <Button variant="outline">Clear filters</Button>
          </Link>
        ) : null}
        <Link href="/staff/new">
          <Button>Add staff</Button>
        </Link>
        {!hasFilters ? (
          <Link href="/import">
            <Button variant="outline">Import</Button>
          </Link>
        ) : null}
      </div>
    </div>
  );
}
