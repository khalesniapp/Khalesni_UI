"use client";

import { ArrowSquareOut } from "@phosphor-icons/react/dist/ssr/ArrowSquareOut";
import { MapPin } from "@phosphor-icons/react/dist/ssr/MapPin";
import { Phone } from "@phosphor-icons/react/dist/ssr/Phone";
import { Warning } from "@phosphor-icons/react/dist/ssr/Warning";
import { useTranslations } from "next-intl";

import type { Place } from "@/lib/api/types";
import { domainOf, humaniseTag, safeHttpUrl } from "@/lib/utils/text";
import { hasCoords, openState, placeMeta } from "@/lib/utils/osm";
import { cn } from "@/lib/utils/cn";
import { PlaceThumbnail } from "./PlaceThumbnail";

/**
 * One venue — UI_Plan.md §7.4.
 *
 * Two of the rules here are contractual rather than cosmetic, and both are
 * about not overstating what the backend actually knows:
 *
 * 1. **`phone_source` must be shown.** A phone number that came off a web page
 *    rather than OSM carries "Phone found on {domain} — may be outdated", with
 *    the link. The backend's contract requires it, and a stale number that
 *    looks authoritative is worse than no number.
 * 2. **`source` without `latitude` is not on the map.** It was recommended by a
 *    web page that we could not geocode, so there is no thumbnail, no distance
 *    and no map link — just the warning row and a link to the source.
 *
 * `opening_hours` follows the same principle: the raw string is always shown,
 * and the Open/Closed dot only when `openState` is certain.
 */
export function PlaceRow({ place, index }: { place: Place; index: number }) {
  const t = useTranslations("place");

  const onMap = hasCoords(place);
  const sourceUrl = safeHttpUrl(place.source);
  const sourceDomain = place.source ? domainOf(place.source) : null;
  const websiteUrl = safeHttpUrl(place.website);
  const mapUrl = safeHttpUrl(place.map_link);
  const phoneSourceUrl = safeHttpUrl(place.phone_source);
  const phoneSourceDomain = place.phone_source ? domainOf(place.phone_source) : null;

  // §7.4: a place we could not place on a map has no distance either — the
  // distance is measured from the search centre to coordinates we do not have.
  const meta = placeMeta([
    place.cuisine ? humaniseTag(place.cuisine) : null,
    place.kind ? humaniseTag(place.kind) : null,
    onMap ? place.distance : null,
  ]);

  const state = openState(place.opening_hours);

  return (
    <li className="flex gap-(--space-3) rounded-lg border border-border bg-card p-(--space-3)">
      {onMap ? (
        <PlaceThumbnail
          latitude={place.latitude as number}
          longitude={place.longitude as number}
          href={mapUrl}
          name={place.name}
          index={index}
        />
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col gap-(--space-2)">
        <div className="flex flex-col gap-(--space-1)">
          <h3 className="text-h3 text-pretty">{place.name}</h3>

          {meta.length > 0 ? (
            <p className="tnum text-body-sm text-muted-foreground">{meta.join(" · ")}</p>
          ) : null}

          {place.address ? (
            <p className="text-body-sm text-muted-foreground">{place.address}</p>
          ) : null}
        </div>

        {place.opening_hours ? (
          <p className="flex flex-wrap items-center gap-(--space-2) text-body-sm">
            {/* The raw OSM string, verbatim — it is the only value we are sure of. */}
            <span className="token-ltr text-muted-foreground">{place.opening_hours}</span>

            {state !== "unknown" ? (
              <span
                className={cn(
                  "inline-flex items-center gap-1 text-caption",
                  state === "open" ? "text-success" : "text-muted-foreground",
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "size-2 rounded-full",
                    state === "open" ? "bg-success" : "bg-muted-foreground",
                  )}
                />
                {t(state === "open" ? "openNow" : "closed")}
              </span>
            ) : null}
          </p>
        ) : null}

        {/* §7.4: the note is why the web recommends this place — the most
            persuasive content on the card, so it gets room rather than a clamp. */}
        {place.note ? (
          <p className="text-body-sm italic text-card-foreground">
            “{place.note}”
            {sourceDomain ? (
              <span className="not-italic text-muted-foreground">
                {" — "}
                {sourceUrl ? (
                  <a
                    href={sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                  >
                    {sourceDomain}
                  </a>
                ) : (
                  sourceDomain
                )}
              </span>
            ) : null}
          </p>
        ) : null}

        {/* Rule 2: found on the web, but not locatable. */}
        {!onMap && sourceDomain ? (
          <p className="flex items-start gap-(--space-2) text-body-sm text-warning">
            <Warning
              aria-hidden="true"
              weight="fill"
              className="mt-0.5 shrink-0"
              style={{ width: "var(--icon-sm)", height: "var(--icon-sm)" }}
            />
            {t("notOnMap", { domain: sourceDomain })}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-(--space-2)">
          {place.phone ? (
            <PlaceAction href={`tel:${place.phone.replace(/\s+/g, "")}`} external={false}>
              <Phone
                aria-hidden="true"
                style={{ width: "var(--icon-sm)", height: "var(--icon-sm)" }}
              />
              {t("call")}
            </PlaceAction>
          ) : null}

          {onMap && mapUrl ? (
            <PlaceAction href={mapUrl}>
              <MapPin
                aria-hidden="true"
                style={{ width: "var(--icon-sm)", height: "var(--icon-sm)" }}
              />
              {t("map")}
            </PlaceAction>
          ) : null}

          {websiteUrl ? (
            <PlaceAction href={websiteUrl}>
              <ArrowSquareOut
                aria-hidden="true"
                style={{ width: "var(--icon-sm)", height: "var(--icon-sm)" }}
              />
              {t("website")}
            </PlaceAction>
          ) : null}

          {/* A place with no coordinates gets exactly one action: its source. */}
          {!onMap && sourceUrl ? (
            <PlaceAction href={sourceUrl}>
              <ArrowSquareOut
                aria-hidden="true"
                style={{ width: "var(--icon-sm)", height: "var(--icon-sm)" }}
              />
              {t("source")}
            </PlaceAction>
          ) : null}
        </div>

        {/* Rule 1: mandatory whenever the phone came from the web. */}
        {place.phone && phoneSourceDomain ? (
          <p className="text-caption text-warning">
            {phoneSourceUrl ? (
              <a
                href={phoneSourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                {t("phoneSource", { domain: phoneSourceDomain })}
              </a>
            ) : (
              t("phoneSource", { domain: phoneSourceDomain })
            )}
          </p>
        ) : null}
      </div>
    </li>
  );
}

function PlaceAction({
  href,
  external = true,
  children,
}: {
  href: string;
  external?: boolean;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      className="inline-flex min-h-11 items-center gap-(--space-2) rounded-md border border-border-input px-(--space-3) text-body-sm transition-colors duration-(--dur-fast) hover:bg-muted"
    >
      {children}
    </a>
  );
}
