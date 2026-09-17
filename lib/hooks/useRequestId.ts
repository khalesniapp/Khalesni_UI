"use client";

import { useSyncExternalStore } from "react";

import { recentRequestIds, subscribeToRequestIds } from "@/lib/api/client";

const EMPTY: readonly string[] = [];

/**
 * The X-Request-ID ring buffer as a React value — UI_Plan.md §11.4.
 *
 * Subscribes rather than polls, so Settings and error cards update the moment
 * a response lands. The server snapshot is empty because the buffer only ever
 * fills in the browser.
 */
export function useRequestIds(): readonly string[] {
  return useSyncExternalStore(
    subscribeToRequestIds,
    recentRequestIds,
    () => EMPTY,
  );
}

export function useLatestRequestId(): string | null {
  return useRequestIds()[0] ?? null;
}
