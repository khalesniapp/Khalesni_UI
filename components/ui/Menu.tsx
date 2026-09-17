"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { DotsThree } from "@phosphor-icons/react/dist/ssr/DotsThree";

import { cn } from "@/lib/utils/cn";

/**
 * The overflow menu behind every `⋯` — UI_Plan.md §7.2.5, §7.6.
 *
 * Hand-rolled rather than pulled from a component library, matching the rest of
 * `components/ui/`: we own the code, and the keyboard contract here is small
 * enough to implement completely — Enter/Space or ArrowDown opens and focuses
 * the first item, Escape closes and returns focus to the trigger, Arrow keys
 * roam, Tab or an outside click closes.
 *
 * The popup is `role="menu"` with `role="menuitem"` children, and the trigger
 * carries `aria-haspopup`/`aria-expanded`, so a screen reader announces it as a
 * menu button rather than an unlabelled icon.
 */

export interface MenuAction {
  key: string;
  label: string;
  icon?: ReactNode;
  onSelect: () => void;
  /** Rendered in `--color-destructive` and separated from the rest (§7.6). */
  destructive?: boolean;
  disabled?: boolean;
}

export function Menu({ label, actions }: { label: string; actions: readonly MenuAction[] }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemsRef = useRef<Array<HTMLButtonElement | null>>([]);
  const menuId = useId();

  // Focus the first item on open — a menu that opens without moving focus
  // leaves keyboard users with nothing to act on.
  useEffect(() => {
    if (open) itemsRef.current[0]?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    // `focusin` covers Tab as well as clicks, without trapping focus.
    function onFocusIn(event: FocusEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("focusin", onFocusIn);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("focusin", onFocusIn);
    };
  }, [open]);

  function close(returnFocus = true) {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  }

  function onItemKeyDown(event: React.KeyboardEvent, index: number) {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const delta = event.key === "ArrowDown" ? 1 : -1;
      const next = (index + delta + actions.length) % actions.length;
      itemsRef.current[next]?.focus();
      return;
    }
    if (event.key === "Home") {
      event.preventDefault();
      itemsRef.current[0]?.focus();
    }
    if (event.key === "End") {
      event.preventDefault();
      itemsRef.current[actions.length - 1]?.focus();
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((value) => !value)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setOpen(true);
          }
        }}
        className={cn(
          "inline-flex size-11 shrink-0 items-center justify-center rounded-md",
          "text-muted-foreground transition-colors duration-(--dur-fast) hover:bg-muted hover:text-foreground",
        )}
      >
        <DotsThree
          aria-hidden="true"
          weight="bold"
          style={{ width: "var(--icon-lg)", height: "var(--icon-lg)" }}
        />
      </button>

      {open ? (
        <div
          id={menuId}
          role="menu"
          aria-label={label}
          // `end-0` rather than `right-0` so the menu flips side under RTL (§9).
          className="absolute end-0 top-full mt-1 min-w-44 overflow-hidden rounded-md border border-border bg-card py-1"
          style={{ boxShadow: "var(--shadow-3)", zIndex: "var(--z-sheet)" }}
        >
          {actions.map((action, index) => (
            <button
              key={action.key}
              ref={(node) => {
                itemsRef.current[index] = node;
              }}
              type="button"
              role="menuitem"
              disabled={action.disabled}
              onKeyDown={(event) => onItemKeyDown(event, index)}
              onClick={() => {
                close();
                action.onSelect();
              }}
              className={cn(
                "flex min-h-11 w-full items-center gap-(--space-2) px-(--space-3) text-start text-body-sm",
                "transition-colors duration-(--dur-fast) hover:bg-muted disabled:opacity-60",
                action.destructive
                  ? "mt-1 border-t border-border text-destructive"
                  : "text-foreground",
              )}
            >
              {action.icon}
              {action.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
