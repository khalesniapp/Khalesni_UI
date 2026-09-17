"use client";

import { useEffect } from "react";
import { X } from "@phosphor-icons/react/dist/ssr/X";
import { useTranslations } from "next-intl";

import { useToasts, type Toast } from "@/lib/stores/toasts";

/**
 * The toast region — UI_Plan.md §12.3, §13.
 *
 * `aria-live="polite"` and never focus-stealing: a toast interrupts nothing.
 * That is also why the Undo action inside one is a real button in the DOM — a
 * keyboard user has to be able to reach it by tabbing, and it must survive the
 * five seconds it is offered for.
 *
 * Positioned above the bottom nav so it never covers the tab bar on a phone.
 */
export function Toaster() {
  const toasts = useToasts((state) => state.toasts);

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-20 flex flex-col items-center gap-(--space-2) px-(--space-4) lg:bottom-(--space-5)"
      style={{ zIndex: "var(--z-toast)" }}
    >
      {toasts.map((toast) => (
        <ToastRow key={toast.id} toast={toast} />
      ))}
    </div>
  );
}

function ToastRow({ toast }: { toast: Toast }) {
  const t = useTranslations("common");
  const dismiss = useToasts((state) => state.dismiss);

  useEffect(() => {
    const timer = window.setTimeout(() => dismiss(toast.id), toast.durationMs);
    return () => window.clearTimeout(timer);
  }, [toast.id, toast.durationMs, dismiss]);

  return (
    <div
      className="pointer-events-auto flex w-full max-w-100 items-center gap-(--space-3) rounded-md border border-border bg-card px-(--space-4) py-(--space-2) text-body-sm"
      style={{ boxShadow: "var(--shadow-3)" }}
    >
      <span className="min-w-0 flex-1">{toast.message}</span>

      {toast.action ? (
        <button
          type="button"
          onClick={() => {
            toast.action?.onAction();
            dismiss(toast.id);
          }}
          className="min-h-11 shrink-0 rounded-md px-(--space-2) font-medium text-primary hover:bg-muted"
        >
          {toast.action.label}
        </button>
      ) : null}

      <button
        type="button"
        onClick={() => dismiss(toast.id)}
        aria-label={t("close")}
        className="inline-flex size-11 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
      >
        <X aria-hidden="true" style={{ width: "var(--icon-sm)", height: "var(--icon-sm)" }} />
      </button>
    </div>
  );
}
