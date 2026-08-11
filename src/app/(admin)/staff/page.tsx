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

  const staff = await prisma.staff.findMany({
    where,
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

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
          </p>
        </div>
        <Link href="/staff/new">
          <Button className="h-10 rounded-full bg-[var(--nsc-green)] px-5 hover:bg-[var(--nsc-green-hover)]">
            Add staff
          </Button>
        </Link>
      </div>

      <StaffFilters />
      <StaffBulkActions staff={staff.map((s) => ({ id: s.id, label: fullName(s) }))} />

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
                </td>
                <td className="px-5 py-3.5 font-mono text-[12px] text-[var(--nsc-secondary)]">
                  {s.idNumber}
                </td>
                <td className="px-5 py-3.5 text-[var(--nsc-ink)]/80">
                  {s.designation}
                </td>
                <td className="px-5 py-3.5">
                  <Badge variant={s.status === "ACTIVE" ? "success" : "error"}>
                    {s.status}
                  </Badge>
                </td>
                <td className="px-5 py-3.5">
                  <Badge
                    variant={s.approvalState === "APPROVED" ? "success" : "warning"}
                  >
                    {s.approvalState}
                  </Badge>
                </td>
                <td className="px-5 py-3.5">
                  <Badge variant={s.photoPreviewKey ? "success" : "error"}>
                    {s.photoPreviewKey ? "Yes" : "Missing"}
                  </Badge>
                </td>
                <td className="px-5 py-3.5 text-[var(--nsc-secondary)]">
                  {s.frontTemplate.replace(/_/g, " ")}
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
          <p className="px-5 py-12 text-center text-[15px] text-[var(--nsc-secondary)]">
            No staff records match these filters.
          </p>
        ) : null}
      </div>

      <div className="space-y-3 md:hidden">
        {staff.length === 0 ? (
          <div className="nsc-surface px-5 py-12 text-center text-[15px] text-[var(--nsc-secondary)]">
            No staff records match these filters.
          </div>
        ) : (
          staff.map((s) => (
            <Link key={s.id} href={`/staff/${s.id}`} className="block">
              <article className="nsc-surface p-4 transition-transform active:scale-[0.99]">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[15px] font-semibold tracking-tight">
                      {fullName(s)}
                    </p>
                    <p className="mt-0.5 font-mono text-[12px] text-[var(--nsc-secondary)]">
                      {s.idNumber}
                    </p>
                  </div>
                  <Badge variant={s.status === "ACTIVE" ? "success" : "error"}>
                    {s.status}
                  </Badge>
                </div>
                <p className="mt-3 text-[13px] text-[var(--nsc-ink)]/80">
                  {s.designation}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge
                    variant={
                      s.approvalState === "APPROVED" ? "success" : "warning"
                    }
                  >
                    {s.approvalState}
                  </Badge>
                  <Badge variant={s.photoPreviewKey ? "success" : "error"}>
                    {s.photoPreviewKey ? "Photo" : "No photo"}
                  </Badge>
                </div>
              </article>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
