"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

export function StaffFilters() {
  const router = useRouter();
  const sp = useSearchParams();
  const [q, setQ] = useState(sp.get("q") ?? "");

  function apply(next: Record<string, string>) {
    const params = new URLSearchParams(sp.toString());
    Object.entries(next).forEach(([k, v]) => {
      if (!v) params.delete(k);
      else params.set(k, v);
    });
    router.push(`/staff?${params.toString()}`);
  }

  return (
    <form
      className="flex flex-wrap items-end gap-2 rounded-xl border border-neutral-200 bg-white p-3"
      onSubmit={(e) => {
        e.preventDefault();
        apply({ q });
      }}
    >
      <label className="text-sm">
        <span className="text-neutral-600">Search</span>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="mt-1 block rounded-md border px-2 py-1.5"
          placeholder="Name or ID"
        />
      </label>
      <label className="text-sm">
        <span className="text-neutral-600">Status</span>
        <select
          className="mt-1 block rounded-md border px-2 py-1.5"
          defaultValue={sp.get("status") ?? ""}
          onChange={(e) => apply({ status: e.target.value })}
        >
          <option value="">All</option>
          <option value="ACTIVE">Active</option>
          <option value="SUSPENDED">Suspended</option>
        </select>
      </label>
      <label className="text-sm">
        <span className="text-neutral-600">Approval</span>
        <select
          className="mt-1 block rounded-md border px-2 py-1.5"
          defaultValue={sp.get("approvalState") ?? ""}
          onChange={(e) => apply({ approvalState: e.target.value })}
        >
          <option value="">All</option>
          <option value="PENDING">Pending</option>
          <option value="APPROVED">Approved</option>
        </select>
      </label>
      <button
        type="submit"
        className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm text-white"
      >
        Apply
      </button>
    </form>
  );
}
