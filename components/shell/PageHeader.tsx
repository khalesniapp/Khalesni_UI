import type { ReactNode } from "react";

/**
 * Shared screen heading. Every route gets exactly one `<h1>` (§13) — the
 * screen title — so the heading order stays legible to a screen reader.
 */
export function PageHeader({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <header className="flex flex-col gap-(--space-2) pt-(--space-5) pb-(--space-4)">
      <h1 className="text-h1">{title}</h1>
      {children}
    </header>
  );
}

/**
 * Temporary body for routes whose real content lands in a later phase. Phase 0
 * only has to prove that every route renders inside the shell.
 */
export function PhasePlaceholder({ note, phase }: { note: string; phase: string }) {
  return (
    <div
      className="rounded-lg border border-border bg-card p-(--space-5) text-body-sm text-muted-foreground"
      style={{ boxShadow: "var(--shadow-1)" }}
    >
      <p>{phase}</p>
      <p className="mt-(--space-2)">{note}</p>
    </div>
  );
}
