"use client";

import Link from "next/link";
import { Check } from "@phosphor-icons/react/dist/ssr/Check";
import { useLocale, useTranslations } from "next-intl";

import { planTypeMeta } from "@/components/plan/planTypeMeta";
import { ProgressMeter } from "@/components/plan/ProgressMeter";
import { Menu } from "@/components/ui/Menu";
import { completedItems, fromPlanDocument, totalItems } from "@/lib/api/normalise";
import type { PlanDocument } from "@/lib/api/types";
import { absoluteTime, relativeTime } from "@/lib/utils/time";
import { cn } from "@/lib/utils/cn";

/**
 * One row in the plans library — UI_Plan.md §7.6.
 *
 * The **original prompt** is on the row in quotes, because that is how people
 * actually recall a plan: "the one where I said I had no energy", not "Recover
 * and Reset". The generated title is the heading; the prompt is the memory.
 *
 * The whole row is one link. The overflow menu sits outside it — a menu button
 * nested inside an anchor is not a valid target and swallows its own clicks.
 */
export function PlanRow({
  document,
  onDelete,
  onCopy,
}: {
  document: PlanDocument;
  onDelete: () => void;
  onCopy: () => void;
}) {
  const t = useTranslations("plan");
  const tCommon = useTranslations("common");
  const locale = useLocale();

  const plan = fromPlanDocument(document);
  const meta = planTypeMeta(plan.planType);
  const Icon = meta.icon;

  const total = totalItems(plan);
  const done = completedItems(plan);
  const complete = total > 0 && done === total;
  const stamp = relativeTime(document.updated_at ?? document.created_at, locale);

  return (
    <li
      className={cn(
        "relative flex flex-col gap-(--space-2) rounded-lg border border-border bg-card p-(--space-4)",
        // §7.6: a finished plan gets a quiet brand wash *and* a check — the
        // wash alone would be colour carrying meaning on its own.
        complete && "bg-(--brand-050) dark:bg-card",
      )}
      style={{ boxShadow: "var(--shadow-1)" }}
    >
      <div className="flex items-start justify-between gap-(--space-2)">
        <div className="flex min-w-0 flex-col gap-(--space-1)">
          <span className="inline-flex items-center gap-(--space-1) text-overline uppercase text-primary">
            <Icon
              aria-hidden="true"
              style={{ width: "var(--icon-sm)", height: "var(--icon-sm)" }}
            />
            {t(`type.${meta.labelKey}`)}
          </span>

          <h2 className="text-h3 text-pretty">
            {/* The stretched link makes the whole card the target while keeping
                the accessible name to just the title. */}
            <Link href={`/plans/${document.id}`} className="after:absolute after:inset-0">
              {plan.title}
            </Link>
          </h2>
        </div>

        {/* Raised above the stretched link so the menu stays clickable. */}
        <div className="relative z-10">
          <Menu
            label={t("actions")}
            actions={[
              { key: "copy", label: t("copyAsText"), onSelect: onCopy },
              {
                key: "delete",
                label: t("delete"),
                destructive: true,
                onSelect: onDelete,
              },
            ]}
          />
        </div>
      </div>

      <div className="flex items-center gap-(--space-2)">
        <ProgressMeter done={done} total={total} />
        {complete ? (
          <span className="inline-flex items-center gap-1 text-caption text-success">
            <Check
              aria-hidden="true"
              weight="bold"
              style={{ width: "var(--icon-sm)", height: "var(--icon-sm)" }}
            />
            <span className="sr-only">{tCommon("complete")}</span>
          </span>
        ) : null}
      </div>

      {document.prompt ? (
        <p className="line-clamp-2 text-body-sm text-muted-foreground">
          {/* Typographic quotes, and the locale's own — an Arabic prompt should
              not be wrapped in English quotation marks (§9). */}
          {locale === "ar" ? `«${document.prompt}»` : `“${document.prompt}”`}
        </p>
      ) : null}

      {stamp ? (
        <time
          dateTime={document.updated_at ?? document.created_at}
          title={absoluteTime(document.updated_at ?? document.created_at, locale) ?? undefined}
          className="text-caption text-muted-foreground"
        >
          {stamp}
        </time>
      ) : null}
    </li>
  );
}
