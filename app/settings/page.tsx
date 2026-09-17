import { cookies } from "next/headers";
import { getLocale, getTranslations } from "next-intl/server";
import type { ReactNode } from "react";

import { PageHeader } from "@/components/shell/PageHeader";
import { CapabilityList } from "@/components/settings/CapabilityList";
import { LanguageToggle } from "@/components/settings/LanguageToggle";
import { RequestIdFooter } from "@/components/settings/RequestIdFooter";
import { ThemeToggle } from "@/components/settings/ThemeToggle";
import type { Locale } from "@/lib/locale";
import { DEFAULT_THEME, isTheme, THEME_COOKIE } from "@/lib/theme";

const APP_VERSION = "0.1";

/**
 * Settings — "You" (UI_Plan.md §7.8).
 *
 * Phase 0 ships the two preference controls and the live capability list; the
 * identity, mood/location and data sections arrive with the features they act
 * on (Phases 1–2).
 */
export default async function SettingsPage() {
  const t = await getTranslations("settings");
  const locale = (await getLocale()) as Locale;

  const themeCookie = (await cookies()).get(THEME_COOKIE)?.value;
  const theme = isTheme(themeCookie) ? themeCookie : DEFAULT_THEME;

  return (
    <>
      <PageHeader title={t("title")} />

      <div className="flex flex-col gap-(--space-6) pb-(--space-7)">
        <Section title={t("preferences")}>
          <Row label={t("language")}>
            <LanguageToggle initial={locale} />
          </Row>
          <Row label={t("theme")}>
            <ThemeToggle initial={theme} />
          </Row>
        </Section>

        <Section title={t("capabilities")}>
          <CapabilityList />
        </Section>

        <RequestIdFooter version={APP_VERSION} />
      </div>
    </>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-(--space-4)">
      {/* Overline-styled section label; the screen's only h1 is the page title. */}
      <h2 className="text-overline uppercase text-muted-foreground">{title}</h2>
      <div
        className="flex flex-col gap-(--space-5) rounded-lg border border-border bg-card p-(--space-4)"
        style={{ boxShadow: "var(--shadow-1)" }}
      >
        {children}
      </div>
    </section>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-(--space-2) sm:flex-row sm:items-center sm:justify-between sm:gap-(--space-4)">
      <span className="text-body">{label}</span>
      {children}
    </div>
  );
}
