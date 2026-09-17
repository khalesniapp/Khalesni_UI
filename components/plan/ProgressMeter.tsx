import { useTranslations } from "next-intl";

/**
 * `done/total` as text *and* a bar — UI_Plan.md §7.3.
 *
 * The text is not optional: a bar alone would carry the information in width
 * and colour only, which fails `color-not-only` (§13). Tabular figures stop
 * the count jittering as it climbs past 9.
 *
 * The bar itself is `aria-hidden` — the text beside it is the accessible
 * version of the same fact, and announcing both would read the number twice.
 */
export function ProgressMeter({
  done,
  total,
  /** "done" for tasks, "packed" for readiness items (§16). */
  labelKey = "done",
}: {
  done: number;
  total: number;
  labelKey?: "done" | "packed";
}) {
  const t = useTranslations("plan");
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);

  return (
    <div className="flex items-center gap-(--space-3)">
      <span className="tnum shrink-0 text-body-sm text-muted-foreground">
        {t(labelKey, { done, total })}
      </span>
      <span
        aria-hidden="true"
        className="h-1 min-w-12 flex-1 overflow-hidden rounded-full bg-(--brand-100) dark:bg-muted"
      >
        <span
          className="block h-full rounded-full bg-primary transition-[width] duration-(--dur-base) ease-(--ease-out)"
          style={{ width: `${percent}%` }}
        />
      </span>
    </div>
  );
}
