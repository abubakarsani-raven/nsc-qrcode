"use client";

import { SessionProvider } from "next-auth/react";
import { LoadingProvider } from "@/lib/loading-context";
import { LoadingOverlay } from "./loading-overlay";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <LoadingProvider>
        <LoadingOverlay />
        {children}
      </LoadingProvider>
    </SessionProvider>
  );
}
