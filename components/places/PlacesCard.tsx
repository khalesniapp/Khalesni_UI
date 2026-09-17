"use client";

import { useState } from "react";
import { CaretDown } from "@phosphor-icons/react/dist/ssr/CaretDown";
import { useTranslations } from "next-intl";

import { ReplyBubble } from "@/components/chat/Bubbles";
import { Button } from "@/components/ui/Button";
import type { MenuAction } from "@/components/ui/Menu";
import type { Place } from "@/lib/api/types";
import { hasCoords } from "@/lib/utils/osm";
import { MAP_MODE } from "@/lib/env";
import { PlaceRow } from "./PlaceRow";
import { PlacesMap } from "./PlacesMap";

/**
 * A places answer — UI_Plan.md §7.4.
 *
 * The reply text is a normal bubble and the venues are cards beneath it, which
 * is how the response actually reads: a sentence of context, then the options.
 *
 * **These are never saved as plans**, so there is no "Open plan" link anywhere
 * on this card. `plan_type` is `"places"` but `plan_id` is null — the backend
 * does not persist a venue list, and pretending otherwise would offer a link
 * that 404s.
 */
export function PlacesCard({
  reply,
  places,
  actions = [],
  onWiderArea,
}: {
  reply: string;
  places: readonly Place[];
  actions?: readonly MenuAction[];
  /** §7.4: re-asks with the city instead of the neighbourhood. */
  onWiderArea?: () => void;
}) {
  const t = useTranslations("place");
  const tCommon = useTranslations("common");
  const [mapOpen, setMapOpen] = useState(false);

  const mappable = places.filter(hasCoords);

  return (
    <div className="flex flex-col gap-(--space-3)">
      <ReplyBubble actions={actions} actionsLabel={tCommon("messageActions")}>
        {reply}
      </ReplyBubble>

      {/* §7.4: never render an empty places section. When the search came back
          with nothing the backend says so in the reply, and the only action is
          to widen the area. */}
      {places.length === 0 ? (
        onWiderArea ? (
          <div>
            <Button size="sm" onClick={onWiderArea}>
              {t("widerArea")}
            </Button>
          </div>
        ) : null
      ) : (
        <>
          {MAP_MODE === "leaflet" && mappable.length > 0 ? (
            <div className="flex flex-col gap-(--space-2)">
              <button
                type="button"
                onClick={() => setMapOpen((open) => !open)}
                aria-expanded={mapOpen}
                className="inline-flex min-h-11 w-fit items-center gap-(--space-1) rounded-md border border-border-input px-(--space-3) text-body-sm hover:bg-muted"
              >
                {t("map")}
                <CaretDown
                  aria-hidden="true"
                  className={mapOpen ? "rotate-180 transition-transform" : "transition-transform"}
                  style={{ width: "var(--icon-sm)", height: "var(--icon-sm)" }}
                />
              </button>

              {/* Lazy: the library and the tiles only load once someone asks. */}
              {mapOpen ? <PlacesMap places={mappable} /> : null}
            </div>
          ) : null}

          <ul className="flex flex-col gap-(--space-3)">
            {places.map((place, index) => (
              <PlaceRow
                // §7.4: `osm_id` when present, name + index otherwise. Names are
                // not unique and the same venue can appear from two sources.
                key={place.osm_id ?? `${place.name}-${index}`}
                place={place}
                index={index}
              />
            ))}
          </ul>

          {onWiderArea ? (
            <div>
              {/* Bordered, not ghost: on its own under a list of cards a
                  borderless button reads as a stray heading. */}
              <Button size="sm" onClick={onWiderArea}>
                {t("widerArea")}
              </Button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
