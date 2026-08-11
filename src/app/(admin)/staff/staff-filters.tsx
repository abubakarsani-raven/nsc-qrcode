"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
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
  const missingPhoto = sp.get("missingPhoto") === "1";

  function apply(next: Record<string, string | null>) {
    const params = new URLSearchParams(sp.toString());
    Object.entries(next).forEach(([k, v]) => {
      if (!v || v === "ALL") params.delete(k);
      else params.set(k, v);
    });
    router.push(`/staff?${params.toString()}`);
  }

  useEffect(() => {
    setQ(sp.get("q") ?? "");
  }, [sp]);

  useEffect(() => {
    const current = sp.get("q") ?? "";
    if (q === current) return;
    const id = window.setTimeout(() => {
      apply({ q: q.trim() || null });
    }, 350);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- debounce search only
  }, [q]);

  const chips: { key: string; label: string; clear: Record<string, string | null> }[] =
    [];
  if (q.trim()) {
    chips.push({ key: "q", label: `Search: ${q.trim()}`, clear: { q: null } });
  }
  if (status !== "ALL") {
    chips.push({
      key: "status",
      label: STATUS_ITEMS[status],
      clear: { status: null },
    });
  }
  if (approval !== "ALL") {
    chips.push({
      key: "approval",
      label: APPROVAL_ITEMS[approval],
      clear: { approvalState: null },
    });
  }
  if (missingPhoto) {
    chips.push({
      key: "photo",
      label: "Missing photo",
      clear: { missingPhoto: null },
    });
  }

  return (
    <div className="space-y-3">
      <form
        className="nsc-surface flex flex-wrap items-end gap-3 p-4"
        onSubmit={(e) => {
          e.preventDefault();
          apply({ q: q.trim() || null });
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
      </form>

      {chips.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          {chips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={() => apply(chip.clear)}
              className="rounded-full bg-[var(--nsc-fill)] px-3 py-1 text-[12px] font-medium text-[var(--nsc-ink)] hover:bg-[rgba(120,120,128,0.2)]"
            >
              {chip.label} ×
            </button>
          ))}
          <button
            type="button"
            onClick={() => router.push("/staff")}
            className="text-[12px] font-medium text-[var(--nsc-green)] hover:underline"
          >
            Clear all
          </button>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Link
          href="/staff?missingPhoto=1"
          className={`rounded-full px-3 py-1.5 text-[12px] font-semibold ${
            missingPhoto
              ? "bg-[var(--nsc-ink)] text-white"
              : "bg-white text-[var(--nsc-ink)] ring-1 ring-[var(--nsc-separator)] hover:bg-[#fafafa]"
          }`}
        >
          Needs photo
        </Link>
        <Link
          href="/staff?approvalState=PENDING"
          className={`rounded-full px-3 py-1.5 text-[12px] font-semibold ${
            approval === "PENDING" && !missingPhoto
              ? "bg-[var(--nsc-ink)] text-white"
              : "bg-white text-[var(--nsc-ink)] ring-1 ring-[var(--nsc-separator)] hover:bg-[#fafafa]"
          }`}
        >
          Needs approval
        </Link>
      </div>
    </div>
  );
}
