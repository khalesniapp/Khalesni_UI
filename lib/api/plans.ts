import { request, TIMEOUT_GENERATE_MS } from "./client";
import {
  generatePlanResponseSchema,
  generatePlanRequestSchema,
  planDocumentListSchema,
  planDocumentSchema,
  type GeneratePlanRequest,
  type GeneratePlanResponse,
  type PlanDocument,
} from "./types";

/**
 * Plan endpoints — UI_Plan.md §6.1.
 *
 * The request is validated on the way out as well as the way in: §6.2's limits
 * are the backend's, and a 422 is a much worse way to learn we exceeded one
 * than a throw at the call site with the offending field named.
 */

export const PLANS_PAGE_SIZE = 20;
/** The backend's own ceiling — past this the library says "your 100 most recent" (§7.6). */
export const PLANS_MAX = 100;

/**
 * `POST /api/generate-plan`.
 *
 * Never retried automatically (§11.4) — `request` defaults non-GET to zero
 * retries, and this is the endpoint that rule exists for.
 */
export function generatePlan(
  payload: GeneratePlanRequest,
  signal?: AbortSignal,
): Promise<GeneratePlanResponse> {
  const body = generatePlanRequestSchema.parse(payload);

  return request({
    path: "/api/generate-plan",
    method: "POST",
    body,
    schema: generatePlanResponseSchema,
    timeoutMs: TIMEOUT_GENERATE_MS,
    signal,
  });
}

/** `GET /api/plans/{user_id}?limit=` — newest first. */
export function listPlans(
  userId: string,
  limit: number = PLANS_PAGE_SIZE,
  signal?: AbortSignal,
): Promise<PlanDocument[]> {
  const capped = Math.min(Math.max(1, limit), PLANS_MAX);

  return request({
    path: `/api/plans/${encodeURIComponent(userId)}?limit=${capped}`,
    schema: planDocumentListSchema,
    signal,
  });
}

/** `GET /api/plans/{user_id}/{plan_id}`. 404 → "That plan is gone." (§12.3) */
export function getPlan(
  userId: string,
  planId: string,
  signal?: AbortSignal,
): Promise<PlanDocument> {
  return request({
    path: `/api/plans/${encodeURIComponent(userId)}/${encodeURIComponent(planId)}`,
    schema: planDocumentSchema,
    signal,
  });
}

/**
 * `DELETE /api/plans/{user_id}/{plan_id}` → 204.
 *
 * Not undoable, which is why §7.6 spends a confirmation dialog on it rather
 * than an Undo toast.
 */
export function deletePlan(userId: string, planId: string, signal?: AbortSignal): Promise<void> {
  return request({
    path: `/api/plans/${encodeURIComponent(userId)}/${encodeURIComponent(planId)}`,
    method: "DELETE",
    signal,
  });
}
