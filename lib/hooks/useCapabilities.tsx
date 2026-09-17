"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";

import { getHealth, HEALTH_STALE_MS } from "@/lib/api/health";
import { ApiError } from "@/lib/api/client";
import type { Health } from "@/lib/api/types";
import { queryKeys } from "./queryKeys";

/**
 * Capability gating — UI_Plan.md §6.5, trap 6.
 *
 * Fetched once on boot, cached 60 s, re-fetched on window focus. Every
 * capability-dependent surface reads from here rather than discovering the
 * limitation from a failed click: `MAP_SEARCH_ENABLED` is off by default, so
 * `GET /api/places` normally 503s, and voice needs a Gemini key.
 */

export interface Capabilities {
  health: Health | null;
  /** The probe itself failed — the backend is down or unreachable, not merely degraded. */
  unreachable: boolean;
  loading: boolean;
  error: ApiError | null;
  refetch: () => void;
  /** Convenience flags. All default to `false` while loading — never optimistically on. */
  canSavePlans: boolean;
  canRemember: boolean;
  canSearchPlaces: boolean;
  canUseVoice: boolean;
}

const CapabilitiesContext = createContext<Capabilities | null>(null);

export function CapabilitiesProvider({ children }: { children: ReactNode }) {
  const query = useQuery({
    queryKey: queryKeys.health,
    queryFn: ({ signal }) => getHealth(signal),
    staleTime: HEALTH_STALE_MS,
    refetchOnWindowFocus: true,
    // A dead backend should not retry forever behind the user's back.
    retry: 1,
  });

  const health = query.data ?? null;

  const value: Capabilities = {
    health,
    unreachable: query.isError,
    loading: query.isPending,
    error: query.error instanceof ApiError ? query.error : null,
    refetch: () => void query.refetch(),
    canSavePlans: health?.mongo_ready ?? false,
    canRemember: health?.rag_ready ?? false,
    canSearchPlaces: health?.places ?? false,
    canUseVoice: health?.voice_enabled ?? false,
  };

  return (
    <CapabilitiesContext.Provider value={value}>{children}</CapabilitiesContext.Provider>
  );
}

export function useCapabilities(): Capabilities {
  const context = useContext(CapabilitiesContext);
  if (!context) {
    throw new Error("useCapabilities must be used inside <CapabilitiesProvider>");
  }
  return context;
}
