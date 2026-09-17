/**
 * Text helpers shared by the transcript and the place cards.
 */

import { HISTORY_CONTENT_MAX } from "@/lib/api/types";

const ELLIPSIS = "…";

/**
 * §5.2: history entries are truncated to the backend's 2000-char limit "with a
 * middle ellipsis". The middle is the right place to cut a replayed turn — the
 * opening states the request and the ending usually carries the follow-up
 * referent ("…what about the second one?"), and a tail-truncation would drop
 * exactly the part that makes the next message resolvable.
 */
export function middleTruncate(value: string, max: number = HISTORY_CONTENT_MAX): string {
  if (value.length <= max) return value;

  // One character of the budget goes to the ellipsis itself.
  const keep = max - ELLIPSIS.length;
  const head = Math.ceil(keep / 2);
  const tail = keep - head;
  return `${value.slice(0, head)}${ELLIPSIS}${value.slice(value.length - tail)}`;
}

/**
 * The bare domain, for "Phone found on {domain}" (§7.4) and the source links.
 *
 * `phone_source` and `source` arrive as full URLs in practice but the contract
 * only says "string", so a bare host must pass through unchanged rather than
 * throwing. `www.` is dropped because it adds nothing to a credibility signal.
 */
export function domainOf(value: string): string {
  const raw = value.trim();
  if (!raw) return raw;

  try {
    const url = new URL(raw.includes("://") ? raw : `https://${raw}`);
    return url.hostname.replace(/^www\./, "");
  } catch {
    return raw;
  }
}

/** A URL we are willing to put in `href`. Anything else renders as plain text (§13). */
export function safeHttpUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  const raw = value.trim();
  if (!raw) return null;

  try {
    const url = new URL(raw.includes("://") ? raw : `https://${raw}`);
    // Blocks javascript:, data: and friends before they ever reach the DOM.
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

/**
 * OSM values are machine-shaped: `ice_cream`, `italian;pizza`. §7.4 wants
 * "Ice Cream", "Italian, Pizza".
 */
export function humaniseTag(value: string): string {
  return value
    .split(";")
    .map((part) =>
      part
        .trim()
        .replace(/_/g, " ")
        .replace(/\b\p{Ll}/gu, (c) => c.toUpperCase()),
    )
    .filter(Boolean)
    .join(", ");
}
