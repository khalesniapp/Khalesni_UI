/**
 * Theme constants — UI_Plan.md §8.2, §7.8.
 *
 * Three states: system / light / dark. "system" writes no `data-theme`
 * attribute, which is what the `prefers-color-scheme` block in globals.css
 * keys off. Like the locale, the choice is server-rendered from a cookie so
 * the first paint is already correct — no white flash before hydration.
 */

export const THEMES = ["system", "light", "dark"] as const;
export type Theme = (typeof THEMES)[number];

export const DEFAULT_THEME: Theme = "system";

export const THEME_COOKIE = "khalesni.theme";

export function isTheme(value: unknown): value is Theme {
  return typeof value === "string" && (THEMES as readonly string[]).includes(value);
}

/**
 * The value for `<html data-theme>`. "system" resolves to `undefined` so the
 * attribute is absent and the media query in globals.css decides.
 */
export function themeAttribute(theme: Theme): "light" | "dark" | undefined {
  return theme === "system" ? undefined : theme;
}
