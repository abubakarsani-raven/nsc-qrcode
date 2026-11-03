"use client";

/**
 * Floating "Refreshing…" pill shown while the page re-syncs with the server
 * after a save. Fixed at the top so it's visible wherever the user scrolled.
 */
export function RefreshIndicator({ show, label = "Refreshing…" }: { show: boolean; label?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-hidden={!show}
      className="nsc-refresh-pill"
      data-show={show ? "true" : "false"}
    >
      <span className="nsc-refresh-spinner" aria-hidden />
      {show ? label : null}
    </div>
  );
}
