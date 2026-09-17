"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { MagnifyingGlass } from "@phosphor-icons/react/dist/ssr/MagnifyingGlass";
import { useTranslations } from "next-intl";

import { planTypeMeta } from "@/components/plan/planTypeMeta";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ErrorCard } from "@/components/chat/ErrorCard";
import { useCapabilities } from "@/lib/hooks/useCapabilities";
import { useDeletePlan, usePlansList } from "@/lib/hooks/usePlans";
import { useStoredFlag } from "@/lib/hooks/useStoredFlag";
import type { PlanDocument, PlanType } from "@/lib/api/types";
import { useToasts } from "@/lib/stores/toasts";
import { cn } from "@/lib/utils/cn";
import { PlanRow } from "./PlanRow";
import { PlanRowSkeleton } from "./PlanRowSkeleton";

/**
 * The plans library — UI_Plan.md §7.6.
 *
 * Filtering and search are client-side because there is no search endpoint: the
 * list arrives whole (up to the backend's 100) and filtering it in the browser
 * is both simpler and instant. Search covers title, description and prompt,
 * since the prompt is what people remember.
 *
 * Filter chips are derived from the plan types actually present — a chip that
 * matches nothing is a dead end, so it is not drawn.
 */
export function PlansLibrary() {
  const t = useTranslations("plans");
  const tPlan = useTranslations("plan");
  const tCommon = useTranslations("common");

  const { plans, loading, error, refetch, canLoadMore, atCeiling, loadMore } = usePlansList();
  const { canSavePlans, health } = useCapabilities();
  const remove = useDeletePlan();
  const showToast = useToasts((state) => state.show);

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<PlanType | "all">("all");
  const [pendingDelete, setPendingDelete] = useState<PlanDocument | null>(null);

  // §7.6: the toggle is remembered. Per-screen, so it lives in localStorage
  // rather than in the prefs store — it is not part of who the user is.
  const [hideCompleted, toggleHideCompleted] = useStoredFlag("khalesni.plans.hideCompleted");

  const presentTypes = useMemo(() => {
    const seen = new Set<PlanType>();
    for (const plan of plans) seen.add(plan.plan_type);
    return [...seen];
  }, [plans]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return plans.filter((plan) => {
      if (filter !== "all" && plan.plan_type !== filter) return false;

      if (hideCompleted) {
        const total = plan.tasks.length + plan.outing_readiness.length;
        const done =
          plan.tasks.filter((task) => task.completed).length +
          plan.outing_readiness.filter((item) => item.completed).length;
        if (total > 0 && done === total) return false;
      }

      if (!needle) return true;
      return [plan.title, plan.description, plan.prompt]
        .filter(Boolean)
        .some((field) => field.toLowerCase().includes(needle));
    });
  }, [plans, filter, hideCompleted, query]);

  function copyAsText(plan: PlanDocument) {
    const lines = [
      plan.title,
      plan.description,
      "",
      ...plan.tasks.map(
        (task) =>
          `${task.completed ? "[x]" : "[ ]"} ${task.task_name}${
            task.estimated_time ? ` (${task.estimated_time})` : ""
          }`,
      ),
      ...plan.outing_readiness.map(
        (item) => `${item.completed ? "[x]" : "[ ]"} ${item.item_name}`,
      ),
    ];

    void navigator.clipboard
      .writeText(lines.join("\n").trim())
      .then(() => showToast({ message: tCommon("copied") }))
      .catch(() => undefined);
  }

  function confirmDelete() {
    const target = pendingDelete;
    if (!target) return;

    remove.mutate(target.id, {
      onSuccess: () => {
        setPendingDelete(null);
        showToast({ message: t("deleted") });
      },
      onError: () => {
        setPendingDelete(null);
        showToast({ message: tPlan("saveFailed") });
      },
    });
  }

  // Trap 6 / §12.3: Mongo being down is not a UI failure, and the explanation
  // belongs here rather than behind a retry that will fail the same way.
  if (health && !canSavePlans) {
    return (
      <p className="rounded-lg border border-border bg-card p-(--space-5) text-body-sm text-muted-foreground">
        {tCommon("plansDown")}
      </p>
    );
  }

  if (loading) {
    return (
      <ul className="flex flex-col gap-(--space-3)" aria-busy="true">
        {[0, 1, 2].map((index) => (
          <PlanRowSkeleton key={index} />
        ))}
      </ul>
    );
  }

  if (error) {
    return (
      <ErrorCard
        status={error.status}
        detail={error.detail}
        requestId={error.requestId}
        onRetry={refetch}
      />
    );
  }

  if (plans.length === 0) {
    return (
      <div className="flex flex-col items-start gap-(--space-4) rounded-lg border border-border bg-card p-(--space-5)">
        <p className="text-body-sm text-muted-foreground">{t("empty")}</p>
        {/* A link, styled as the primary action — not a Button wrapping an
            anchor, which would nest interactive elements. */}
        <Link
          href="/"
          className="inline-flex min-h-11 items-center justify-center rounded-md bg-primary px-(--space-4) text-body font-medium text-on-primary hover:opacity-90"
        >
          {t("startChat")}
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-(--space-4)">
      <div className="flex flex-col gap-(--space-3)">
        <label className="flex min-h-11 items-center gap-(--space-2) rounded-sm border border-border-input bg-card px-(--space-3)">
          <MagnifyingGlass
            aria-hidden="true"
            className="shrink-0 text-muted-foreground"
            style={{ width: "var(--icon-md)", height: "var(--icon-md)" }}
          />
          <span className="sr-only">{t("search")}</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("search")}
            className="min-h-11 min-w-0 flex-1 bg-transparent text-body focus:outline-none"
          />
        </label>

        {presentTypes.length > 1 ? (
          <div className="flex flex-wrap gap-(--space-2)">
            <FilterChip
              label={t("filterAll")}
              active={filter === "all"}
              onClick={() => setFilter("all")}
            />
            {presentTypes.map((type) => (
              <FilterChip
                key={type}
                label={tPlan(`type.${planTypeMeta(type).labelKey}`)}
                active={filter === type}
                onClick={() => setFilter(type)}
              />
            ))}
          </div>
        ) : null}

        <label className="flex min-h-11 items-center gap-(--space-2) text-body-sm">
          <input
            type="checkbox"
            checked={hideCompleted}
            onChange={(event) => toggleHideCompleted(event.target.checked)}
            className="size-5 accent-[var(--color-primary)]"
          />
          {t("hideCompleted")}
        </label>
      </div>

      {visible.length === 0 ? (
        <div className="flex flex-col items-start gap-(--space-3) rounded-lg border border-border bg-card p-(--space-5)">
          <p className="text-body-sm text-muted-foreground">{t("noMatches")}</p>
          <Button
            size="sm"
            onClick={() => {
              setFilter("all");
              setQuery("");
              toggleHideCompleted(false);
            }}
          >
            {t("clearFilter")}
          </Button>
        </div>
      ) : (
        <ul className="flex flex-col gap-(--space-3)">
          {visible.map((plan) => (
            <PlanRow
              key={plan.id}
              document={plan}
              onCopy={() => copyAsText(plan)}
              onDelete={() => setPendingDelete(plan)}
            />
          ))}
        </ul>
      )}

      {canLoadMore ? (
        <Button onClick={loadMore} fullWidth>
          {tCommon("loadMore")}
        </Button>
      ) : null}

      {atCeiling ? (
        <p className="text-caption text-muted-foreground">{t("ceiling")}</p>
      ) : null}

      <ConfirmDialog
        open={pendingDelete !== null}
        title={t("deleteConfirm.title")}
        body={t("deleteConfirm.body", { title: pendingDelete?.title ?? "" })}
        confirmLabel={tPlan("delete")}
        busy={remove.isPending}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex min-h-11 items-center rounded-full border px-(--space-4) text-body-sm",
        "transition-colors duration-(--dur-fast)",
        active
          ? "border-primary bg-primary text-on-primary"
          : "border-border-input text-muted-foreground hover:bg-muted",
      )}
    >
      {label}
    </button>
  );
}
