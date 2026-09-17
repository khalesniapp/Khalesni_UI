"use client";

import { useState } from "react";
import { CrosshairSimple } from "@phosphor-icons/react/dist/ssr/CrosshairSimple";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/Button";
import { LOCATION_MAX } from "@/lib/api/types";
import { cn } from "@/lib/utils/cn";
import { MOODS, type Mood } from "./moods";
import { useGeolocation } from "./useGeolocation";

/**
 * The composer's context tray — UI_Plan.md §7.2.4.
 *
 * Mood and location are the two pieces of remembered context (§5.3). They are
 * edited here and displayed as removable chips above the composer, because
 * hidden state that changes the answer is a trust bug.
 *
 * The mood picker is a radio group rather than a row of toggle buttons: only
 * one can be active, and radios give that semantic plus arrow-key roving to a
 * screen reader for free (§13).
 */
export function ContextTray({
  mood,
  location,
  onMoodChange,
  onLocationChange,
}: {
  mood: Mood;
  location: string | null;
  onMoodChange: (mood: Mood) => void;
  onLocationChange: (location: string | null) => void;
}) {
  const t = useTranslations("context");
  const tMood = useTranslations("mood");
  const tLocation = useTranslations("location");
  const { status, locate } = useGeolocation();

  const [draft, setDraft] = useState(location ?? "");

  function commitLocation() {
    const trimmed = draft.trim().slice(0, LOCATION_MAX);
    onLocationChange(trimmed.length > 0 ? trimmed : null);
  }

  async function useMyLocation() {
    const coords = await locate();
    if (!coords) return;
    setDraft(coords);
    onLocationChange(coords);
  }

  return (
    <div className="flex flex-col gap-(--space-4) rounded-lg border border-border bg-card p-(--space-4)">
      <fieldset className="flex flex-col gap-(--space-2)">
        <legend className="text-label text-muted-foreground">{t("mood")}</legend>

        <div className="flex flex-wrap gap-(--space-2)">
          {MOODS.map((option) => {
            const checked = option === mood;
            return (
              <label
                key={option}
                className={cn(
                  "inline-flex min-h-11 cursor-pointer items-center rounded-full border px-(--space-3) text-body-sm",
                  "transition-colors duration-(--dur-fast)",
                  "has-[:focus-visible]:outline has-[:focus-visible]:outline-2",
                  "has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-(--color-ring)",
                  checked
                    ? "border-primary bg-primary text-on-primary"
                    : "border-border-input text-muted-foreground hover:bg-muted",
                )}
              >
                <input
                  type="radio"
                  name="mood"
                  value={option}
                  checked={checked}
                  onChange={() => onMoodChange(option)}
                  className="sr-only"
                />
                {tMood(option)}
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="flex flex-col gap-(--space-2)">
        <label htmlFor="context-location" className="text-label text-muted-foreground">
          {t("location")}
        </label>

        <div className="flex flex-wrap gap-(--space-2)">
          <input
            id="context-location"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={commitLocation}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                commitLocation();
              }
            }}
            maxLength={LOCATION_MAX}
            placeholder={tLocation("placeholder")}
            autoComplete="off"
            className="min-h-11 min-w-0 flex-1 rounded-sm border border-border-input bg-card px-(--space-3) text-body"
          />

          <Button
            size="sm"
            onClick={useMyLocation}
            loading={status === "locating"}
            icon={
              <CrosshairSimple
                aria-hidden="true"
                style={{ width: "var(--icon-sm)", height: "var(--icon-sm)" }}
              />
            }
          >
            {tLocation("use")}
          </Button>
        </div>

        {/* Denial is expected often enough to deserve a plain sentence with a
            way forward, not a red error (§12.3). */}
        {status === "denied" || status === "unavailable" ? (
          <p role="status" className="text-caption text-muted-foreground">
            {tLocation(status === "denied" ? "denied" : "unavailable")}
          </p>
        ) : null}
      </div>
    </div>
  );
}
