"use client";

import { Toaster } from "sonner";

export function AppToaster() {
  return (
    <Toaster
      position="bottom-center"
      closeButton
      toastOptions={{
        // M3 snackbar: inverse surface, 4dp corners, level-3 elevation
        classNames: {
          toast:
            "rounded-[var(--md-shape-xs)] border-0 bg-[var(--md-inverse-surface)] text-[var(--md-inverse-on-surface)] shadow-[var(--md-elevation-3)]",
          title: "md-body-medium text-[var(--md-inverse-on-surface)]",
          description: "md-body-small text-[var(--md-inverse-on-surface)]/80",
          actionButton:
            "md-label-large text-[var(--md-primary-container)] bg-transparent",
          closeButton:
            "bg-transparent border-0 text-[var(--md-inverse-on-surface)]",
        },
      }}
    />
  );
}
