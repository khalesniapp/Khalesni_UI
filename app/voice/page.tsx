import { getTranslations } from "next-intl/server";

import { PageHeader, PhasePlaceholder } from "@/components/shell/PageHeader";

/** Voice mode — §7.7. Phase 5, and only if VOICE_ENABLED is on for v1. */
export default async function VoicePage() {
  const t = await getTranslations();

  return (
    <>
      <PageHeader title={t("nav.voice")}>
        <p className="text-body text-muted-foreground">{t("voice.sub")}</p>
      </PageHeader>
      <PhasePlaceholder
        phase={t("scaffold.phase", { n: 5 })}
        note={t("scaffold.shellReady")}
      />
    </>
  );
}
