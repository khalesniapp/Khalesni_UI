"use client";

import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr/ArrowRight";
import { useLocale, useTranslations } from "next-intl";

import { Card, CardBadge } from "@/components/ui/Card";
import { ClampedText } from "@/components/ui/ClampedText";
import { Menu, type MenuAction } from "@/components/ui/Menu";
import { isEditable, type Plan } from "@/lib/api/normalise";
import type { ItemMutations } from "@/lib/hooks/useItemMutations";
import { absoluteTime, relativeTime } from "@/lib/utils/time";
import { Checklist } from "./Checklist";
import { PersistenceNotice } from "./PersistenceNotice";
import { planTypeMeta } from "./planTypeMeta";

/** Rendered read-only, so this is never reached — it just keeps the prop typed. */
const NOOP_TOGGLE = () => undefined;

/**
 * The plan card — UI_Plan.md §7.3, the heart of the product.
 *
 * It takes a normalised `Plan` (trap 1), so it never knows whether the data
 * came from a generate response or a saved document. Everything that differs
 * between those two — a missing id, a failed write — is expressed through
 * `isEditable`, not through a shape check.
 *
 * `mutations` is optional. Without it the checklist renders read-only: that is
 * the plans-library preview, where a tick would have nowhere to go.
 */
export function PlanCard({
  plan,
  mutations,
  onRetrySave,
  retryingSave = false,
  actions = [],
  /** Detail view (§7.6) renders everything expanded and drops the "Open plan" link. */
  expanded = false,
}: {
  plan: Plan;
  mutations?: ItemMutations;
  onRetrySave?: () => void;
  retryingSave?: boolean;
  actions?: readonly MenuAction[];
  expanded?: boolean;
}) {
  const t = useTranslations("plan");
  const locale = useLocale();

  const meta = planTypeMeta(plan.planType);
  const Icon = meta.icon;
  const editable = isEditable(plan);
  const saved = relativeTime(plan.updatedAt ?? plan.createdAt, locale);

  // Trap 3: no id, or the write failed → ticks are local only and the notice
  // says so. Either way we never attempt a PATCH.
  const showNotice = !editable;

  // Server-backed editing needs an id; local-only ticking (trap 3) still needs
  // a toggle handler, which is why `mutations` supplies both. Without it the
  // checklist is rendered disabled, so the handler is never reached.
  const toggle = mutations?.toggle ?? NOOP_TOGGLE;

  return (
    <Card as="article" className="flex flex-col gap-(--space-4)">
      <header className="flex items-start justify-between gap-(--space-2)">
        <div className="flex min-w-0 flex-col gap-(--space-2)">
          <CardBadge
            icon={
              <Icon
                aria-hidden="true"
                style={{ width: "var(--icon-sm)", height: "var(--icon-sm)" }}
              />
            }
          >
            {t("badge", { type: t(`type.${meta.labelKey}`) })}
          </CardBadge>

          {/* Wraps, never truncates (§7.3). `text-pretty` keeps a lone word off line two. */}
          <h2 className="text-h2 text-pretty">{plan.title}</h2>
        </div>

        {actions.length > 0 ? <Menu label={t("actions")} actions={actions} /> : null}
      </header>

      {plan.description ? (
        expanded ? (
          <p className="text-body-sm text-muted-foreground">{plan.description}</p>
        ) : (
          <ClampedText>{plan.description}</ClampedText>
        )
      ) : null}

      {showNotice ? (
        <PersistenceNotice onRetry={onRetrySave} retrying={retryingSave} />
      ) : null}

      {plan.tasks.length > 0 || mutations ? (
        <Checklist
          itemType="tasks"
          heading={t("tasks")}
          items={plan.tasks.map((task, index) => ({
            index,
            name: task.task_name,
            estimatedTime: task.estimated_time,
            completed: task.completed,
          }))}
          onToggle={toggle}
          onRename={mutations?.readOnly === false ? mutations.rename : undefined}
          onRemove={mutations?.readOnly === false ? mutations.remove : undefined}
          onAdd={
            mutations?.readOnly === false
              ? (itemType, name) => mutations.add(itemType, name)
              : undefined
          }
          busyIndices={mutations?.busy.tasks}
          collapsible={!expanded}
          disabled={!mutations}
        />
      ) : null}

      {/* §7.3: the readiness section only exists when it is non-empty. */}
      {plan.outing_readiness.length > 0 ? (
        <Checklist
          itemType="outing_readiness"
          heading={t(`readiness.${meta.readinessKey}`)}
          items={plan.outing_readiness.map((item, index) => ({
            index,
            name: item.item_name,
            completed: item.completed,
          }))}
          onToggle={toggle}
          onRename={mutations?.readOnly === false ? mutations.rename : undefined}
          onRemove={mutations?.readOnly === false ? mutations.remove : undefined}
          onAdd={
            mutations?.readOnly === false
              ? (itemType, name) => mutations.add(itemType, name)
              : undefined
          }
          busyIndices={mutations?.busy.outing_readiness}
          collapsible={!expanded}
          disabled={!mutations}
        />
      ) : null}

      <footer className="flex flex-wrap items-center justify-between gap-(--space-2) border-t border-border pt-(--space-3)">
        {editable && saved ? (
          <p className="text-caption text-muted-foreground">
            <time
              dateTime={plan.updatedAt ?? plan.createdAt}
              title={absoluteTime(plan.updatedAt ?? plan.createdAt, locale) ?? undefined}
            >
              {t("saved", { time: saved })}
            </time>
          </p>
        ) : (
          <span />
        )}

        {plan.id && !expanded ? (
          <Link
            href={`/plans/${plan.id}`}
            className="inline-flex min-h-11 items-center gap-(--space-1) rounded-md px-(--space-2) text-body-sm font-medium text-primary hover:bg-muted"
          >
            {t("open")}
            <ArrowRight
              aria-hidden="true"
              // Mirrored under RTL: the arrow points the way reading travels (§9).
              className="icon-directional"
              style={{ width: "var(--icon-sm)", height: "var(--icon-sm)" }}
            />
          </Link>
        ) : null}
      </footer>
    </Card>
  );
}
