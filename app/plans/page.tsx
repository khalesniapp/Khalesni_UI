import { getTranslations } from "next-intl/server";

import { PageHeader, PhasePlaceholder } from "@/components/shell/PageHeader";

/** Plans library — §7.6. Filled in Phase 2. */
export default async function PlansPage() {
  const t = await getTranslations();

  return (
    <>
      <PageHeader title={t("plans.title")} />
      <PhasePlaceholder
        phase={t("scaffold.phase", { n: 2 })}
        note={t("plans.empty")}
      />
    </>
  );
}
