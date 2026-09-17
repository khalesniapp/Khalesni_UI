"use client";

import { useEffect, useState } from "react";
import { Bookmarks } from "@phosphor-icons/react/dist/ssr/Bookmarks";
import { Brain } from "@phosphor-icons/react/dist/ssr/Brain";
import { MagnifyingGlass } from "@phosphor-icons/react/dist/ssr/MagnifyingGlass";
import { PencilLine } from "@phosphor-icons/react/dist/ssr/PencilLine";
import { SealCheck } from "@phosphor-icons/react/dist/ssr/SealCheck";
import type { Icon } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { STREAM_STAGES, type StreamStage } from "@/lib/api/types";

/**
 * The streaming indicator — UI_Plan.md §7.2.3, §5.5.
 *
 * One pill, fixed at 32 px tall so a stage change never moves the thread
 * (`layout-shift-avoid`, and the CLS budget in §15 is 0.05 for a whole
 * generation). It is *replaced* by the final card rather than stacked above it.
 *
 * Silence is the hard part of this screen: a generation can run 30–60 seconds
 * with map searches in it. So after 20 s a reassurance line appears, and after
 * 45 s a Stop next to it — an escape hatch, offered before it is demanded.
 */

const STAGE_ICONS: Record<StreamStage, Icon> = {
  thinking: Brain,
  remembering: Bookmarks,
  searching: MagnifyingGlass,
  checking: SealCheck,
  writing: PencilLine,
};

const REASSURE_AFTER_MS = 20_000;
const OFFER_STOP_AFTER_MS = 45_000;

function isKnownStage(value: string | null): value is StreamStage {
  return value !== null && (STREAM_STAGES as readonly string[]).includes(value);
}

export function StageChip({
  stage,
  detail,
  startedAt,
  onStop,
}: {
  /** The raw `status` value from the SSE frame, or null before the first one. */
  stage: string | null;
  detail: string | null;
  startedAt: number;
  onStop: () => void;
}) {
  const t = useTranslations("stage");
  const tChat = useTranslations("chat");
  const [elapsed, setElapsed] = useState(() => Date.now() - startedAt);

  // One second is fine: the only thresholds are at 20 s and 45 s, and a faster
  // timer would re-render the thread for nothing.
  useEffect(() => {
    const timer = window.setInterval(() => setElapsed(Date.now() - startedAt), 1000);
    return () => window.clearInterval(timer);
  }, [startedAt]);

  const known = isKnownStage(stage);
  const StageIcon = known ? STAGE_ICONS[stage] : null;

  // §5.5: an unknown stage falls back to its own `detail`, then to a generic
  // line. The raw token is never printed — it is a protocol value, not copy.
  const label = known ? t(stage) : (detail ?? t("generic"));
  const suffix = known ? detail : null;

  return (
    <div className="flex flex-wrap items-center gap-(--space-2)">
      <p
        // The thread region carries aria-busy; this is the polite running
        // commentary that goes with it (§7.2.3).
        aria-live="polite"
        className="inline-flex h-8 min-w-0 items-center gap-(--space-2) rounded-full bg-muted px-(--space-3) text-body-sm text-muted-foreground"
      >
        {StageIcon ? (
          <StageIcon
            aria-hidden="true"
            className="shrink-0 motion-safe:animate-pulse"
            style={{ width: "var(--icon-sm)", height: "var(--icon-sm)" }}
          />
        ) : (
          <Spinner />
        )}

        <span className="truncate">
          {label}
          {suffix ? <span className="text-muted-foreground"> {suffix}</span> : null}
        </span>
      </p>

      {elapsed >= REASSURE_AFTER_MS ? (
        <span className="text-caption text-muted-foreground">{t("slow")}</span>
      ) : null}

      {elapsed >= OFFER_STOP_AFTER_MS ? (
        <Button size="sm" variant="ghost" onClick={onStop}>
          {tChat("stop")}
        </Button>
      ) : null}
    </div>
  );
}
