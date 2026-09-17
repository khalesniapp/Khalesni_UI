/**
 * Query keys and the invalidation rules that go with them — UI_Plan.md §11.3.
 *
 * Kept in one file so the invalidation comments below stay next to the keys
 * they talk about:
 *
 *   after a successful generate with a plan_id → invalidate plans(userId)
 *   after any item mutation → setQueryData(plan(u, id), returned PlanDocument)
 *                             + invalidate plans(u)   (progress counts change)
 *   after deleting a plan   → removeQueries(plan(u, id)) + invalidate plans(u)
 *
 * Trap 2: an item mutation returns the full updated document — write that
 * straight into the cache. Never splice the local array.
 */
export const queryKeys = {
  health: ["health"] as const,
  plans: (userId: string, limit: number) => ["plans", userId, limit] as const,
  /** Prefix match for invalidating every page size at once. */
  plansAll: (userId: string) => ["plans", userId] as const,
  plan: (userId: string, planId: string) => ["plan", userId, planId] as const,
} as const;
