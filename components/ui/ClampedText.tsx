"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils/cn";

/**
 * Text clamped to N lines with a Show more / Show less toggle — UI_Plan.md
 * §7.3 (`truncation-strategy`).
 *
 * The toggle only appears when the text actually overflows, measured after
 * layout rather than guessed from a character count: the same sentence clamps
 * at three lines on a phone and two on a desktop, and a permanently visible
 * "Show more" that reveals nothing is worse than no affordance at all.
 *
 * Re-measured on resize, because rotating a phone changes the answer.
 */
export function ClampedText({
  children,
  lines = 3,
  className,
}: {
  children: string;
  lines?: number;
  className?: string;
}) {
  const t = useTranslations("common");
  const ref = useRef<HTMLParagraphElement>(null);
  const [overflows, setOverflows] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    function measure() {
      if (!element) return;
      // Only meaningful while clamped; when expanded the element is its full
      // height by definition, so the previous answer still stands.
      if (expanded) return;
      setOverflows(element.scrollHeight > element.clientHeight + 1);
    }

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [children, expanded, lines]);

  return (
    <div className="flex flex-col items-start gap-(--space-1)">
      <p
        ref={ref}
        className={cn("text-body-sm text-muted-foreground", className)}
        style={
          expanded
            ? undefined
            : {
                display: "-webkit-box",
                WebkitBoxOrient: "vertical",
                WebkitLineClamp: lines,
                overflow: "hidden",
              }
        }
      >
        {children}
      </p>

      {overflows ? (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="min-h-11 rounded-md text-body-sm text-primary hover:underline"
        >
          {t(expanded ? "showLess" : "showMore")}
        </button>
      ) : null}
    </div>
  );
}
