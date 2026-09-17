"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import type { Place } from "@/lib/api/types";

/**
 * The optional interactive map — UI_Plan.md §7.4, behind `NEXT_PUBLIC_MAP=leaflet`.
 *
 * Leaflet and its stylesheet are imported dynamically inside an effect, so
 * neither reaches the bundle of anyone running the default `static` mode, and
 * nothing is requested until the user actually presses **Map**.
 *
 * The list above it stays the primary interface. This map is an enhancement:
 * every venue is reachable, readable and linkable without touching it, which is
 * what `dragging-alternative` asks for — a map is a pointer-heavy control and
 * cannot be the only way to get at the data.
 *
 * Places without coordinates never arrive here; `PlacesCard` filters them out
 * and `PlaceRow` shows them with the "not on the map" warning instead.
 */

/** Fixed aspect box, reserved before the tiles load (§12.1, `image-dimension`). */
const HEIGHT = 260;

export function PlacesMap({ places }: { places: readonly Place[] }) {
  const t = useTranslations("place");
  const containerRef = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || places.length === 0) return;

    let cancelled = false;
    // Typed as unknown until the module resolves; `L.Map` is not in scope here.
    let map: { remove: () => void } | null = null;

    void (async () => {
      try {
        const [leaflet] = await Promise.all([
          import("leaflet"),
          // Leaflet positions its panes from its own stylesheet; without this
          // the tiles stack in the top-left corner instead of tiling.
          import("leaflet/dist/leaflet.css"),
        ]);
        if (cancelled) return;

        const L = leaflet.default;
        const points = places.map(
          (place) => [place.latitude as number, place.longitude as number] as [number, number],
        );

        const instance = L.map(container, {
          // Scroll-wheel zoom inside a scrolling thread traps the page.
          scrollWheelZoom: false,
          attributionControl: true,
        });
        map = instance;

        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          // Required by the OSM tile usage policy, and the right thing anyway.
          attribution: "&copy; OpenStreetMap contributors",
        }).addTo(instance);

        points.forEach((point, index) => {
          // Numbered pins matching the list order (§7.4), drawn as a div icon so
          // there is no marker-image asset to host.
          const icon = L.divIcon({
            className: "",
            html: `<span class="khalesni-pin">${index + 1}</span>`,
            iconSize: [24, 24],
            iconAnchor: [12, 12],
          });
          L.marker(point, { icon, title: places[index].name }).addTo(instance);
        });

        instance.fitBounds(L.latLngBounds(points).pad(0.2), { maxZoom: 16 });
      } catch {
        // A blocked CDN, an offline tab, a CSP that rejects the tiles: the list
        // is still there, so the map just says it is unavailable.
        if (!cancelled) setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [places]);

  if (failed) {
    return (
      <p className="text-body-sm text-muted-foreground" style={{ height: HEIGHT }}>
        {t("mapUnavailable")}
      </p>
    );
  }

  return (
    <div
      ref={containerRef}
      // Not focusable and hidden from the accessibility tree: everything on the
      // map is already in the list below it, and a screen reader crawling
      // Leaflet's panes finds only tile images.
      aria-hidden="true"
      className="w-full overflow-hidden rounded-lg border border-border bg-muted"
      style={{ height: HEIGHT }}
    />
  );
}
