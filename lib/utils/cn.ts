/**
 * Minimal class-name joiner.
 *
 * Deliberately not `clsx` + `tailwind-merge`: nothing in this app overrides a
 * utility from a prop yet, so conflict resolution would be weight for no
 * benefit. Swap it in the day a component genuinely needs it.
 */
export function cn(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(" ");
}
