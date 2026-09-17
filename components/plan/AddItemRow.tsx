"use client";

import { useRef, useState } from "react";
import { Plus } from "@phosphor-icons/react/dist/ssr/Plus";

import { Spinner } from "@/components/ui/Spinner";
import { ITEM_NAME_MAX } from "@/lib/api/types";

/**
 * The ghost row at the end of each checklist — UI_Plan.md §7.3.
 *
 * Enter adds and **keeps the input open**, so a burst of items ("passport",
 * "charger", "adapter") is one uninterrupted stretch of typing rather than
 * five round trips through a button. Escape closes it.
 *
 * The input stays mounted and focused across the request; the spinner sits
 * beside it rather than replacing it, so focus is never dropped mid-burst.
 */
export function AddItemRow({
  label,
  onAdd,
}: {
  label: string;
  onAdd: (name: string) => Promise<void> | void;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function commit() {
    const name = value.trim();
    if (!name || saving) return;

    setSaving(true);
    try {
      await onAdd(name);
      setValue("");
      inputRef.current?.focus();
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          // The input mounts this tick; focus it on the next one.
          window.requestAnimationFrame(() => inputRef.current?.focus());
        }}
        className="flex min-h-11 items-center gap-(--space-2) rounded-md border border-dashed border-border-input px-(--space-3) text-body-sm text-muted-foreground transition-colors duration-(--dur-fast) hover:bg-muted hover:text-foreground"
      >
        <Plus aria-hidden="true" style={{ width: "var(--icon-sm)", height: "var(--icon-sm)" }} />
        {label}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-(--space-2) rounded-md border border-border-input px-(--space-3)">
      <input
        ref={inputRef}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            void commit();
          }
          if (event.key === "Escape") {
            event.preventDefault();
            setOpen(false);
            setValue("");
          }
        }}
        onBlur={() => {
          // Closing on blur only when nothing was typed keeps a half-finished
          // item from vanishing because someone glanced at another window.
          if (!value.trim()) setOpen(false);
        }}
        maxLength={ITEM_NAME_MAX}
        aria-label={label}
        placeholder={label}
        className="min-h-11 min-w-0 flex-1 bg-transparent text-body-sm focus:outline-none"
      />

      {saving ? <Spinner className="text-muted-foreground" /> : null}
    </div>
  );
}
