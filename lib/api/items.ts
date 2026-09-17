import { request } from "./client";
import { enqueue } from "./queue";
import {
  addItemRequestSchema,
  patchItemRequestSchema,
  planDocumentSchema,
  type AddItemRequest,
  type ItemType,
  type PatchItemRequest,
  type PlanDocument,
} from "./types";

/**
 * Checklist item mutations — UI_Plan.md §7.6, traps 2 and 3.
 *
 * Every function here returns the **full updated `PlanDocument`**, and that
 * document is the truth. Callers write it into state wholesale; nothing splices
 * a local array, because a delete shifts every index after it and a local
 * splice would silently disagree with the server about what row 4 is.
 *
 * Every call is serialised per `plan_id` through the queue. That is not
 * defensive — two concurrent PATCHes on shifting indices genuinely corrupt the
 * plan, and ticking two boxes quickly is an ordinary thing to do.
 *
 * Trap 3: a plan with `plan_id: null` or `persisted: false` never reaches these
 * functions. There is nothing to PATCH, so the caller keeps ticks local and
 * shows the notice instead.
 */

/** `PATCH /api/plans/{plan_id}/items` — toggle `completed`, rename, or retime. */
export function patchItem(
  planId: string,
  payload: PatchItemRequest,
  signal?: AbortSignal,
): Promise<PlanDocument> {
  const body = patchItemRequestSchema.parse(payload);

  return enqueue(planId, () =>
    request({
      path: `/api/plans/${encodeURIComponent(planId)}/items`,
      method: "PATCH",
      body,
      schema: planDocumentSchema,
      signal,
    }),
  );
}

/** `POST /api/plans/{plan_id}/items` — appends; the server decides the position. */
export function addItem(
  planId: string,
  payload: AddItemRequest,
  signal?: AbortSignal,
): Promise<PlanDocument> {
  const body = addItemRequestSchema.parse(payload);

  return enqueue(planId, () =>
    request({
      path: `/api/plans/${encodeURIComponent(planId)}/items`,
      method: "POST",
      body,
      schema: planDocumentSchema,
      signal,
    }),
  );
}

/** `DELETE /api/plans/{plan_id}/items/{item_type}/{index}?user_id=`. */
export function removeItem(
  planId: string,
  userId: string,
  itemType: ItemType,
  index: number,
  signal?: AbortSignal,
): Promise<PlanDocument> {
  const query = new URLSearchParams({ user_id: userId });

  return enqueue(planId, () =>
    request({
      path: `/api/plans/${encodeURIComponent(planId)}/items/${itemType}/${index}?${query}`,
      method: "DELETE",
      // The delete endpoint answers with the updated document, not a 204 — it
      // is the plans endpoint that returns 204, and confusing the two is an
      // easy way to throw away the state we need.
      schema: planDocumentSchema,
      signal,
    }),
  );
}
