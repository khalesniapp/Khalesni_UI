/**
 * How the user answered the location question — UI_Plan.md §5.4.
 *
 * The three cases behave differently on the wire, which is why they are one
 * tagged union rather than three optional fields:
 *
 *   `coords` — the same prompt is resent with `location: "33.89,35.48"`.
 *   `typed`  — a **new message**, with history, because the backend extracts a
 *              clean place name from a whole sentence and the sentence may
 *              carry more than a location ("Beirut is fine, I want Chinese").
 *   `skip`   — the same prompt resent with `ask_location: false`, which
 *              produces a plan with no venues. Not a dismissal: still an answer.
 */
export type LocationAnswer =
  | { kind: "coords"; value: string }
  | { kind: "typed"; value: string }
  | { kind: "skip" };
