"use client";

import { MapPin } from "@phosphor-icons/react/dist/ssr/MapPin";
import { useTranslations } from "next-intl";

import { tileForCoords } from "@/lib/utils/osm";

/**
 * The 96 px map preview on a place card — UI_Plan.md §7.4.
 *
 * A single OpenStreetMap raster tile, not a map library: one `<img>` with fixed
 * dimensions, no JavaScript, no layout shift, and nothing to lazy-load beyond
 * the image itself. Tapping it opens `map_link` in a new tab, which is where
 * the real map lives.
 *
 * The tile is centred on the tile *containing* the venue rather than on the
 * venue itself — a raster tile cannot be offset without a library — so the pin
 * is drawn as a marker over the middle to indicate "around here" rather than
 * claiming a precision the image does not have.
 *
 * Note for whoever deploys this: OSM's tile usage policy is fine with
 * incidental use like this but prohibits bulk or systematic fetching. If place
 * results ever get heavy, switch `NEXT_PUBLIC_MAP=leaflet` or point these at
 * your own tile server.
 */
const SIZE = 96;

export function PlaceThumbnail({
  latitude,
  longitude,
  href,
  name,
  index,
}: {
  latitude: number;
  longitude: number;
  href: string | null;
  name: string;
  index: number;
}) {
  const t = useTranslations("place");
  const { x, y, z } = tileForCoords(latitude, longitude);
  const src = `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;

  const image = (
    <span
      className="relative block shrink-0 overflow-hidden rounded-md bg-muted"
      style={{ width: SIZE, height: SIZE }}
    >
      {/* Plain <img>: next/image would want the host allow-listed and would buy
          us nothing for a fixed 96 px raster that is already the right size. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        width={SIZE}
        height={SIZE}
        loading="lazy"
        decoding="async"
        className="size-full object-cover"
      />

      <span className="absolute inset-0 grid place-items-center">
        <MapPin
          aria-hidden="true"
          weight="fill"
          className="text-primary drop-shadow"
          style={{ width: "var(--icon-lg)", height: "var(--icon-lg)" }}
        />
      </span>

      {/* The number ties the thumbnail to its position in the list, which is
          what the Leaflet pins use too (§7.4). */}
      <span className="absolute start-1 top-1 rounded-full bg-card/90 px-1.5 text-caption tnum">
        {index + 1}
      </span>
    </span>
  );

  if (!href) return image;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={t("mapFor", { name })}
      className="shrink-0 rounded-md"
    >
      {image}
    </a>
  );
}
