"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * A boolean remembered in `localStorage`, read the way React wants external
 * state read.
 *
 * `useSyncExternalStore` rather than `useState` + an effect: the value lives
 * outside React, the server has no access to it, and the hook's explicit server
 * snapshot is what keeps the first client render matching the HTML instead of
 * flipping a checkbox one frame after hydration.
 *
 * The in-memory cache is what makes the control work when storage is blocked
 * (private mode, site data off). Persisting the preference is a nicety;
 * applying it is not, so the session value is authoritative and `localStorage`
 * is only how it survives a reload.
 *
 * Used for per-screen preferences that are not part of the user's identity —
 * "Hide completed" in the plans library (§7.6).
 */

const listeners = new Set<() => void>();
const session = new Map<string, boolean>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  // `storage` fires in *other* tabs, so a change made elsewhere shows up here.
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

export function useStoredFlag(key: string): [boolean, (value: boolean) => void] {
  const getSnapshot = useCallback(() => {
    const cached = session.get(key);
    if (cached !== undefined) return cached;

    try {
      return localStorage.getItem(key) === "1";
    } catch {
      return false;
    }
  }, [key]);

  // The server cannot know a per-device preference, so it renders the default.
  const getServerSnapshot = useCallback(() => false, []);

  const value = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setValue = useCallback(
    (next: boolean) => {
      session.set(key, next);
      try {
        localStorage.setItem(key, next ? "1" : "0");
      } catch {
        // Blocked storage: the session cache above still carries the change.
      }
      for (const listener of listeners) listener();
    },
    [key],
  );

  return [value, setValue];
}

/** Test seam: forget the session cache. Never called by application code. */
export function resetStoredFlags(): void {
  session.clear();
}
