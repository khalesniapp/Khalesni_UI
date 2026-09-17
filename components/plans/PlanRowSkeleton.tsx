/**
 * Loading placeholder for a plans-library row — UI_Plan.md §12.1.
 *
 * Sized to the real row (badge line, title, meter, prompt, stamp) rather than
 * being a generic grey box: a skeleton whose height differs from the content it
 * becomes causes exactly the layout shift it was meant to prevent
 * (`content-jumping`, and the 0.05 CLS budget in §15).
 *
 * `aria-hidden` because the list already carries `aria-busy` — announcing five
 * empty placeholders would be noise.
 */
export function PlanRowSkeleton() {
  return (
    <li
      aria-hidden="true"
      className="flex flex-col gap-(--space-2) rounded-lg border border-border bg-card p-(--space-4)"
      style={{ boxShadow: "var(--shadow-1)" }}
    >
      <Bar className="h-3 w-16" />
      <Bar className="h-5 w-3/5" />
      <Bar className="h-1 w-full" />
      <Bar className="h-4 w-4/5" />
      <Bar className="h-3 w-24" />
    </li>
  );
}

function Bar({ className }: { className: string }) {
  return (
    <span
      // Pulse, not shimmer: an opacity animation costs nothing and is the one
      // the reduced-motion rule in globals.css already neutralises.
      className={`block rounded-sm bg-muted motion-safe:animate-pulse ${className}`}
    />
  );
}
