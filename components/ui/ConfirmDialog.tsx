"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";

import { Button } from "./Button";

/**
 * A confirmation dialog — UI_Plan.md §7.6, §13.
 *
 * Built on the native `<dialog>` element with `showModal()`, which gives us the
 * focus trap, the Escape handler, the inert background and the top-layer
 * stacking from the platform rather than from a re-implementation that gets
 * one of them subtly wrong.
 *
 * Used where an action cannot be undone. `DELETE /api/plans/...` returns 204
 * and there is no way back, so §7.6 spends a dialog on it rather than offering
 * an Undo toast that would be a lie.
 *
 * The destructive button is separated from Cancel by a gap and by order, so
 * muscle memory does not land on it (`destructive-nav-separation`).
 */
export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  onConfirm,
  onCancel,
  busy = false,
}: {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
}) {
  const t = useTranslations("common");
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;

    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      // Escape fires `cancel`; routing it through the same handler as the
      // Cancel button keeps the caller's state in step with the element's.
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onCancel();
      }}
      onClose={() => {
        if (open && !busy) onCancel();
      }}
      aria-labelledby="confirm-title"
      aria-describedby="confirm-body"
      className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-lg border border-border bg-card p-(--space-5) text-card-foreground backdrop:bg-(--color-scrim)"
      style={{ boxShadow: "var(--shadow-3)" }}
    >
      <div className="flex flex-col gap-(--space-4)">
        <h2 id="confirm-title" className="text-h2">
          {title}
        </h2>

        <p id="confirm-body" className="text-body-sm text-muted-foreground">
          {body}
        </p>

        <div className="flex flex-wrap justify-end gap-(--space-3)">
          <Button onClick={onCancel} disabled={busy}>
            {t("cancel")}
          </Button>
          <Button variant="destructive" onClick={onConfirm} loading={busy}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </dialog>
  );
}
