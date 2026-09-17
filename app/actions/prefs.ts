"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

import {
  LOCALE_COOKIE,
  LOCALE_COOKIE_MAX_AGE,
  type Locale,
  isLocale,
} from "@/lib/locale";
import { THEME_COOKIE, type Theme, isTheme } from "@/lib/theme";

/**
 * Locale and theme are written to cookies from a server action so the next
 * render already has them — §9 requires no LTR flash, and the same applies to
 * the theme. The client store mirrors them for instant feedback.
 */

export async function setLocaleCookie(locale: Locale) {
  if (!isLocale(locale)) return;

  const store = await cookies();
  store.set(LOCALE_COOKIE, locale, {
    maxAge: LOCALE_COOKIE_MAX_AGE,
    sameSite: "lax",
    path: "/",
  });

  // The whole tree is locale-dependent, including <html lang> and <html dir>.
  revalidatePath("/", "layout");
}

export async function setThemeCookie(theme: Theme) {
  if (!isTheme(theme)) return;

  const store = await cookies();
  store.set(THEME_COOKIE, theme, {
    maxAge: LOCALE_COOKIE_MAX_AGE,
    sameSite: "lax",
    path: "/",
  });
}
