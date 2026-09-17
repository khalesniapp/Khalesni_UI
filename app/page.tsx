import { getTranslations } from "next-intl/server";

import { PageHeader, PhasePlaceholder } from "@/components/shell/PageHeader";

/**
 * Home — Chat (UI_Plan.md §7.2). The Composer, Thread and ResponseRouter land
 * in Phase 1; Phase 0 only proves the route renders inside the shell.
 */
export default async function ChatPage() {
  const t = await getTranslations();

  return (
    <>
      <PageHeader title={t("app.name")}>
        <p className="text-body text-muted-foreground">{t("app.tagline")}</p>
      </PageHeader>
      <PhasePlaceholder
        phase={t("scaffold.phase", { n: 1 })}
        note={t("scaffold.shellReady")}
      />
    </>
  );
}
