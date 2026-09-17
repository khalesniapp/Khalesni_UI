import type { ElementType, ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

/**
 * The card surface — UI_Plan.md §8.4.
 *
 * One elevation level (`--shadow-1`) and one radius (`--radius-lg`) for every
 * assistant card in the thread, so PlanCard, AnswerCard and PlacesCard read as
 * one family rather than three components that each chose their own shadow.
 */
export function Card({
  as: Tag = "div",
  className,
  children,
  ...rest
}: {
  as?: ElementType;
  className?: string;
  children: ReactNode;
} & Record<string, unknown>) {
  return (
    <Tag
      className={cn(
        "rounded-lg border border-border bg-card text-card-foreground",
        "p-(--space-4) sm:p-(--space-5)",
        className,
      )}
      style={{ boxShadow: "var(--shadow-1)" }}
      {...rest}
    >
      {children}
    </Tag>
  );
}

/**
 * The 11 px uppercase type badge that opens PlanCard and AnswerCard (§7.3,
 * §7.5). Colour alone never carries the meaning — the label is always there.
 */
export function CardBadge({
  icon,
  children,
  tone = "brand",
}: {
  icon?: ReactNode;
  children: ReactNode;
  tone?: "brand" | "accent";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-(--space-1) text-overline uppercase",
        tone === "brand" ? "text-primary" : "text-(--accent-700) dark:text-accent",
      )}
    >
      {icon}
      {children}
    </span>
  );
}
