"use client";

import { useTranslations } from "next-intl";

/**
 * The first-visit chat screen — UI_Plan.md §7.2.2.
 *
 * The four starter chips **fill the composer without sending**. That is the
 * point: it shows what a prompt looks like while leaving the user free to edit
 * it, which teaches the input's freedom instead of hiding it behind a canned
 * action.
 *
 * Each chip maps to a real router category, so the first thing a new user sees
 * is also the app's actual range: daily_schedule, trip, places, study.
 */

const STARTERS = [
  { key: "planDay", promptKey: "planDay" },
  { key: "packTrip", promptKey: "packTrip" },
  { key: "findCafe", promptKey: "findCafe" },
  { key: "studyPlan", promptKey: "studyPlan" },
] as const;

export function EmptyState({
  name,
  slot,
  onPick,
  /** Trap 6: say so up front, rather than after a venue question comes back empty. */
  placesOff = false,
}: {
  name: string;
  slot: "morning" | "evening";
  onPick: (prompt: string) => void;
  placesOff?: boolean;
}) {
  const t = useTranslations("chat");
  const tChip = useTranslations("chip");
  const tPrompt = useTranslations("chipPrompt");
  const tPlace = useTranslations("place");

  return (
    <div className="flex flex-col gap-(--space-5) py-(--space-6)">
      <h2 className="text-h1 text-pretty">{t(`greeting.${slot}`, { name })}</h2>

      <ul className="grid gap-(--space-3) sm:grid-cols-2">
        {STARTERS.map((starter) => (
          <li key={starter.key}>
            <button
              type="button"
              // The chip's label is short; the prompt it inserts is a real
              // sentence, so the composer shows something worth editing.
              onClick={() => onPick(tPrompt(starter.promptKey))}
              className="flex min-h-11 w-full items-center rounded-md border border-border-input bg-card px-(--space-4) py-(--space-3) text-start text-body-sm transition-colors duration-(--dur-fast) hover:bg-muted"
            >
              {tChip(starter.key)}
            </button>
          </li>
        ))}
      </ul>

      {/* §12.3: place search being off is a server setting, not a failure —
          so it is stated quietly, before it can waste anyone's question. */}
      {placesOff ? (
        <p className="text-caption text-muted-foreground">{tPlace("searchOff")}</p>
      ) : null}
    </div>
  );
}
