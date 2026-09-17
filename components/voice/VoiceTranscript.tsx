"use client";

import { useEffect, useRef } from "react";
import { Gear } from "@phosphor-icons/react/dist/ssr/Gear";
import { WarningCircle } from "@phosphor-icons/react/dist/ssr/WarningCircle";
import { useTranslations } from "next-intl";

import { PlanCard } from "@/components/plan/PlanCard";
import { fromGenerateResponse } from "@/lib/api/normalise";
import type { VoiceRow } from "@/lib/voice/transcript";
import { cn } from "@/lib/utils/cn";

/**
 * The live transcript — UI_Plan.md §7.7.
 *
 * Four kinds of row, and the tool row is the one that earns its place: when
 * `create_plan` runs, the model goes silent for several seconds while the graph
 * works. Without a row saying "Building your plan…" that silence reads as a
 * crash. §7.7 calls this out explicitly — **explain the silence**.
 */

export type { VoiceRow };

export function VoiceTranscript({ rows }: { rows: readonly VoiceRow[] }) {
  const t = useTranslations("voice");
  const endRef = useRef<HTMLDivElement>(null);

  // The transcript is the one place where following the bottom is always
  // right: it is a live conversation the user is having right now, not a
  // document they might be reading back.
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [rows.length]);

  if (rows.length === 0) {
    return (
      <p className="rounded-lg border border-border bg-card p-(--space-4) text-body-sm text-muted-foreground">
        {t("noTranscript")}
      </p>
    );
  }

  return (
    <div
      // Polite: a live region that interrupted would fight the speech the user
      // is actually listening to.
      aria-live="polite"
      className="flex max-h-100 flex-col gap-(--space-3) overflow-y-auto rounded-lg border border-border bg-card p-(--space-4)"
    >
      {rows.map((row) => (
        <Row key={row.id} row={row} />
      ))}
      <div ref={endRef} />
    </div>
  );
}

function Row({ row }: { row: VoiceRow }) {
  const t = useTranslations("voice");

  if (row.kind === "speech") {
    return (
      <p className="flex gap-(--space-3) text-body-sm">
        <span
          className={cn(
            "w-12 shrink-0 text-label",
            row.role === "user" ? "text-muted-foreground" : "text-primary",
          )}
        >
          {t(row.role === "user" ? "you" : "assistant")}
        </span>
        <span className="min-w-0 flex-1">{row.text}</span>
      </p>
    );
  }

  if (row.kind === "tool") {
    // The two tools have distinct copy — "Building your plan…" and "Checking
    // what you like…" — because they take very different amounts of time.
    const known = row.name === "create_plan" || row.name === "get_my_preferences";

    return (
      <p className="flex items-center gap-(--space-2) text-body-sm text-muted-foreground">
        <Gear
          aria-hidden="true"
          className="shrink-0 motion-safe:animate-spin"
          style={{ width: "var(--icon-sm)", height: "var(--icon-sm)" }}
        />
        {known ? t(`tool.${row.name}`) : t("tool.working")}
      </p>
    );
  }

  if (row.kind === "error") {
    return (
      <p className="flex items-start gap-(--space-2) text-body-sm text-destructive">
        <WarningCircle
          aria-hidden="true"
          weight="fill"
          className="mt-0.5 shrink-0"
          style={{ width: "var(--icon-sm)", height: "var(--icon-sm)" }}
        />
        {row.detail}
      </p>
    );
  }

  const plan = fromGenerateResponse(row.response);
  if (!plan) return null;

  // §7.7: the plan is already saved by the time this event arrives, so the card
  // renders read-only here and the full editable version lives at its own URL.
  return <PlanCard plan={plan} />;
}
