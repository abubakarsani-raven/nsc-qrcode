"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const STATUS_ITEMS = {
  ALL: "All statuses",
  ACTIVE: "Active",
  SUSPENDED: "Suspended",
} as const;

const APPROVAL_ITEMS = {
  ALL: "All approvals",
  PENDING: "Pending",
  APPROVED: "Approved",
} as const;

export function StaffFilters() {
  const router = useRouter();
  const sp = useSearchParams();
  const [q, setQ] = useState(sp.get("q") ?? "");
  const status = (sp.get("status") as keyof typeof STATUS_ITEMS | null) ?? "ALL";
  const approval =
    (sp.get("approvalState") as keyof typeof APPROVAL_ITEMS | null) ?? "ALL";

  function apply(next: Record<string, string>) {
    const params = new URLSearchParams(sp.toString());
    Object.entries(next).forEach(([k, v]) => {
      if (!v || v === "ALL") params.delete(k);
      else params.set(k, v);
    });
    router.push(`/staff?${params.toString()}`);
  }

  return (
    <form
      className="nsc-surface flex flex-wrap items-end gap-3 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        apply({ q });
      }}
    >
      <div className="min-w-[180px] flex-1 space-y-1.5">
        <Label htmlFor="staff-search">Search</Label>
        <input
          id="staff-search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="nsc-field"
          placeholder="Name or ID"
        />
      </div>
      <div className="space-y-1.5">
        <Label>Status</Label>
        <Select
          value={STATUS_ITEMS[status] ? status : "ALL"}
          onValueChange={(value) => {
            if (value != null) apply({ status: value });
          }}
          items={STATUS_ITEMS}
        >
          <SelectTrigger className="min-w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(STATUS_ITEMS) as (keyof typeof STATUS_ITEMS)[]).map(
              (id) => (
                <SelectItem key={id} value={id}>
                  {STATUS_ITEMS[id]}
                </SelectItem>
              ),
            )}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label>Approval</Label>
        <Select
          value={APPROVAL_ITEMS[approval] ? approval : "ALL"}
          onValueChange={(value) => {
            if (value != null) apply({ approvalState: value });
          }}
          items={APPROVAL_ITEMS}
        >
          <SelectTrigger className="min-w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(
              Object.keys(APPROVAL_ITEMS) as (keyof typeof APPROVAL_ITEMS)[]
            ).map((id) => (
              <SelectItem key={id} value={id}>
                {APPROVAL_ITEMS[id]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button
        type="submit"
        variant="secondary"
        className="h-10 rounded-full px-5"
      >
        Apply
      </Button>
    </form>
  );
}
