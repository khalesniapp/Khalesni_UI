"use client";

import { MapPin } from "@phosphor-icons/react/dist/ssr/MapPin";
import { Moon } from "@phosphor-icons/react/dist/ssr/Moon";
import { X } from "@phosphor-icons/react/dist/ssr/X";
import { useTranslations } from "next-intl";

import { DEFAULT_MOOD, type Mood } from "./moods";

/**
 * The two remembered-context chips above the composer — UI_Plan.md §5.3.
 *
 * Both are always visible and always removable. This is the whole point: the
 * location and mood silently change what the model returns, so they have to be
 * on screen where someone can see why yesterday's answer differs from today's.
 *
 * `neutral` renders no chip — it is the absence of a mood, not a mood.
 */
export function ContextChips({
  mood,
  location,
  onClearMood,
  onClearLocation,
}: {
  mood: Mood;
  location: string | null;
  onClearMood: () => void;
  onClearLocation: () => void;
}) {
  const t = useTranslations("context");
  const tMood = useTranslations("mood");

  const showMood = mood !== DEFAULT_MOOD;
  if (!showMood && !location) return null;

  return (
    <ul className="flex flex-wrap items-center gap-(--space-2)">
      {location ? (
        <Chip
          icon={
            <MapPin
              aria-hidden="true"
              style={{ width: "var(--icon-sm)", height: "var(--icon-sm)" }}
            />
          }
          label={location}
          removeLabel={t("clearLocation")}
          onRemove={onClearLocation}
        />
      ) : null}

      {showMood ? (
        <Chip
          icon={
            <Moon
              aria-hidden="true"
              style={{ width: "var(--icon-sm)", height: "var(--icon-sm)" }}
            />
          }
          label={tMood(mood)}
          removeLabel={t("clearMood")}
          onRemove={onClearMood}
        />
      ) : null}
    </ul>
  );
}

function Chip({
  icon,
  label,
  removeLabel,
  onRemove,
}: {
  icon: React.ReactNode;
  label: string;
  removeLabel: string;
  onRemove: () => void;
}) {
  return (
    <li className="inline-flex max-w-full items-center gap-(--space-1) rounded-full bg-muted ps-(--space-3) text-body-sm text-muted-foreground">
      {icon}
      <span className="min-w-0 truncate py-1">{label}</span>

      {/* 44 px target on the remove control even though the chip itself is
          shorter — the chip is not the target, the × is (§13). */}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`${removeLabel}: ${label}`}
        className="inline-flex size-11 shrink-0 items-center justify-center rounded-full hover:text-foreground"
      >
        <X aria-hidden="true" style={{ width: "var(--icon-sm)", height: "var(--icon-sm)" }} />
      </button>
    </li>
  );
}
