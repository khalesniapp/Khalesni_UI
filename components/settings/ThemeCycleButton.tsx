"use client";

import { useState, useTransition } from "react";
import { Circle } from "@phosphor-icons/react/dist/ssr/Circle";
import { Moon } from "@phosphor-icons/react/dist/ssr/Moon";
import { Sun } from "@phosphor-icons/react/dist/ssr/Sun";
import { useTranslations } from "next-intl";

import { setThemeCookie } from "@/app/actions/prefs";
import { IconButton } from "@/components/ui/Button";
import { usePrefs } from "@/lib/stores/prefs";
import { THEMES, themeAttribute, type Theme } from "@/lib/theme";

/**
 * The compact theme control in the chat header — UI_Plan.md §7.2.1.
 *
 * Same three states and the same cookie as the Settings control, just cycled
 * from one button instead of laid out as a segmented control. `initial` is read
 * from the cookie on the server and passed in for the same reason it is there:
 * the cookie is what the server render used to set `data-theme`, so seeding
 * from anywhere else could put the button out of step with the screen.
 *
 * The label names the *next* state, not the current one, so the button says
 * what pressing it will do.
 */

const ICONS = {
  system: Circle,
  light: Sun,
  dark: Moon,
} as const;

export function ThemeCycleButton({ initial }: { initial: Theme }) {
  const t = useTranslations("settings");
  const [theme, setTheme] = useState<Theme>(initial);
  const mirrorToStore = usePrefs((state) => state.setTheme);
  const [pending, startTransition] = useTransition();

  const next = THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length];
  const Icon = ICONS[theme];

  const labels: Record<Theme, string> = {
    system: t("themeSystem"),
    light: t("themeLight"),
    dark: t("themeDark"),
  };

  function apply() {
    setTheme(next);
    mirrorToStore(next);

    const attribute = themeAttribute(next);
    if (attribute) {
      document.documentElement.dataset.theme = attribute;
    } else {
      delete document.documentElement.dataset.theme;
    }

    startTransition(async () => {
      await setThemeCookie(next);
    });
  }

  return (
    <IconButton
      label={t("switchTheme", { theme: labels[next] })}
      onClick={apply}
      disabled={pending}
    >
      <Icon
        aria-hidden="true"
        style={{ width: "var(--icon-md)", height: "var(--icon-md)" }}
      />
    </IconButton>
  );
}
