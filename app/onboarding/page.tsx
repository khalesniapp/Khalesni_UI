import { getTranslations } from "next-intl/server";

import { PageHeader, PhasePlaceholder } from "@/components/shell/PageHeader";

/** First run — §7.1. The handle form lands in Phase 1. */
export default async function OnboardingPage() {
  const t = await getTranslations();

  return (
    <>
      <PageHeader title={t("onboarding.name")}>
        <p className="text-body-sm text-muted-foreground">{t("onboarding.hint")}</p>
      </PageHeader>
      <PhasePlaceholder
        phase={t("scaffold.phase", { n: 1 })}
        note={t("scaffold.shellReady")}
      />
    </>
  );
}
