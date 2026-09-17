import { getTranslations } from "next-intl/server";

import { PageHeader } from "@/components/shell/PageHeader";
import { VoiceScreen } from "@/components/voice/VoiceScreen";

/**
 * Voice mode — UI_Plan.md §7.7.
 *
 * The route always exists. When `voice_enabled` is false the screen says so
 * rather than 404ing or disappearing from the nav: a missing destination reads
 * as a broken build (`empty-nav-state`).
 */
export default async function VoicePage() {
  const t = await getTranslations("nav");

  return (
    <>
      <PageHeader title={t("voice")} />
      <VoiceScreen />
    </>
  );
}
