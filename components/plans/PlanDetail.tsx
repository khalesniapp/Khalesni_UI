"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr/ArrowLeft";
import { CaretDown } from "@phosphor-icons/react/dist/ssr/CaretDown";
import { useLocale, useTranslations } from "next-intl";

import { ErrorCard } from "@/components/chat/ErrorCard";
import { EditablePlanCard } from "@/components/plan/EditablePlanCard";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { fromPlanDocument } from "@/lib/api/normalise";
import { useDeletePlan, usePlanDetail } from "@/lib/hooks/usePlans";
import { useThread } from "@/lib/stores/thread";
import { useToasts } from "@/lib/stores/toasts";
import { absoluteTime, relativeTime } from "@/lib/utils/time";
import { PlanRowSkeleton } from "./PlanRowSkeleton";

/**
 * A single saved plan — UI_Plan.md §7.6.
 *
 * Same card as the thread, expanded: nothing collapsed, everything editable.
 * The two things this screen adds are both honesty affordances — the "You
 * asked" block, which answers "why does my plan say this?", and the model name
 * in the meta line.
 */
export function PlanDetail({ planId }: { planId: string }) {
  const t = useTranslations("plan");
  const tPlans = useTranslations("plans");
  const tNav = useTranslations("nav");
  const locale = useLocale();
  const router = useRouter();

  const { plan: document, loading, error, notFound, refetch, applyDocument } = usePlanDetail(planId);
  const remove = useDeletePlan();
  const setDraft = useThread((state) => state.setDraft);
  const showToast = useToasts((state) => state.show);

  const [askedOpen, setAskedOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);

  if (loading) {
    return (
      <ul className="flex flex-col gap-(--space-3)" aria-busy="true">
        <PlanRowSkeleton />
      </ul>
    );
  }

  if (notFound) {
    return (
      <div className="flex flex-col items-start gap-(--space-4) rounded-lg border border-border bg-card p-(--space-5)">
        <p className="text-body-sm text-muted-foreground">{tPlans("gone")}</p>
        <Link
          href="/plans"
          className="inline-flex min-h-11 items-center rounded-md bg-primary px-(--space-4) text-body font-medium text-on-primary hover:opacity-90"
        >
          {tPlans("backToPlans")}
        </Link>
      </div>
    );
  }

  if (error || !document) {
    return (
      <ErrorCard
        status={error?.status ?? 0}
        detail={error?.detail ?? ""}
        requestId={error?.requestId ?? null}
        onRetry={refetch}
      />
    );
  }

  const plan = fromPlanDocument(document);
  const stamp = relativeTime(document.updated_at ?? document.created_at, locale);

  /**
   * §7.6: "Continue this in chat" is the bridge back to the conversation. It
   * seeds the composer rather than sending — the user still decides what to
   * actually ask about the plan.
   */
  function continueInChat() {
    setDraft(t("continueSeed", { title: plan.title }));
    router.push("/");
  }

  function confirmDelete() {
    remove.mutate(planId, {
      onSuccess: () => {
        showToast({ message: tPlans("deleted") });
        router.replace("/plans");
      },
      onError: () => {
        setConfirming(false);
        showToast({ message: t("saveFailed") });
      },
    });
  }

  return (
    <div className="flex flex-col gap-(--space-4) pb-(--space-7)">
      <Link
        href="/plans"
        className="inline-flex min-h-11 w-fit items-center gap-(--space-1) rounded-md text-body-sm text-primary hover:underline"
      >
        <ArrowLeft
          aria-hidden="true"
          className="icon-directional"
          style={{ width: "var(--icon-sm)", height: "var(--icon-sm)" }}
        />
        {tNav("plans")}
      </Link>

      {/* §7.6: the model is shown quietly. It is useful and it costs nothing. */}
      <p className="flex flex-wrap items-center gap-(--space-2) text-caption text-muted-foreground">
        {stamp ? (
          <time
            dateTime={document.updated_at ?? document.created_at}
            title={absoluteTime(document.updated_at ?? document.created_at, locale) ?? undefined}
          >
            {stamp}
          </time>
        ) : null}
        {document.model ? <span className="token-ltr">{document.model}</span> : null}
      </p>

      {document.prompt ? (
        <section className="rounded-md border border-border bg-muted/40">
          <button
            type="button"
            onClick={() => setAskedOpen((open) => !open)}
            aria-expanded={askedOpen}
            className="flex min-h-11 w-full items-center justify-between gap-(--space-2) px-(--space-4) text-start text-label"
          >
            {t("youAsked")}
            <CaretDown
              aria-hidden="true"
              className={askedOpen ? "rotate-180 transition-transform" : "transition-transform"}
              style={{ width: "var(--icon-sm)", height: "var(--icon-sm)" }}
            />
          </button>

          {askedOpen ? (
            <div className="flex flex-col gap-(--space-2) px-(--space-4) pb-(--space-4)">
              <p className="text-body-sm">
                {locale === "ar" ? `«${document.prompt}»` : `“${document.prompt}”`}
              </p>
              {document.mood ? (
                <p className="text-caption text-muted-foreground">
                  {t("moodWas", { mood: document.mood })}
                </p>
              ) : null}
            </div>
          ) : null}
        </section>
      ) : null}

      <EditablePlanCard
        plan={plan}
        onDocument={applyDocument}
        onStale={refetch}
        expanded
      />

      <Button onClick={continueInChat} fullWidth>
        {t("continue")}
      </Button>

      {/* §7.6: Delete sits alone at the bottom, visually separated. */}
      <div className="mt-(--space-5) border-t border-border pt-(--space-4)">
        <Button variant="ghost" onClick={() => setConfirming(true)} className="text-destructive">
          {t("delete")}
        </Button>
      </div>

      <ConfirmDialog
        open={confirming}
        title={tPlans("deleteConfirm.title")}
        body={tPlans("deleteConfirm.body", { title: plan.title })}
        confirmLabel={t("delete")}
        busy={remove.isPending}
        onConfirm={confirmDelete}
        onCancel={() => setConfirming(false)}
      />
    </div>
  );
}
