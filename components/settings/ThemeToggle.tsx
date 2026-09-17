"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";

import { setThemeCookie } from "@/app/actions/prefs";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { usePrefs } from "@/lib/stores/prefs";
import { THEMES, themeAttribute, type Theme } from "@/lib/theme";

/**
 * System / Light / Dark — UI_Plan.md §7.8.
 *
 * The cookie is the source of truth, because it is what the server render
 * reads to set `data-theme` on `<html>` before first paint. `initial` comes
 * from that same cookie, so the control can never disagree with what is on
 * screen — which it could if it seeded itself from localStorage after the user
 * cleared site data in another tab. The Zustand store is kept as a mirror for
 * other consumers.
 *
 * On change we set the attribute synchronously (instant, no round trip) and
 * write the cookie in the background (so a reload starts correct).
 */
export function ThemeToggle({ initial }: { initial: Theme }) {
  const t = useTranslations("settings");
  const [theme, setThemeState] = useState<Theme>(initial);
  const mirrorToStore = usePrefs((state) => state.setTheme);
  const [pending, startTransition] = useTransition();

  const labels: Record<Theme, string> = {
    system: t("themeSystem"),
    light: t("themeLight"),
    dark: t("themeDark"),
  };

  function apply(next: Theme) {
    setThemeState(next);
    mirrorToStore(next);

    const attribute = themeAttribute(next);
    if (attribute) {
      document.documentElement.dataset.theme = attribute;
    } else {
      // "system" hands control back to the prefers-color-scheme block.
      delete document.documentElement.dataset.theme;
    }

    startTransition(async () => {
      await setThemeCookie(next);
    });
  }

  return (
    <SegmentedControl
      name="theme"
      legend={t("theme")}
      value={theme}
      options={THEMES.map((value) => ({ value, label: labels[value] }))}
      onChange={apply}
      disabled={pending}
    />
  );
}
