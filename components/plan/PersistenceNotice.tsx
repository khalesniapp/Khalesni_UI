"use client";

import { Warning } from "@phosphor-icons/react/dist/ssr/Warning";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/Button";

/**
 * The `persisted: false` notice — UI_Plan.md §7.3, trap 3.
 *
 * Mongo failed but the plan itself is fine, so the plan stays on screen and
 * the notice says plainly that ticking will not be remembered. §7.3 calls this
 * "the single most important honesty affordance in the app" and explicitly
 * forbids softening it into a toast, so it renders inline, in amber, with the
 * consequence stated rather than implied.
 *
 * `--color-warning` is a text-safe amber in both themes; the icon is
 * decorative because the heading already says "Not saved".
 */
export function PersistenceNotice({
  onRetry,
  retrying = false,
}: {
  /** Re-sends the same prompt. Absent when there is nothing to re-send. */
  onRetry?: () => void;
  retrying?: boolean;
}) {
  const t = useTranslations("plan.notSaved");

  return (
    <div
      role="status"
      className="flex flex-col gap-(--space-2) rounded-md border border-(--color-warning)/40 bg-(--color-warning)/8 p-(--space-3)"
    >
      <p className="flex items-center gap-(--space-2) text-label text-(--color-warning)">
        <Warning
          aria-hidden="true"
          weight="fill"
          style={{ width: "var(--icon-sm)", height: "var(--icon-sm)" }}
        />
        {t("title")}
      </p>

      <p className="text-body-sm text-muted-foreground">{t("body")}</p>

      {onRetry ? (
        <div>
          <Button size="sm" onClick={onRetry} loading={retrying}>
            {t("retry")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
