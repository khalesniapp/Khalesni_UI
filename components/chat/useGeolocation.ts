"use client";

import { useCallback, useState } from "react";

/**
 * Browser geolocation for "Use my location" — UI_Plan.md §5.4, §7.2.4.
 *
 * The backend takes a `location` string and accepts `"33.89,35.48"`, so the
 * coordinates go over as text and come back as a cleaned place name in the
 * response's `location` field. We keep four decimal places: roughly 11 m,
 * plenty for "which neighbourhood", and it avoids handing the server a
 * pointlessly precise fix.
 *
 * Denial is a normal outcome, not an error state to recover from — the caller
 * falls back to the typed field, which is always visible next to the button.
 */

const COORD_PRECISION = 4;
const TIMEOUT_MS = 10_000;

export type GeolocationStatus = "idle" | "locating" | "denied" | "unavailable";

export function useGeolocation() {
  const [status, setStatus] = useState<GeolocationStatus>("idle");

  const locate = useCallback((): Promise<string | null> => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setStatus("unavailable");
      return Promise.resolve(null);
    }

    setStatus("locating");

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setStatus("idle");
          const { latitude, longitude } = position.coords;
          resolve(`${latitude.toFixed(COORD_PRECISION)},${longitude.toFixed(COORD_PRECISION)}`);
        },
        (error) => {
          // PERMISSION_DENIED is the only one worth distinguishing: it is the
          // only one the user can fix, and the copy for it differs.
          setStatus(error.code === error.PERMISSION_DENIED ? "denied" : "unavailable");
          resolve(null);
        },
        { enableHighAccuracy: false, timeout: TIMEOUT_MS, maximumAge: 5 * 60_000 },
      );
    });
  }, []);

  const reset = useCallback(() => setStatus("idle"), []);

  return { status, locate, reset };
}
