"use client";

import type { ReactNode } from "react";

import { Menu, type MenuAction } from "@/components/ui/Menu";
import { cn } from "@/lib/utils/cn";

/**
 * The two plain bubbles in the thread — UI_Plan.md §5.1, §7.2.
 *
 * Everything richer than these is a card. Both use logical properties for
 * their alignment and their asymmetric corner, so the thread mirrors correctly
 * under RTL without a second stylesheet (§9).
 */

/** The user's own message. Brand-tinted, aligned to the end of the reading line. */
export function UserBubble({ children }: { children: ReactNode }) {
  return (
    <div className="flex justify-end">
      <div
        className={cn(
          "max-w-[85%] rounded-lg rounded-ee-sm bg-(--brand-100) px-(--space-4) py-(--space-3)",
          "text-body whitespace-pre-wrap text-(--color-brand-700)",
          "dark:bg-muted dark:text-foreground",
        )}
      >
        {children}
      </div>
    </div>
  );
}

/**
 * A short conversational reply — `type: "chat"` with no places and no location
 * request. The fallback branch of the router (§5.1).
 */
export function ReplyBubble({
  children,
  actions = [],
  actionsLabel,
}: {
  children: ReactNode;
  actions?: readonly MenuAction[];
  /** Accessible name for the overflow menu. Required whenever actions are given. */
  actionsLabel?: string;
}) {
  return (
    <div className="flex items-start gap-(--space-1)">
      <div
        className={cn(
          "min-w-0 max-w-[85%] rounded-lg rounded-es-sm border border-border bg-card",
          "px-(--space-4) py-(--space-3) text-body whitespace-pre-wrap text-card-foreground",
        )}
        style={{ boxShadow: "var(--shadow-1)" }}
      >
        {children}
      </div>

      {actions.length > 0 && actionsLabel ? (
        <Menu label={actionsLabel} actions={actions} />
      ) : null}
    </div>
  );
}
