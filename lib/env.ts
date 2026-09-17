/**
 * Public feature flags — CLAUDE.md's `.env.local` table.
 *
 * Read once, here, rather than reaching for `process.env` at call sites:
 * `NEXT_PUBLIC_*` values are inlined at build time, so a typo in a string
 * literal somewhere deep in a component silently evaluates to `undefined` and
 * the feature quietly takes its default branch forever.
 */

/** `off` falls back to `POST /api/generate-plan` and skips the SSE path (§5.5). */
export const STREAMING_ENABLED = process.env.NEXT_PUBLIC_STREAMING !== "off";

/**
 * `static` (default) draws one OSM tile per place as a 96 px thumbnail.
 * `leaflet` additionally offers a shared, lazily-loaded interactive map (§7.4).
 */
export const MAP_MODE: "static" | "leaflet" =
  process.env.NEXT_PUBLIC_MAP === "leaflet" ? "leaflet" : "static";
