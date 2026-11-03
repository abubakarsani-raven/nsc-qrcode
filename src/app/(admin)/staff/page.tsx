import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { fullName } from "@/lib/staff";
import { LinkButton } from "@/components/mui/link-button";
import { FRONT_TEMPLATE_IDS, type FrontTemplateId } from "@/lib/id-card/slots.generated";
import { StaffFilters } from "./staff-filters";
import { StaffTable } from "./staff-table";
import {
  DEFAULT_PAGE_SIZE,
  PAGE_SIZES,
  SORT_FIELDS,
  type SortField,
  type StaffRow,
} from "./staff-table-config";

type Sp = Promise<{
  q?: string;
  status?: string;
  approvalState?: string;
  missingPhoto?: string;
  frontTemplate?: string;
  page?: string;
  pageSize?: string;
  sort?: string;
  dir?: string;
}>;

function orderBy(sort: SortField, dir: "asc" | "desc") {
  if (sort === "name") return [{ lastName: dir }, { firstName: dir }];
  return [{ [sort]: dir }, { lastName: "asc" as const }];
}

export default async function StaffPage({ searchParams }: { searchParams: Sp }) {
  const sp = await searchParams;
  const where: Record<string, unknown> = {};
  if (sp.status === "ACTIVE" || sp.status === "SUSPENDED") where.status = sp.status;
  if (sp.approvalState === "PENDING" || sp.approvalState === "APPROVED") {
    where.approvalState = sp.approvalState;
  }
  if (sp.missingPhoto === "1") where.photoPreviewKey = null;
  if (FRONT_TEMPLATE_IDS.includes(sp.frontTemplate as FrontTemplateId)) {
    where.frontTemplate = sp.frontTemplate;
  }
  if (sp.q) {
    where.OR = [
      { idNumber: { contains: sp.q, mode: "insensitive" } },
      { firstName: { contains: sp.q, mode: "insensitive" } },
      { lastName: { contains: sp.q, mode: "insensitive" } },
      { designation: { contains: sp.q, mode: "insensitive" } },
    ];
  }

  const pageSize = PAGE_SIZES.includes(Number(sp.pageSize) as (typeof PAGE_SIZES)[number])
    ? Number(sp.pageSize)
    : DEFAULT_PAGE_SIZE;
  const sort: SortField = SORT_FIELDS.includes(sp.sort as SortField)
    ? (sp.sort as SortField)
    : "name";
  const dir = sp.dir === "desc" ? "desc" : "asc";

  const [total, missingPhotoCount, pendingCount] = await Promise.all([
    prisma.staff.count({ where }),
    prisma.staff.count({ where: { photoPreviewKey: null } }),
    prisma.staff.count({ where: { approvalState: "PENDING" } }),
  ]);

  const lastPage = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1), lastPage);

  const [staff, matchingIds] = await Promise.all([
    prisma.staff.findMany({
      where,
      orderBy: orderBy(sort, dir),
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    // Exports cover everything the filters match, not just the visible page.
    prisma.staff.findMany({ where, orderBy: orderBy(sort, dir), select: { id: true } }),
  ]);

  const rows: StaffRow[] = staff.map((s) => ({
    id: s.id,
    name: fullName(s),
    idNumber: s.idNumber,
    designation: s.designation,
    frontTemplate: s.frontTemplate as FrontTemplateId,
    photoUrl: s.photoPreviewKey ? `/api/photos/${s.id}/${s.photoPreviewKey}` : null,
    status: s.status,
    approvalState: s.approvalState,
    hasPendingEdits: s.hasPendingEdits,
    printedAt: s.lastPrintedAt?.toISOString() ?? null,
  }));

  const hasFilters = Boolean(
    sp.q || sp.status || sp.approvalState || sp.missingPhoto || sp.frontTemplate,
  );

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="md-eyebrow">Card production</p>
          <h1 className="nsc-page-title mt-1">Staff</h1>
          <p className="nsc-page-sub">
            <span className="md-data text-[var(--md-on-surface)]">{total}</span> record
            {total === 1 ? "" : "s"}
            {sp.missingPhoto === "1" ? " missing photos" : ""}
            {missingPhotoCount > 0 || pendingCount > 0 ? (
              <span>
                {" · "}
                {missingPhotoCount > 0 ? `${missingPhotoCount} need photo` : null}
                {missingPhotoCount > 0 && pendingCount > 0 ? " · " : null}
                {pendingCount > 0 ? `${pendingCount} pending approval` : null}
              </span>
            ) : null}
          </p>
        </div>
        <LinkButton href="/staff/new" variant="contained" sx={{ flexShrink: 0 }}>
          Add staff
        </LinkButton>
      </header>

      <div>
        <Suspense fallback={<div className="h-28" />}>
          <StaffFilters />
        </Suspense>
        <Suspense fallback={<div className="md-card h-96 animate-pulse" />}>
          <StaffTable
            rows={rows}
            total={total}
            page={page}
            pageSize={pageSize}
            sort={sort}
            dir={dir}
            matchingIds={matchingIds.map((s) => s.id)}
            hasFilters={hasFilters}
          />
        </Suspense>
      </div>
    </div>
  );
}
