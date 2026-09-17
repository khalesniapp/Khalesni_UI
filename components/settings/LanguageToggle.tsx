"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";

import { setLocaleCookie } from "@/app/actions/prefs";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { usePrefs } from "@/lib/stores/prefs";
import { LOCALES, LOCALE_LABELS, dirFor, type Locale } from "@/lib/locale";

/**
 * English / العربية — UI_Plan.md §9.
 *
 * Switching the locale also switches direction, so `lang` and `dir` on `<html>`
 * are updated immediately and the server action then revalidates the layout to
 * re-render every string. Without the synchronous part the page would sit in
 * the old direction for the length of the round trip.
 *
 * Language names are deliberately NOT translated — a speaker looking for
 * Arabic should find "العربية", whatever the current UI language is.
 */
export function LanguageToggle({ initial }: { initial: Locale }) {
  const t = useTranslations("settings");
  const [locale, setLocaleState] = useState<Locale>(initial);
  const mirrorToStore = usePrefs((state) => state.setLocale);
  const [pending, startTransition] = useTransition();

  function apply(next: Locale) {
    setLocaleState(next);
    mirrorToStore(next);

    const root = document.documentElement;
    root.lang = next;
    root.dir = dirFor(next);

    startTransition(async () => {
      await setLocaleCookie(next);
    });
  }

  return (
    <SegmentedControl
      name="locale"
      legend={t("language")}
      value={locale}
      options={LOCALES.map((value) => ({ value, label: LOCALE_LABELS[value] }))}
      onChange={apply}
      disabled={pending}
    />
  );
}
