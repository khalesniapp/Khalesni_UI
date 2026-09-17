import { z } from "zod";

import { request } from "./client";
import { placeSchema, type Place } from "./types";

/**
 * Place search — UI_Plan.md §6.1, trap 6.
 *
 * `GET /api/places` normally answers **503**: `MAP_SEARCH_ENABLED` is off by
 * default because the public Overpass endpoint is overloaded. That is not a
 * bug and not a UI failure.
 *
 * So nothing calls this without first checking `capabilities.canSearchPlaces`
 * from `/health`. Gating on the capability rather than on a failed click is the
 * whole point of §6.5: the user should never discover a switched-off feature by
 * pressing a button that errors.
 */

const placeListSchema = z.array(placeSchema);

export function searchPlaces(
  near: string,
  category: string,
  signal?: AbortSignal,
): Promise<Place[]> {
  const query = new URLSearchParams({ near, category });

  return request({
    path: `/api/places?${query}`,
    schema: placeListSchema,
    signal,
  });
}
