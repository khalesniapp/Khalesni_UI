/**
 * Locale constants — UI_Plan.md §9.
 *
 * The locale lives in a cookie, not the URL: Khalesni is one personal surface,
 * not a marketing site that needs per-locale SEO. `dir` is resolved from the
 * locale server-side in app/layout.tsx so there is no LTR flash on an Arabic
 * first paint.
 */

export const LOCALES = ["en", "ar"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

export const LOCALE_COOKIE = "khalesni.locale";

/** One year — this is a preference, not a session. */
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  ar: "العربية",
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

export function dirFor(locale: Locale): "ltr" | "rtl" {
  return locale === "ar" ? "rtl" : "ltr";
}
