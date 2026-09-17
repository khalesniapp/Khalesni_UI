"use client";

import { useCallback, useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import { ApiError } from "@/lib/api/client";
import { addItem, patchItem, removeItem } from "@/lib/api/items";
import type { Plan } from "@/lib/api/normalise";
import { isEditable } from "@/lib/api/normalise";
import type { ItemType, PlanDocument } from "@/lib/api/types";
import { useIdentity } from "@/lib/stores/identity";
import { TOAST_UNDO_MS, useToasts } from "@/lib/stores/toasts";

/**
 * Checklist editing — UI_Plan.md §7.6, §11.7, trap 2.
 *
 * The four rules this hook exists to enforce:
 *
 * 1. Local state is always replaced from the returned `PlanDocument`. The hook
 *    never splices an array — `onDocument` hands the whole document to whoever
 *    owns the state (the query cache, or the thread message).
 * 2. Requests are serialised per plan inside `lib/api/items.ts`, so rapid ticks
 *    cannot race on indices that shift under them.
 * 3. Optimism is allowed for `completed` only. A tick has to feel instant;
 *    rename, add and delete get a row spinner and the truth from the server.
 * 4. A 404 means the plan changed underneath us. Refetch and say so, rather
 *    than showing an error for something that has already been fixed.
 */

/** `${itemType}:${index}` — items have no ids, only positions. */
type ItemKey = string;

function keyFor(itemType: ItemType, index: number): ItemKey {
  return `${itemType}:${index}`;
}

export interface ItemMutations {
  toggle: (itemType: ItemType, index: number, completed: boolean) => void;
  rename: (itemType: ItemType, index: number, name: string) => void;
  add: (itemType: ItemType, name: string, estimatedTime?: string) => Promise<void>;
  remove: (itemType: ItemType, index: number, name: string) => void;
  /** Rows with a request in flight: spinner, dimmed, not interactive (§12.1). */
  busy: Partial<Record<ItemType, ReadonlySet<number>>>;
  /** The plan with optimistic ticks and pending deletions applied, ready to render. */
  view: Plan;
  /** True while nothing can be edited — no id, or the write failed (trap 3). */
  readOnly: boolean;
}

export function useItemMutations(
  plan: Plan,
  onDocument: (document: PlanDocument) => void,
  onStale?: () => void,
): ItemMutations {
  const t = useTranslations("plan");
  const tUndo = useTranslations("undo");
  const userId = useIdentity((state) => state.userId);
  const showToast = useToasts((state) => state.show);

  const [busyKeys, setBusyKeys] = useState<ReadonlySet<ItemKey>>(() => new Set());
  const [ticks, setTicks] = useState<ReadonlyMap<ItemKey, boolean>>(() => new Map());
  const [hidden, setHidden] = useState<ReadonlySet<ItemKey>>(() => new Set());

  const planId = plan.id;
  const readOnly = !isEditable(plan) || !userId;

  const markBusy = useCallback((key: ItemKey, busy: boolean) => {
    setBusyKeys((current) => {
      const next = new Set(current);
      if (busy) next.add(key);
      else next.delete(key);
      return next;
    });
  }, []);

  /**
   * Every mutation funnels through here so the document handling, the 404 case
   * and the failure toast are written once.
   */
  const run = useCallback(
    async (key: ItemKey, task: () => Promise<PlanDocument>) => {
      markBusy(key, true);
      try {
        const document = await task();
        onDocument(document);
        // The server's document is now the truth, so any local overlay for it
        // is stale by definition.
        setTicks(() => new Map());
        setHidden(() => new Set());
        return true;
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
          // §12.3: the plan changed concurrently. Refetch and say so in a
          // toast — this is information, not a failure the user caused.
          showToast({ message: t("changed") });
          onStale?.();
          return false;
        }
        showToast({ message: t("saveFailed") });
        return false;
      } finally {
        markBusy(key, false);
      }
    },
    [markBusy, onDocument, onStale, showToast, t],
  );

  const toggle = useCallback(
    (itemType: ItemType, index: number, completed: boolean) => {
      const key = keyFor(itemType, index);

      // Trap 3: no id means no document to PATCH. The tick still happens — it
      // is just local, and PlanCard's amber notice already says so.
      if (readOnly || !planId || !userId) {
        setTicks((current) => new Map(current).set(key, completed));
        return;
      }

      // §11.7: optimistic, because an instant tick is the whole point.
      setTicks((current) => new Map(current).set(key, completed));

      void run(key, () =>
        patchItem(planId, { user_id: userId, item_type: itemType, index, completed }),
      ).then((ok) => {
        if (ok) return;
        // Roll the tick back; the toast has already explained why.
        setTicks((current) => {
          const next = new Map(current);
          next.delete(key);
          return next;
        });
      });
    },
    [planId, readOnly, run, userId],
  );

  const rename = useCallback(
    (itemType: ItemType, index: number, name: string) => {
      const trimmed = name.trim();
      if (!trimmed || readOnly || !planId || !userId) return;

      // §11.7: no optimism. The server returns the canonical document and a row
      // spinner is honest about the wait.
      void run(keyFor(itemType, index), () =>
        patchItem(planId, { user_id: userId, item_type: itemType, index, name: trimmed }),
      );
    },
    [planId, readOnly, run, userId],
  );

  const add = useCallback(
    async (itemType: ItemType, name: string, estimatedTime?: string) => {
      const trimmed = name.trim();
      if (!trimmed || readOnly || !planId || !userId) return;

      // Position is the server's decision (it appends), so there is nothing
      // sensible to render optimistically.
      await run(`${itemType}:add`, () =>
        addItem(planId, {
          user_id: userId,
          item_type: itemType,
          name: trimmed,
          ...(estimatedTime?.trim() ? { estimated_time: estimatedTime.trim() } : {}),
        }),
      );
    },
    [planId, readOnly, run, userId],
  );

  const remove = useCallback(
    (itemType: ItemType, index: number, name: string) => {
      if (readOnly || !planId || !userId) return;
      const key = keyFor(itemType, index);

      // Optimistic, but by hiding the row rather than splicing the array:
      // splicing would renumber every item after it locally, which is exactly
      // the disagreement with the server that trap 2 warns about.
      setHidden((current) => new Set(current).add(key));

      void run(key, () => removeItem(planId, userId, itemType, index)).then((ok) => {
        if (!ok) {
          setHidden((current) => {
            const next = new Set(current);
            next.delete(key);
            return next;
          });
          return;
        }

        // §7.6: Undo re-adds through POST, which appends. Say so — silently
        // moving someone's item to the bottom of the list is worse than the
        // deletion was.
        showToast({
          message: t("itemDeleted"),
          durationMs: TOAST_UNDO_MS,
          action: {
            label: tUndo("label"),
            onAction: () => {
              void add(itemType, name).then(() => {
                showToast({ message: tUndo("restoredAtEnd") });
              });
            },
          },
        });
      });
    },
    [add, planId, readOnly, run, showToast, t, tUndo, userId],
  );

  /** The plan as it should appear right now: server truth plus the local overlay. */
  const view = useMemo<Plan>(() => {
    if (ticks.size === 0 && hidden.size === 0) return plan;

    /**
     * Rows keep the index they hold in the *server* document — see
     * `ChecklistItem.index`. Dropping a deleted row from the rendered array
     * would otherwise renumber everything below it, and the next tick would
     * PATCH the wrong position (trap 2, reintroduced one layer up).
     */
    function project<T extends { completed: boolean }>(
      items: readonly T[],
      itemType: ItemType,
    ): T[] {
      return items
        .map((item, index) => ({ item, key: keyFor(itemType, index) }))
        .filter(({ key }) => !hidden.has(key))
        .map(({ item, key }) => {
          const tick = ticks.get(key);
          return tick === undefined ? item : { ...item, completed: tick };
        });
    }

    return {
      ...plan,
      tasks: project(plan.tasks, "tasks"),
      outing_readiness: project(plan.outing_readiness, "outing_readiness"),
    };
  }, [plan, ticks, hidden]);

  const busy = useMemo(() => {
    const tasks = new Set<number>();
    const readiness = new Set<number>();

    for (const key of busyKeys) {
      const [itemType, rawIndex] = key.split(":");
      const index = Number(rawIndex);
      if (Number.isNaN(index)) continue;
      if (itemType === "tasks") tasks.add(index);
      if (itemType === "outing_readiness") readiness.add(index);
    }

    return { tasks, outing_readiness: readiness };
  }, [busyKeys]);

  return { toggle, rename, add, remove, busy, view, readOnly };
}
