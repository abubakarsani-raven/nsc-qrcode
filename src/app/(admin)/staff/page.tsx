import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { fullName } from "@/lib/staff";
import { StaffFilters } from "./staff-filters";
import { StaffBulkActions } from "./staff-bulk-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";

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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-neutral-900">Staff</h1>
          <p className="text-sm text-neutral-500 mt-1">
            <span className="font-medium text-neutral-700">{staff.length}</span> record{staff.length === 1 ? "" : "s"}
            {sp.missingPhoto === "1" && " missing photos"}
          </p>
        </div>
        <Link href="/staff/new">
          <Button size="lg">+ Add staff</Button>
        </Link>
      </div>

      {/* Filters */}
      <StaffFilters />

      {/* Bulk Actions */}
      <StaffBulkActions staff={staff.map((s) => ({ id: s.id, label: fullName(s) }))} />

      {/* Desktop Table */}
      <div className="hidden md:block rounded-lg border border-neutral-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-max text-sm">
            <thead className="bg-neutral-50 border-b border-neutral-200 sticky top-0">
              <tr>
                <th className="px-6 py-3 text-left font-semibold text-neutral-700 whitespace-nowrap min-w-[200px]">Name</th>
                <th className="px-6 py-3 text-left font-semibold text-neutral-700 whitespace-nowrap min-w-[120px]">ID</th>
                <th className="px-6 py-3 text-left font-semibold text-neutral-700 whitespace-nowrap min-w-[150px]">Designation</th>
                <th className="px-6 py-3 text-left font-semibold text-neutral-700 whitespace-nowrap min-w-[100px]">Status</th>
                <th className="px-6 py-3 text-left font-semibold text-neutral-700 whitespace-nowrap min-w-[100px]">Approval</th>
                <th className="px-6 py-3 text-left font-semibold text-neutral-700 whitespace-nowrap min-w-[80px]">Photo</th>
                <th className="px-6 py-3 text-left font-semibold text-neutral-700 whitespace-nowrap min-w-[140px]">Template</th>
                <th className="px-6 py-3 text-left font-semibold text-neutral-700 whitespace-nowrap min-w-[100px]">Action</th>
              </tr>
            </thead>
          <tbody className="divide-y divide-neutral-200">
            {staff.map((s) => (
              <tr key={s.id} className="hover:bg-neutral-50 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <div>
                      <Link
                        href={`/staff/${s.id}`}
                        className="font-medium text-neutral-900 hover:text-[#0d4720] transition-colors"
                      >
                        {fullName(s)}
                      </Link>
                      {s.hasPendingEdits && (
                        <Badge variant="warning" className="ml-2">
                          Edits pending
                        </Badge>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 font-mono text-xs text-neutral-600">{s.idNumber}</td>
                <td className="px-6 py-4 text-neutral-700">{s.designation}</td>
                <td className="px-6 py-4">
                  <Badge variant={s.status === "ACTIVE" ? "success" : "error"}>
                    {s.status}
                  </Badge>
                </td>
                <td className="px-6 py-4">
                  <Badge variant={s.approvalState === "APPROVED" ? "success" : "warning"}>
                    {s.approvalState}
                  </Badge>
                </td>
                <td className="px-6 py-4">
                  <Badge variant={s.photoPreviewKey ? "success" : "error"}>
                    {s.photoPreviewKey ? "✓ Yes" : "✗ Missing"}
                  </Badge>
                </td>
                <td className="px-6 py-4 text-xs text-neutral-600">
                  {s.frontTemplate.replace(/_/g, " ")}
                </td>
                <td className="px-6 py-4">
                  <Link href={`/staff/${s.id}`}>
                    <Button variant="secondary" size="sm">
                      Edit
                    </Button>
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Card Layout */}
      {staff.length === 0 ? (
        <Card>
          <CardBody className="py-8">
            <p className="text-center text-neutral-500">No staff records found</p>
          </CardBody>
        </Card>
      ) : (
        <div className="md:hidden space-y-3">
          {staff.map((s) => (
            <Link key={s.id} href={`/staff/${s.id}`}>
              <Card hoverable>
                <CardBody className="space-y-3">
                  {/* Name and ID */}
                  <div>
                    <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide">
                      Name & ID
                    </p>
                    <div className="flex items-start justify-between mt-1">
                      <div>
                        <p className="font-semibold text-neutral-900">{fullName(s)}</p>
                        <p className="text-xs font-mono text-neutral-600">{s.idNumber}</p>
                      </div>
                      {s.hasPendingEdits && (
                        <Badge variant="warning">Edits</Badge>
                      )}
                    </div>
                  </div>

                  {/* Details Grid */}
                  <div className="grid grid-cols-2 gap-3 pt-2 border-t border-neutral-200">
                    <div>
                      <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide">
                        Designation
                      </p>
                      <p className="text-sm text-neutral-700 mt-1">{s.designation}</p>
                    </div>

                    <div>
                      <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide">
                        Status
                      </p>
                      <div className="mt-1">
                        <Badge variant={s.status === "ACTIVE" ? "success" : "error"}>
                          {s.status}
                        </Badge>
                      </div>
                    </div>

                    <div>
                      <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide">
                        Approval
                      </p>
                      <div className="mt-1">
                        <Badge variant={s.approvalState === "APPROVED" ? "success" : "warning"}>
                          {s.approvalState}
                        </Badge>
                      </div>
                    </div>

                    <div>
                      <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide">
                        Photo
                      </p>
                      <div className="mt-1">
                        <Badge variant={s.photoPreviewKey ? "success" : "error"}>
                          {s.photoPreviewKey ? "✓ Yes" : "✗ Missing"}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  {/* Template */}
                  <div className="pt-2 border-t border-neutral-200">
                    <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide">
                      Template
                    </p>
                    <p className="text-sm text-neutral-700 mt-1">
                      {s.frontTemplate.replace(/_/g, " ")}
                    </p>
                  </div>

                  {/* Action */}
                  <p className="text-xs text-neutral-400 pt-2">Tap to edit →</p>
                </CardBody>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
