import { API_BASE, ApiError, TIMEOUT_GENERATE_MS } from "./client";
import { SseParser, frameJson } from "./sse";
import {
  generatePlanRequestSchema,
  generatePlanResponseSchema,
  placeSchema,
  streamErrorSchema,
  streamStatusSchema,
  type GeneratePlanRequest,
  type GeneratePlanResponse,
  type Place,
} from "./types";

/**
 * The streaming generate endpoint — UI_Plan.md §5.5, §11.5.
 *
 * `fetch` + `ReadableStream` rather than `EventSource`, because the endpoint is
 * a POST with a JSON body. Frames are parsed by `SseParser`, which owns the
 * carry-over buffer.
 *
 * Contract details that matter:
 *
 * - **`result` is authoritative.** Accumulated tokens are a preview; when the
 *   final response arrives the preview is discarded and the card renders from
 *   the parsed object.
 * - **Unknown events are ignored, not thrown.** The backend may add more.
 * - **A stream that ends with neither `result` nor `error` is a failure.** It
 *   means the connection died mid-generation, and silently showing an empty
 *   card would be the worst possible outcome.
 * - This module does not live inside `request()` because it never gets a JSON
 *   body to Zod-parse as a whole; it validates each frame's payload instead.
 */

export interface StreamHandlers {
  onStatus?: (stage: string, detail: string | null) => void;
  onToken?: (text: string) => void;
  onPlaces?: (places: Place[]) => void;
}

/**
 * Runs one streamed generation. Resolves with the final response, or throws an
 * `ApiError` — including for a caller-driven abort, which propagates as the
 * original `AbortError` so Stop can be told apart from a failure.
 */
export async function generatePlanStream(
  payload: GeneratePlanRequest,
  handlers: StreamHandlers,
  signal?: AbortSignal,
): Promise<GeneratePlanResponse> {
  const body = generatePlanRequestSchema.parse(payload);

  const timeoutController = new AbortController();
  const timer = setTimeout(() => timeoutController.abort("timeout"), TIMEOUT_GENERATE_MS);
  const combined = signal
    ? AbortSignal.any([signal, timeoutController.signal])
    : timeoutController.signal;

  let response: Response;
  try {
    response = await fetch(`${API_BASE}/api/generate-plan/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
      body: JSON.stringify(body),
      signal: combined,
      cache: "no-store",
    });
  } catch (cause) {
    clearTimeout(timer);
    if (signal?.aborted) throw cause;
    if (timeoutController.signal.aborted) throw new ApiError(504, "Request timed out", null);
    throw new ApiError(0, cause instanceof Error ? cause.message : "Network error", null);
  }

  const requestId = response.headers.get("X-Request-ID");

  if (!response.ok) {
    clearTimeout(timer);
    throw new ApiError(response.status, response.statusText || "Stream failed", requestId);
  }

  // §5.5: if this is not an event stream, the caller falls back to the
  // non-streaming endpoint. A proxy that buffers or rewrites the response is
  // the usual cause, and retrying the stream would just fail the same way.
  const contentType = response.headers.get("Content-Type") ?? "";
  if (!contentType.includes("text/event-stream") || !response.body) {
    clearTimeout(timer);
    throw new NotStreamingError(requestId);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const parser = new SseParser();

  let result: GeneratePlanResponse | null = null;
  let streamError: ApiError | null = null;

  try {
    for (;;) {
      const { done, value } = await reader.read();

      const frames = done
        ? parser.flush()
        : // `stream: true` keeps a multi-byte character split across chunks
          // intact — Arabic and the ellipsis in the stage copy are both
          // multi-byte, so this is not hypothetical.
          parser.push(decoder.decode(value, { stream: true }));

      for (const frame of frames) {
        const payloadJson = frameJson(frame);
        if (payloadJson === null) continue;

        switch (frame.event) {
          case "status": {
            const parsed = streamStatusSchema.safeParse(payloadJson);
            if (parsed.success) {
              handlers.onStatus?.(parsed.data.stage, parsed.data.detail ?? null);
            }
            break;
          }

          case "token": {
            const text = readToken(payloadJson);
            if (text) handlers.onToken?.(text);
            break;
          }

          case "places": {
            const places = readPlaces(payloadJson);
            // The biggest perceived-speed win in the app: venues on screen
            // before the plan that mentions them exists (§5.5).
            if (places.length > 0) handlers.onPlaces?.(places);
            break;
          }

          case "result": {
            const parsed = generatePlanResponseSchema.safeParse(payloadJson);
            if (parsed.success) {
              result = parsed.data;
            } else {
              if (process.env.NODE_ENV !== "production") {
                console.error("[stream] result failed schema validation", parsed.error.issues);
              }
              streamError = new ApiError(
                200,
                "Unexpected response shape from the server",
                requestId,
              );
            }
            break;
          }

          case "error": {
            const parsed = streamErrorSchema.safeParse(payloadJson);
            streamError = new ApiError(
              502,
              parsed.success ? parsed.data.detail : "Generation failed",
              (parsed.success ? parsed.data.request_id : null) ?? requestId,
            );
            break;
          }

          default:
            // Unknown event name — ignored on purpose (§11.5).
            break;
        }
      }

      if (done) break;
    }
  } catch (cause) {
    if (signal?.aborted) throw cause;
    if (timeoutController.signal.aborted) throw new ApiError(504, "Request timed out", requestId);
    throw new ApiError(
      0,
      cause instanceof Error ? cause.message : "Stream interrupted",
      requestId,
    );
  } finally {
    clearTimeout(timer);
    reader.releaseLock();
  }

  if (streamError) throw streamError;
  if (result) return result;

  // Ended with neither. Treat it as the failure it is.
  throw new ApiError(0, "The stream ended without a result", requestId);
}

/**
 * Thrown when the endpoint answered with something other than an event stream.
 * The caller's response is to retry once against `POST /api/generate-plan`
 * (§5.5), which is a different action from showing an error.
 */
export class NotStreamingError extends Error {
  readonly requestId: string | null;

  constructor(requestId: string | null) {
    super("Response was not an event stream");
    this.name = "NotStreamingError";
    this.requestId = requestId;
  }
}

/** `{text}` is the documented shape; a bare string is tolerated. */
function readToken(payload: unknown): string | null {
  if (typeof payload === "string") return payload;
  if (payload && typeof payload === "object" && "text" in payload) {
    const { text } = payload as { text: unknown };
    if (typeof text === "string") return text;
  }
  return null;
}

/** `{places: [...]}` is the documented shape; a bare array is tolerated. */
function readPlaces(payload: unknown): Place[] {
  const raw = Array.isArray(payload)
    ? payload
    : payload && typeof payload === "object" && "places" in payload
      ? (payload as { places: unknown }).places
      : null;

  if (!Array.isArray(raw)) return [];

  // Parsed per item: one malformed place should not discard the rest of a
  // progressive batch that is otherwise fine.
  return raw
    .map((item) => placeSchema.safeParse(item))
    .filter((parsed) => parsed.success)
    .map((parsed) => parsed.data);
}
