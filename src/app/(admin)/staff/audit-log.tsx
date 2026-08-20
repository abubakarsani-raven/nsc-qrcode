"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronDownIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

export type AuditEntry = {
  id: string;
  type: string;
  actorName: string;
  /** Pre-formatted on the server so SSR and hydration agree on the timezone. */
  createdAtLabel: string;
};

type Props = {
  staffId: string;
  /** Most recent events, newest first (the page caps this list). */
  events: AuditEntry[];
  /** Total events on record — may exceed `events.length`. */
  totalCount?: number;
  /** Admin-only: show the Clear control. */
  canClear?: boolean;
  /** Expand on first render (collapsed by default — the list gets long). */
  defaultOpen?: boolean;
};

export function AuditLog({
  staffId,
  events,
  totalCount,
  canClear = false,
  defaultOpen = false,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(defaultOpen);
  const [clearOpen, setClearOpen] = useState(false);

  const latest = events[0];
  const total = totalCount ?? events.length;

  async function clearLog() {
    const res = await fetch(`/api/staff/${staffId}/audit`, {
      method: "DELETE",
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(data.error || "Could not clear the audit log");
      return;
    }
    toast.success(
      data.removed === 1 ? "1 event cleared" : `${data.removed} events cleared`,
    );
    router.refresh();
  }

  return (
    <div className="md-card overflow-hidden">
      <div className="flex min-h-14 flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="audit-log-list"
          className="-ml-2 flex flex-1 items-center gap-2 rounded-[var(--md-shape-sm)] px-2 py-2 text-left transition-colors hover:bg-[color-mix(in_srgb,var(--md-on-surface)_8%,transparent)]"
        >
          <ChevronDownIcon
            aria-hidden="true"
            className={`size-5 shrink-0 text-[var(--md-on-surface-variant)] transition-transform ${
              open ? "" : "-rotate-90"
            }`}
          />
          <span className="min-w-0">
            <span className="md-title-medium block">Audit log</span>
            <span className="md-body-small block">
              {total === 0
                ? "No events yet"
                : `${total} event${total === 1 ? "" : "s"}${
                    latest
                      ? ` · last ${latest.createdAtLabel}`
                      : ""
                  }`}
            </span>
          </span>
        </button>
        {canClear && total > 0 ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setClearOpen(true)}
          >
            Clear
          </Button>
        ) : null}
      </div>

      {open ? (
        <ul
          id="audit-log-list"
          className="md-body-medium divide-y divide-[var(--md-outline-variant)] border-t border-[var(--md-outline-variant)]"
        >
          {events.length === 0 ? (
            <li className="px-4 py-8 text-center text-[var(--md-on-surface-variant)]">
              No events yet
            </li>
          ) : (
            events.map((e) => (
              <li
                key={e.id}
                className="flex min-h-13 flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3"
              >
                <span className="md-label-large">{e.type}</span>
                <span className="text-[var(--md-on-surface-variant)]">
                  {e.actorName}
                </span>
                <span className="md-body-small ml-auto">
                  {e.createdAtLabel}
                </span>
              </li>
            ))
          )}
          {total > events.length ? (
            <li className="md-body-small px-4 py-3 text-center">
              Showing the latest {events.length} of {total} events
            </li>
          ) : null}
        </ul>
      ) : null}

      <ConfirmDialog
        open={clearOpen}
        onOpenChange={setClearOpen}
        title="Clear this audit log?"
        description="Every recorded event for this staff record is deleted permanently. The clear itself is logged, so the trail will show that it was reset."
        confirmLabel="Clear log"
        destructive
        requireText="CLEAR"
        onConfirm={clearLog}
      />
    </div>
  );
}
