"use client";

import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { ApiError } from "@/lib/api/client";
import { CapabilitiesProvider } from "@/lib/hooks/useCapabilities";

/**
 * Client providers — UI_Plan.md §11.
 *
 * The QueryClient is created inside state so each request gets its own on the
 * server and one stable instance survives re-renders on the client.
 */
export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            // §11.4 already retries GETs inside the client with backoff;
            // a second layer here would multiply the wait on a dead backend.
            retry: false,
            refetchOnWindowFocus: false,
          },
          mutations: {
            // §11.4: never retry a generate automatically — retry is a user action.
            retry: false,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <CapabilitiesProvider>{children}</CapabilitiesProvider>
    </QueryClientProvider>
  );
}

/** Re-exported so error surfaces can narrow without reaching into lib/api. */
export { ApiError };
