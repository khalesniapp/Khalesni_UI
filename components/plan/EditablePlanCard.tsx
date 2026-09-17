"use client";

import type { MenuAction } from "@/components/ui/Menu";
import type { Plan } from "@/lib/api/normalise";
import type { PlanDocument } from "@/lib/api/types";
import { useItemMutations } from "@/lib/hooks/useItemMutations";
import { PlanCard } from "./PlanCard";

/**
 * `PlanCard` wired to the item endpoints.
 *
 * It exists as its own component purely so `useItemMutations` can be called
 * unconditionally: whether a plan is editable is a runtime fact, and a hook
 * cannot be called behind an `if`. Callers that have nowhere to put an updated
 * document (the library preview) render `PlanCard` directly instead.
 *
 * `onDocument` receives the full updated `PlanDocument` after every mutation —
 * trap 2's "replace, never splice" rule, handed to whoever owns the state.
 */
export function EditablePlanCard({
  plan,
  onDocument,
  onStale,
  actions,
  expanded,
  onRetrySave,
  retryingSave,
}: {
  plan: Plan;
  onDocument: (document: PlanDocument) => void;
  /** Called on a 404 so the owner can refetch (§12.3). */
  onStale?: () => void;
  actions?: readonly MenuAction[];
  expanded?: boolean;
  onRetrySave?: () => void;
  retryingSave?: boolean;
}) {
  const mutations = useItemMutations(plan, onDocument, onStale);

  return (
    <PlanCard
      // The view carries optimistic ticks and in-flight deletions; the raw
      // plan is only the last thing the server confirmed.
      plan={mutations.view}
      mutations={mutations}
      actions={actions}
      expanded={expanded}
      onRetrySave={onRetrySave}
      retryingSave={retryingSave}
    />
  );
}
