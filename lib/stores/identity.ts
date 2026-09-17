"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

import { USER_ID_PATTERN } from "@/lib/api/types";

/**
 * Identity — UI_Plan.md §11.1.
 *
 * The backend has no auth; `user_id` is trusted as sent. So this is a handle,
 * not an account, and both onboarding and Settings say so.
 *
 * When auth arrives (a JWT replacing `normalise_user_id` server-side), this
 * file is the only one that changes — which is why every read of the user id
 * goes through `useIdentity()` and nothing reads localStorage directly.
 */

/** Trim + lowercase, matching the server exactly, so "Nour" and "nour" are visibly one person. */
export function normaliseUserId(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isValidUserId(raw: string): boolean {
  return USER_ID_PATTERN.test(normaliseUserId(raw));
}

interface IdentityState {
  userId: string | null;
  /**
   * False until the persisted value has been read back. The server renders
   * `userId: null`; without this gate the first client paint would swap in the
   * stored handle and trip a hydration mismatch. Consumers show a skeleton
   * until it flips.
   */
  hydrated: boolean;
  setUserId: (raw: string) => void;
  clearUserId: () => void;
  setHydrated: () => void;
}

export const useIdentity = create<IdentityState>()(
  persist(
    (set) => ({
      userId: null,
      hydrated: false,
      setUserId: (raw) => set({ userId: normaliseUserId(raw) }),
      clearUserId: () => set({ userId: null }),
      setHydrated: () => set({ hydrated: true }),
    }),
    {
      name: "khalesni.user_id",
      storage: createJSONStorage(() => localStorage),
      // Only the handle is persisted; `hydrated` is runtime-only.
      partialize: (state) => ({ userId: state.userId }),
      /**
       * Set through the callback's own `state` argument, not the store const:
       * rehydration runs while `create()` is still evaluating, so `useIdentity`
       * is still in its temporal dead zone here.
       *
       * Runs whether or not anything was stored, so a first-time visitor still
       * leaves the skeleton state.
       */
      onRehydrateStorage: () => (state, error) => {
        if (error && process.env.NODE_ENV !== "production") {
          console.error("[identity] failed to rehydrate", error);
        }
        state?.setHydrated();
      },
    },
  ),
);
