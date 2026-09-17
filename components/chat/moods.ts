/**
 * The mood picker's options — UI_Plan.md §7.2.4.
 *
 * `mood` is a free string on the wire (≤ 50 chars) but a picker in the UI, so
 * the backend only ever sees one of these six tokens. They stay English in
 * every locale: the value is model input, not user-facing copy, and an Arabic
 * mood string would change how the plan reads for no benefit. The label the
 * user sees comes from `mood.*` in the catalogues.
 */
export const MOODS = [
  "neutral",
  "tired",
  "energetic",
  "stressed",
  "focused",
  "excited",
] as const;

export type Mood = (typeof MOODS)[number];

/** `neutral` is the default, so it is sent as "no particular mood" — i.e. omitted. */
export const DEFAULT_MOOD: Mood = "neutral";

export function isMood(value: unknown): value is Mood {
  return typeof value === "string" && (MOODS as readonly string[]).includes(value);
}
