"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import { Menu } from "@/components/ui/Menu";
import { Spinner } from "@/components/ui/Spinner";
import { ITEM_NAME_MAX } from "@/lib/api/types";
import { cn } from "@/lib/utils/cn";

/**
 * One checklist item — UI_Plan.md §7.3.
 *
 * A real `<input type="checkbox">` with a real `<label>`, not a styled div:
 * that is what gives us space-to-toggle, the native checked state for screen
 * readers, and form semantics for free (§13). The visual box is drawn on a
 * sibling span and the input is `sr-only` but never `display: none`, which
 * would drop it out of the focus order.
 *
 * The whole row is the label, so the 44 px hit target is the row rather than
 * the 24 px box.
 */
export function ChecklistRow({
  name,
  estimatedTime,
  completed,
  onToggle,
  onRename,
  onRemove,
  busy = false,
  disabled = false,
}: {
  name: string;
  estimatedTime?: string | null;
  completed: boolean;
  onToggle: (completed: boolean) => void;
  /** Absent → the row is read-only (no id to PATCH, or a preview). */
  onRename?: (name: string) => void;
  onRemove?: () => void;
  /** A mutation is in flight for this row: spinner, dimmed, not interactive (§12.1). */
  busy?: boolean;
  disabled?: boolean;
}) {
  const t = useTranslations("plan");
  const inputId = useId();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const editRef = useRef<HTMLInputElement>(null);

  // §7.3: tapping the label opens an input with the text already selected, so
  // the common case (replace the whole thing) is one keystroke.
  useEffect(() => {
    if (!editing) return;
    const element = editRef.current;
    element?.focus();
    element?.select();
  }, [editing]);

  function commit() {
    setEditing(false);
    const next = draft.trim();
    if (!next || next === name) {
      setDraft(name);
      return;
    }
    onRename?.(next);
  }

  if (editing) {
    return (
      <li className="flex items-center gap-(--space-2) px-(--space-2)">
        <input
          ref={editRef}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commit();
            }
            if (event.key === "Escape") {
              event.preventDefault();
              setDraft(name);
              setEditing(false);
            }
          }}
          maxLength={ITEM_NAME_MAX}
          aria-label={t("renameItem")}
          className="min-h-11 min-w-0 flex-1 rounded-sm border border-border-input bg-card px-(--space-2) text-body-sm"
        />
      </li>
    );
  }

  return (
    <li className="flex items-center gap-(--space-1)">
      <label
        htmlFor={inputId}
        className={cn(
          "flex min-h-11 flex-1 cursor-pointer items-center gap-(--space-3) rounded-md px-(--space-2)",
          "transition-colors duration-(--dur-fast) hover:bg-muted",
          "has-[:focus-visible]:outline has-[:focus-visible]:outline-2",
          "has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-(--color-ring)",
          (busy || disabled) && "pointer-events-none opacity-60",
        )}
      >
        <input
          id={inputId}
          type="checkbox"
          checked={completed}
          disabled={busy || disabled}
          onChange={(event) => onToggle(event.target.checked)}
          className="sr-only"
        />

        {/* The drawn box. Decorative — the input above carries the real state. */}
        <span
          aria-hidden="true"
          className={cn(
            "grid size-6 shrink-0 place-items-center rounded-sm border-2",
            "transition-colors duration-(--dur-fast)",
            completed ? "border-primary bg-primary" : "border-border-input bg-card",
          )}
        >
          {completed ? (
            <svg viewBox="0 0 16 16" className="size-4 text-on-primary" fill="none">
              <path
                d="M3.5 8.5l3 3 6-7"
                stroke="currentColor"
                strokeWidth="2.25"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          ) : null}
        </span>

        <span
          className={cn(
            "min-w-0 flex-1 text-body-sm",
            completed && "text-muted-foreground line-through",
          )}
        >
          {name}
        </span>

        {busy ? <Spinner className="text-muted-foreground" /> : null}

        {estimatedTime ? (
          <span className="tnum shrink-0 rounded-sm bg-muted px-(--space-2) py-0.5 text-caption text-muted-foreground">
            {estimatedTime}
          </span>
        ) : null}
      </label>

      {onRename || onRemove ? (
        <Menu
          label={t("itemActions", { name })}
          actions={[
            ...(onRename
              ? [
                  {
                    key: "rename",
                    label: t("rename"),
                    onSelect: () => {
                      setDraft(name);
                      setEditing(true);
                    },
                  },
                ]
              : []),
            ...(onRemove
              ? [
                  {
                    key: "delete",
                    label: t("deleteItem"),
                    destructive: true,
                    onSelect: onRemove,
                  },
                ]
              : []),
          ]}
        />
      ) : null}
    </li>
  );
}
