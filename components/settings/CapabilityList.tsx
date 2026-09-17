"use client";

import { useTranslations } from "next-intl";

import { capabilityRows, type CapabilityState } from "@/lib/api/health";
import { useCapabilities } from "@/lib/hooks/useCapabilities";
import { cn } from "@/lib/utils/cn";

/**
 * "What Khalesni can do right now" — UI_Plan.md §7.8, §6.5.
 *
 * Generated from `/health`, never from a failed click (trap 6). Each row is a
 * status dot *plus* a text label: `color-not-only` means the dot alone is not
 * allowed to carry the meaning, so the label is the real signal and the dot is
 * decorative.
 */

const DOT_CLASS: Record<CapabilityState, string> = {
  working: "bg-success",
  unavailable: "bg-warning",
  off: "bg-muted-foreground",
};

export function CapabilityList() {
  const t = useTranslations("settings");
  const { health, loading, unreachable, refetch } = useCapabilities();

  if (loading) {
    return (
      <p className="text-body-sm text-muted-foreground" role="status">
        {t("status.checking")}
      </p>
    );
  }

  if (unreachable || !health) {
    return (
      <div className="flex flex-col items-start gap-(--space-3)">
        <p className="text-body-sm text-warning">{t("status.unreachable")}</p>
        <button
          type="button"
          onClick={refetch}
          className="min-h-11 rounded-md bg-primary px-(--space-4) text-label text-on-primary"
        >
          {t("status.checking")}
        </button>
      </div>
    );
  }

  const rows = capabilityRows(health);

  return (
    <div className="flex flex-col gap-(--space-3)">
      <ul className="flex flex-col gap-(--space-3)">
        {rows.map((row) => (
          <li key={row.key} className="flex flex-col gap-1">
            <div className="flex items-center justify-between gap-(--space-3)">
              <span className="flex items-center gap-(--space-2) text-body-sm">
                <span
                  aria-hidden="true"
                  className={cn("size-2 shrink-0 rounded-full", DOT_CLASS[row.state])}
                />
                {t(`capability.${row.key}`)}
              </span>
              <span className="text-body-sm text-muted-foreground">
                {t(`status.${row.state}`)}
              </span>
            </div>

            {/* The consequence in plain language, not an icon the user must decode. */}
            {row.consequenceKey && (
              <p className="ps-(--space-4) text-caption text-muted-foreground">
                {t(row.consequenceKey)}
              </p>
            )}
          </li>
        ))}
      </ul>

      {health.llm_model && health.llm_provider && (
        <p className="text-caption text-muted-foreground">
          {t("model", { model: health.llm_model, provider: health.llm_provider })}
        </p>
      )}
    </div>
  );
}
