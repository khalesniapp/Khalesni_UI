/**
 * A serial queue, keyed — UI_Plan.md §7.6, trap 2.
 *
 * All three item endpoints address items **by index**, and every one of them
 * returns the full updated document because those indices shift. Two PATCHes
 * in flight at once on the same plan therefore race on stale positions and can
 * tick or delete the wrong row.
 *
 * So every mutation for a given `plan_id` goes through one chain: one request
 * in flight, the next starting only when the previous has settled. Different
 * plans run in parallel — the hazard is per document, not global.
 *
 * A rejected task does not poison the chain: the next task runs regardless, so
 * one failed rename cannot wedge every later tick on that plan.
 */

interface Chain {
  /** Resolves when the last queued task has settled, whatever the outcome. */
  tail: Promise<unknown>;
  pending: number;
}

const chains = new Map<string, Chain>();

export function enqueue<T>(key: string, task: () => Promise<T>): Promise<T> {
  const chain: Chain = chains.get(key) ?? { tail: Promise.resolve(), pending: 0 };
  chain.pending += 1;
  chains.set(key, chain);

  // `.then(task, task)` rather than `.finally`: the next task must start after
  // either outcome, without inheriting the previous rejection.
  const run = chain.tail.then(task, task);

  // The stored tail swallows rejections so an unhandled one never escapes the
  // chain itself; the caller still receives the real rejection through `run`.
  chain.tail = run.catch(() => undefined);

  void chain.tail.then(() => {
    chain.pending -= 1;
    // Drop the chain once it is idle, so a long session does not keep one
    // settled promise per plan the user has ever touched.
    if (chain.pending === 0 && chains.get(key) === chain) chains.delete(key);
  });

  return run;
}

/** True while anything is queued for that key — used by tests and row spinners. */
export function isQueueBusy(key: string): boolean {
  return (chains.get(key)?.pending ?? 0) > 0;
}

/** Test seam: forget every chain. Never called by application code. */
export function resetQueues(): void {
  chains.clear();
}
