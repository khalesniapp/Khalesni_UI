/**
 * OpenStreetMap value handling — UI_Plan.md §7.4.
 *
 * The rule this file exists to obey: *never guess*. The raw `opening_hours`
 * string is always shown as-is; the derived "Open now" / "Closed" dot appears
 * only when the value falls into a small set of shapes we can evaluate with
 * certainty. Anything with a public-holiday rule, a seasonal range, a
 * sunrise/sunset offset or an unparseable fragment returns `"unknown"` and the
 * user sees the raw string alone.
 *
 * A wrong "Open now" sends someone across town for nothing. Silence does not.
 */

export type OpenState = "open" | "closed" | "unknown";

/** OSM's day tokens, Monday first — matching the `Mo-Su` ordering in the data. */
const DAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"] as const;

/** `Date.getDay()` is Sunday-first; OSM is Monday-first. */
function osmDayIndex(date: Date): number {
  return (date.getDay() + 6) % 7;
}

function minutesOf(hours: number, minutes: number): number {
  return hours * 60 + minutes;
}

/** `"09:30"` → 570. Returns null for anything that is not a plain clock time. */
function parseClock(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  // 24:00 is a legal OSM end-of-day.
  if (hours > 24 || minutes > 59) return null;
  return minutesOf(hours, minutes);
}

/** `"Mo-Fr"`, `"Sa"`, `"Mo,We,Fr"` → the day indices they cover, or null. */
function parseDays(value: string): number[] | null {
  const days = new Set<number>();

  for (const part of value.split(",")) {
    const token = part.trim();
    if (!token) return null;

    const range = /^([A-Za-z]{2})-([A-Za-z]{2})$/.exec(token);
    if (range) {
      const from = DAYS.indexOf(range[1] as (typeof DAYS)[number]);
      const to = DAYS.indexOf(range[2] as (typeof DAYS)[number]);
      if (from < 0 || to < 0) return null;

      // Ranges wrap: `Fr-Mo` is Friday through Monday.
      for (let i = from; ; i = (i + 1) % DAYS.length) {
        days.add(i);
        if (i === to) break;
      }
      continue;
    }

    const single = DAYS.indexOf(token as (typeof DAYS)[number]);
    if (single < 0) return null;
    days.add(single);
  }

  return [...days];
}

/**
 * Evaluate a raw `opening_hours` value against a moment in time.
 *
 * Handles: `24/7`, and `;`-separated rules of the form `<days> <from>-<to>`
 * with optional multiple time spans (`Mo-Fr 09:00-12:00,13:00-17:00`).
 * Everything else — `PH`, `off`, `sunset`, month ranges, week numbers — is
 * deliberately `"unknown"`.
 */
export function openState(raw: string | null | undefined, now: Date = new Date()): OpenState {
  if (!raw) return "unknown";

  const value = raw.trim();
  if (!value) return "unknown";
  if (value === "24/7") return "open";

  // Any modifier we do not fully model disqualifies the whole string. Partial
  // understanding is exactly how a wrong answer gets rendered confidently.
  if (/PH|SH|off|sunrise|sunset|dusk|dawn|week|easter|\[|\|\|/i.test(value)) return "unknown";
  // A month or day-of-month qualifier (`Apr-Oct`, `Jan 01`) is out of scope too.
  if (/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/i.test(value)) return "unknown";

  const today = osmDayIndex(now);
  const minutesNow = minutesOf(now.getHours(), now.getMinutes());
  let matchedAnyRule = false;

  for (const rule of value.split(";")) {
    const trimmed = rule.trim();
    if (!trimmed) continue;

    // `<days> <spans>` — the first space separates them.
    const split = trimmed.indexOf(" ");
    if (split < 0) return "unknown";

    const days = parseDays(trimmed.slice(0, split));
    if (!days) return "unknown";

    const spans = trimmed.slice(split + 1).trim();
    for (const span of spans.split(",")) {
      const [fromRaw, toRaw, ...rest] = span.trim().split("-");
      if (rest.length > 0 || toRaw === undefined) return "unknown";

      const from = parseClock(fromRaw);
      const to = parseClock(toRaw);
      if (from === null || to === null) return "unknown";

      matchedAnyRule = true;
      if (!days.includes(today)) {
        // A span that crosses midnight is still open today if it started
        // yesterday — check the previous day's rule too.
        const yesterday = (today + 6) % 7;
        if (to < from && days.includes(yesterday) && minutesNow < to) return "open";
        continue;
      }

      if (to < from) {
        // Crosses midnight: open from `from` to the end of the day.
        if (minutesNow >= from) return "open";
      } else if (minutesNow >= from && minutesNow < to) {
        return "open";
      }
    }
  }

  // Every rule parsed and none of them covers right now.
  return matchedAnyRule ? "closed" : "unknown";
}

/**
 * The meta line under a place name: `cuisine · kind · distance` (§7.4).
 *
 * `_` becomes a space and `;` a comma, Title Cased, and absent fields are
 * omitted silently rather than leaving separators with nothing between them.
 */
export function placeMeta(parts: ReadonlyArray<string | null | undefined>): string[] {
  return parts.map((part) => part?.trim()).filter((part): part is string => Boolean(part));
}

/**
 * The OSM tile containing a coordinate, for the static thumbnail (§7.4).
 *
 * Zoom 16 shows the street the venue is on — enough to recognise a
 * neighbourhood, not so close that a slightly-off pin looks wrong.
 */
export const THUMBNAIL_ZOOM = 16;

export function tileForCoords(
  latitude: number,
  longitude: number,
  zoom: number = THUMBNAIL_ZOOM,
): { x: number; y: number; z: number } {
  const n = 2 ** zoom;
  const latRad = (latitude * Math.PI) / 180;

  return {
    z: zoom,
    x: Math.floor(((longitude + 180) / 360) * n),
    y: Math.floor(
      ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n,
    ),
  };
}

/** True when a place can appear on a map at all (§7.4: `source` without coords cannot). */
export function hasCoords(place: {
  latitude?: number | null;
  longitude?: number | null;
}): place is { latitude: number; longitude: number } {
  return typeof place.latitude === "number" && typeof place.longitude === "number";
}
