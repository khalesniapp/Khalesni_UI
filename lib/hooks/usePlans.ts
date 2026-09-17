"use client";

import { useCallback, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { ApiError } from "@/lib/api/client";
import { deletePlan, getPlan, listPlans, PLANS_MAX, PLANS_PAGE_SIZE } from "@/lib/api/plans";
import type { PlanDocument } from "@/lib/api/types";
import { useIdentity } from "@/lib/stores/identity";
import { queryKeys } from "./queryKeys";

/**
 * Saved plans — UI_Plan.md §7.6, §11.3.
 *
 * The list endpoint takes a `limit`, not a cursor, so "load more" raises the
 * limit and refetches. That is the API we have; the ceiling is the backend's
 * own 100, past which the library says so rather than pretending there is more
 * to scroll.
 */

export function usePlansList() {
  const userId = useIdentity((state) => state.userId);
  const hydrated = useIdentity((state) => state.hydrated);
  const [limit, setLimit] = useState(PLANS_PAGE_SIZE);

  const query = useQuery({
    queryKey: queryKeys.plans(userId ?? "", limit),
    queryFn: ({ signal }) => listPlans(userId as string, limit, signal),
    // No handle yet means no request to make — not an error state.
    enabled: hydrated && Boolean(userId),
  });

  const plans = query.data ?? [];
  // A short page is the last page. At the ceiling we stop asking regardless.
  const atCeiling = limit >= PLANS_MAX;
  const canLoadMore = !atCeiling && plans.length >= limit;

  return {
    plans,
    loading: query.isPending && Boolean(userId),
    error: query.error instanceof ApiError ? query.error : null,
    refetch: () => void query.refetch(),
    canLoadMore,
    atCeiling: atCeiling && plans.length >= PLANS_MAX,
    loadMore: () => setLimit((current) => Math.min(current + PLANS_PAGE_SIZE, PLANS_MAX)),
  };
}

export function usePlanDetail(planId: string) {
  const userId = useIdentity((state) => state.userId);
  const hydrated = useIdentity((state) => state.hydrated);
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: queryKeys.plan(userId ?? "", planId),
    queryFn: ({ signal }) => getPlan(userId as string, planId, signal),
    enabled: hydrated && Boolean(userId),
  });

  /**
   * §11.3: an item mutation returns the full document — write it straight into
   * the cache, and invalidate the list because its progress counts changed.
   */
  const applyDocument = useCallback(
    (document: PlanDocument) => {
      if (!userId) return;
      queryClient.setQueryData(queryKeys.plan(userId, planId), document);
      void queryClient.invalidateQueries({ queryKey: queryKeys.plansAll(userId) });
    },
    [queryClient, planId, userId],
  );

  return {
    plan: query.data ?? null,
    loading: query.isPending && Boolean(userId),
    error: query.error instanceof ApiError ? query.error : null,
    refetch: () => void query.refetch(),
    applyDocument,
    /** True once the identity is known and the plan genuinely is not there. */
    notFound: query.error instanceof ApiError && query.error.status === 404,
  };
}

export function useDeletePlan() {
  const userId = useIdentity((state) => state.userId);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (planId: string) => deletePlan(userId as string, planId),
    onSuccess: (_result, planId) => {
      if (!userId) return;
      // §11.3: the detail cache is now a 404 waiting to happen — drop it.
      queryClient.removeQueries({ queryKey: queryKeys.plan(userId, planId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.plansAll(userId) });
    },
  });
}
