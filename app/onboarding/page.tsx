import { getTranslations } from "next-intl/server";

import { OnboardingForm } from "@/components/onboarding/OnboardingForm";
import { LanguageToggle } from "@/components/settings/LanguageToggle";
import { getLocale } from "next-intl/server";
import type { Locale } from "@/lib/locale";

/**
 * First run — UI_Plan.md §7.1. One screen, one field.
 *
 * The language switch is on this screen deliberately: an Arabic-first user
 * should not have to learn English to find the setting that stops them having
 * to read English.
 */
export default async function OnboardingPage() {
  const t = await getTranslations();
  const locale = (await getLocale()) as Locale;

  return (
    <div className="mx-auto flex min-h-dvh max-w-100 flex-col justify-center gap-(--space-6) py-(--space-7)">
      <div className="flex flex-col gap-(--space-2) text-center">
        <h1 className="text-display">{t("app.name")}</h1>
        <p className="text-body text-muted-foreground text-balance">{t("app.tagline")}</p>
      </div>

      <OnboardingForm />

      <div className="flex justify-center">
        <LanguageToggle initial={locale} />
      </div>
    </div>
  );
}
