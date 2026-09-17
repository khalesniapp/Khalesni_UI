/**
 * Time formatting — UI_Plan.md §7.3, §7.5, §7.6.
 *
 * Two jobs: the relative stamps on cards ("just now", "2 days ago") and the
 * time-of-day greeting on the empty chat screen. Both are locale-aware, both
 * take the locale as an argument rather than reading a store, so they stay
 * pure and testable.
 */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Under a minute reads as "just now" in both languages rather than "0 minutes ago". */
const JUST_NOW_MS = MINUTE;

/**
 * `Intl.RelativeTimeFormat` with `numeric: "auto"` gives us "yesterday" and
 * "أمس" for free, which is what §7.6 shows in the plans library.
 *
 * The backend sends ISO strings; an unparseable one returns null so the caller
 * can omit the line entirely instead of rendering "Invalid Date".
 */
export function relativeTime(
  iso: string,
  locale: string,
  now: number = Date.now(),
): string | null {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return null;

  const elapsed = now - then;
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });

  // Clock skew between the backend and the browser can make a fresh plan look
  // like it was created in the future. Treat anything near zero as "just now".
  if (elapsed < JUST_NOW_MS) return justNow(locale);

  if (elapsed < HOUR) return rtf.format(-Math.floor(elapsed / MINUTE), "minute");
  if (elapsed < DAY) return rtf.format(-Math.floor(elapsed / HOUR), "hour");
  if (elapsed < 30 * DAY) return rtf.format(-Math.floor(elapsed / DAY), "day");
  if (elapsed < 365 * DAY) return rtf.format(-Math.floor(elapsed / (30 * DAY)), "month");
  return rtf.format(-Math.floor(elapsed / (365 * DAY)), "year");
}

/**
 * `Intl` has no "just now", and `format(0, "second")` renders as "now" in
 * English but "الآن" in Arabic — both fine, so we use it directly rather than
 * adding another message key.
 */
function justNow(locale: string): string {
  return new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(0, "second");
}

/** Absolute timestamp for `title` attributes, so the relative stamp stays hoverable. */
export function absoluteTime(iso: string, locale: string): string | null {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return null;
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(then);
}

export type GreetingSlot = "morning" | "evening";

/**
 * §7.2.2 asks for a time-aware greeting. The catalogue only carries two slots
 * (§16), so the day splits in half at noon rather than inventing copy that no
 * reviewer has seen in Arabic.
 */
export function greetingSlot(now: Date = new Date()): GreetingSlot {
  return now.getHours() < 12 ? "morning" : "evening";
}

/** mm:ss, for the voice session duration (§7.7). Tabular figures come from `.tnum`. */
export function durationLabel(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
