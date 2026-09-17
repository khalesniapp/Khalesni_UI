"use client";

import { Lightning } from "@phosphor-icons/react/dist/ssr/Lightning";
import { useLocale, useTranslations } from "next-intl";

import { Card, CardBadge } from "@/components/ui/Card";
import { ClampedText } from "@/components/ui/ClampedText";
import { Menu, type MenuAction } from "@/components/ui/Menu";
import type { RealtimeAnswer } from "@/lib/api/types";
import { absoluteTime, relativeTime } from "@/lib/utils/time";
import { SourceList } from "./SourceList";

/**
 * A live-web answer — UI_Plan.md §7.5.
 *
 * Not a plan and never saved, so there are no plan actions in the menu and no
 * "Open" link. The age stamp is load-bearing rather than decorative: a
 * real-time answer decays, and "checked 40 minutes ago" is the difference
 * between trusting it and re-asking.
 *
 * The answer is clamped past ten lines. §20 leaves open whether the backend
 * returns short prose or a raw search dump; clamping costs nothing in the short
 * case and saves the card from becoming a wall of text in the long one.
 */
const ANSWER_CLAMP_LINES = 10;

export function AnswerCard({
  answer,
  createdAt,
  actions = [],
}: {
  answer: RealtimeAnswer;
  createdAt: string;
  actions?: readonly MenuAction[];
}) {
  const t = useTranslations("realtime");
  const locale = useLocale();
  const checked = relativeTime(createdAt, locale);

  return (
    <Card as="article" className="flex flex-col gap-(--space-3)">
      <header className="flex items-start justify-between gap-(--space-2)">
        <CardBadge
          tone="accent"
          icon={
            <Lightning
              aria-hidden="true"
              weight="fill"
              style={{ width: "var(--icon-sm)", height: "var(--icon-sm)" }}
            />
          }
        >
          {t("badge")}
        </CardBadge>

        {actions.length > 0 ? <Menu label={t("actions")} actions={actions} /> : null}
      </header>

      {/* §7.5: 68ch keeps the measure readable at desktop widths (`line-length`). */}
      <div className="max-w-[68ch]">
        <ClampedText lines={ANSWER_CLAMP_LINES} className="text-body text-card-foreground">
          {answer.answer}
        </ClampedText>
      </div>

      <SourceList sources={answer.sources} />

      {checked ? (
        <p className="text-caption text-muted-foreground">
          <time dateTime={createdAt} title={absoluteTime(createdAt, locale) ?? undefined}>
            {t("checked", { time: checked })}
          </time>
        </p>
      ) : null}
    </Card>
  );
}
