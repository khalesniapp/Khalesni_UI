import { getTranslations } from "next-intl/server";

import { PageHeader } from "@/components/shell/PageHeader";
import { PlansLibrary } from "@/components/plans/PlansLibrary";

/** Plans library — UI_Plan.md §7.6. */
export default async function PlansPage() {
  const t = await getTranslations("plans");

  return (
    <>
      <PageHeader title={t("title")} />
      <PlansLibrary />
    </>
  );
}
