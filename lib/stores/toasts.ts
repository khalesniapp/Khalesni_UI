"use client";

import { create } from "zustand";

/**
 * Toasts — UI_Plan.md §12.3.
 *
 * Strictly for confirmations and Undo. Errors live inline where the work was,
 * because a toast that scrolls away takes the only explanation with it.
 *
 * Not persisted and deliberately tiny: a toast that survives a reload is a bug,
 * since whatever it was confirming already happened.
 */

export interface Toast {
  id: string;
  message: string;
  /** Undo and friends. One action per toast — a toast is not a dialog. */
  action?: { label: string; onAction: () => void };
  /** §12.3 allows 3–5 s; Undo takes the full 5. */
  durationMs: number;
}

export const TOAST_DEFAULT_MS = 3500;
export const TOAST_UNDO_MS = 5000;

interface ToastState {
  toasts: Toast[];
  show: (toast: Omit<Toast, "id" | "durationMs"> & { durationMs?: number }) => string;
  dismiss: (id: string) => void;
}

let counter = 0;

export const useToasts = create<ToastState>()((set) => ({
  toasts: [],

  show: ({ message, action, durationMs = TOAST_DEFAULT_MS }) => {
    counter += 1;
    const id = `toast-${counter}`;
    set((state) => ({ toasts: [...state.toasts, { id, message, action, durationMs }] }));
    return id;
  },

  dismiss: (id) =>
    set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })),
}));
