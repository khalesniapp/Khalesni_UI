"use client";

import { useState } from "react";
import { CrosshairSimple } from "@phosphor-icons/react/dist/ssr/CrosshairSimple";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { LOCATION_MAX } from "@/lib/api/types";
import { useGeolocation } from "./useGeolocation";

/**
 * The location handshake — UI_Plan.md §5.4.
 *
 * The one multi-step flow in the app, and all three ways out are on the card:
 *
 *   Use my location → coordinates as the `location` field, same prompt resent
 *   a typed area     → sent as the *next message*, with history, because the
 *                      backend extracts a clean place name from a whole
 *                      sentence ("Beirut is fine, I want Chinese food")
 *   Not now          → same prompt resent with `ask_location: false`, which
 *                      returns a plan with no venues
 *
 * "Not now" is a real answer, not a dismissal: the plan still gets made. That
 * is why it is a button on the card rather than an × in the corner.
 */
export function LocationAskCard({
  reply,
  onCoords,
  onTyped,
  onSkip,
  busy = false,
}: {
  reply: string;
  onCoords: (coords: string) => void;
  onTyped: (area: string) => void;
  onSkip: () => void;
  busy?: boolean;
}) {
  const t = useTranslations("location");
  const { status, locate } = useGeolocation();
  const [area, setArea] = useState("");

  async function useMyLocation() {
    const coords = await locate();
    if (coords) onCoords(coords);
  }

  function submitTyped() {
    const trimmed = area.trim();
    if (!trimmed) return;
    setArea("");
    onTyped(trimmed);
  }

  return (
    <Card className="flex flex-col gap-(--space-3)">
      <p className="text-body">{reply}</p>

      <div className="flex flex-wrap gap-(--space-2)">
        <input
          value={area}
          onChange={(event) => setArea(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              submitTyped();
            }
          }}
          maxLength={LOCATION_MAX}
          placeholder={t("placeholder")}
          aria-label={t("type")}
          autoComplete="off"
          className="min-h-11 min-w-0 flex-1 rounded-sm border border-border-input bg-card px-(--space-3) text-body"
        />

        <Button
          variant="primary"
          onClick={submitTyped}
          disabled={area.trim().length === 0 || busy}
        >
          {t("type")}
        </Button>
      </div>

      <div className="flex flex-wrap gap-(--space-2)">
        <Button
          onClick={useMyLocation}
          loading={status === "locating"}
          disabled={busy}
          icon={
            <CrosshairSimple
              aria-hidden="true"
              style={{ width: "var(--icon-sm)", height: "var(--icon-sm)" }}
            />
          }
        >
          {t("use")}
        </Button>

        <Button variant="ghost" onClick={onSkip} disabled={busy}>
          {t("skip")}
        </Button>
      </div>

      {status === "denied" || status === "unavailable" ? (
        <p role="status" className="text-caption text-muted-foreground">
          {t(status === "denied" ? "denied" : "unavailable")}
        </p>
      ) : null}
    </Card>
  );
}
