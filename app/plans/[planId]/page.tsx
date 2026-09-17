import { getTranslations } from "next-intl/server";

import { PageHeader, PhasePlaceholder } from "@/components/shell/PageHeader";

/**
 * Plan detail — §7.6. Every plan has its own URL (`deep-linking`), so the
 * route exists from Phase 0 even though the checklist arrives in Phase 2.
 *
 * `params` is a Promise in Next 16.
 */
export default async function PlanDetailPage({ params }: PageProps<"/plans/[planId]">) {
  const { planId } = await params;
  const t = await getTranslations();

  return (
    <>
      <PageHeader title={t("plans.title")}>
        <p className="token-ltr text-body-sm text-muted-foreground">{planId}</p>
      </PageHeader>
      <PhasePlaceholder
        phase={t("scaffold.phase", { n: 2 })}
        note={t("scaffold.shellReady")}
      />
    </>
  );
}
