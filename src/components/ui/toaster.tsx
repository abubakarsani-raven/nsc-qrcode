"use client";

import { Toaster } from "sonner";

export function AppToaster() {
  return (
    <Toaster
      position="top-center"
      richColors
      closeButton
      toastOptions={{
        classNames: {
          toast:
            "rounded-2xl border border-[var(--nsc-separator)] shadow-[0_8px_30px_rgba(0,0,0,0.12)]",
          title: "text-[14px] font-semibold tracking-tight",
          description: "text-[13px] text-[var(--nsc-secondary)]",
        },
      }}
    />
  );
}
