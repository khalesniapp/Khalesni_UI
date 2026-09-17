import { cn } from "@/lib/utils/cn";

/**
 * The one spinner — UI_Plan.md §8.5, §13.
 *
 * A bordered circle rather than an icon: it animates `transform` only, which
 * keeps it off the main thread and inside the CLS budget. Under
 * `prefers-reduced-motion` the global rule in globals.css collapses the spin to
 * nothing, so the pulsing-opacity fallback is attached here as a second
 * animation the reduced-motion block leaves visible at a steady state.
 *
 * Decorative by default: the surrounding control carries `aria-busy`, and a
 * second announcement from the spinner itself would double up.
 */
export function Spinner({
  className,
  size = "var(--icon-sm)",
}: {
  className?: string;
  size?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-block shrink-0 animate-spin rounded-full",
        "border-2 border-current border-t-transparent opacity-70",
        className,
      )}
      style={{ width: size, height: size }}
    />
  );
}
