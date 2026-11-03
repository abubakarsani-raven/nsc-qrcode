"use client";

import { useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";

/**
 * `router.refresh()` re-fetches server data silently. Wrapping it in a
 * transition gives a `refreshing` flag that stays true until the fresh data
 * has rendered, so the UI can show that it's syncing.
 */
export function useRefresh() {
  const router = useRouter();
  const [refreshing, startTransition] = useTransition();
  const refresh = useCallback(() => {
    startTransition(() => router.refresh());
  }, [router]);
  return { refresh, refreshing };
}
