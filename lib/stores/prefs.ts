"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

import { DEFAULT_LOCALE, type Locale } from "@/lib/locale";
import { DEFAULT_THEME, type Theme } from "@/lib/theme";

/**
 * Preferences — UI_Plan.md §11.2, §5.3.
 *
 * `locale` and `theme` are mirrored here for instant client feedback, but the
 * cookie written by app/actions/prefs.ts is the source of truth for the server
 * render — that is what keeps `lang`/`dir` and the theme flash-free (§9).
 *
 * `mood` and `location` are the "two pieces of remembered context" from §5.3:
 * remembered between turns, always visible as chips, always clearable.
 */

interface PrefsState {
  locale: Locale;
  theme: Theme;
  /** Last mood used, ≤ 50 chars, picker-only — never free text (§6.2). */
  mood: string | null;
  /** Last location the backend accepted, echoed back as `location` (§5.3). */
  location: string | null;
  hydrated: boolean;
  setLocale: (locale: Locale) => void;
  setTheme: (theme: Theme) => void;
  setMood: (mood: string | null) => void;
  setLocation: (location: string | null) => void;
  setHydrated: () => void;
}

export const usePrefs = create<PrefsState>()(
  persist(
    (set) => ({
      locale: DEFAULT_LOCALE,
      theme: DEFAULT_THEME,
      mood: null,
      location: null,
      hydrated: false,
      setLocale: (locale) => set({ locale }),
      setTheme: (theme) => set({ theme }),
      setMood: (mood) => set({ mood }),
      setLocation: (location) => set({ location }),
      setHydrated: () => set({ hydrated: true }),
    }),
    {
      name: "khalesni.prefs",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        locale: state.locale,
        theme: state.theme,
        mood: state.mood,
        location: state.location,
      }),
      /**
       * Rehydration runs while `create()` is still evaluating, so the store
       * const is not assigned yet — reaching for `usePrefs` here is a
       * temporal-dead-zone error. The callback's own `state` argument is the
       * live store, so the flag is set through that instead.
       */
      onRehydrateStorage: () => (state, error) => {
        if (error && process.env.NODE_ENV !== "production") {
          console.error("[prefs] failed to rehydrate", error);
        }
        state?.setHydrated();
      },
    },
  ),
);
