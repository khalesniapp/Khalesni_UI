import type { z } from "zod";

/**
 * The one HTTP client — UI_Plan.md §11.4.
 *
 * Nothing outside lib/api/ calls `fetch`. This module owns: the base URL, the
 * timeout policy, the retry policy, X-Request-ID capture, and Zod parsing at
 * the boundary. Callers get typed data or an ApiError, never a raw Response.
 */

export const API_BASE = (
  process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000"
).replace(/\/$/, "");

/** §11.4: generate is slow and expensive; everything else should be quick. */
export const TIMEOUT_GENERATE_MS = 90_000;
export const TIMEOUT_DEFAULT_MS = 15_000;

/**
 * The UI branches on `status`, never on `detail` text (§11.4) — message copy
 * changes, status codes are the contract.
 *
 * `status: 0` means the request never reached the server (offline, DNS, CORS,
 * connection refused). §12.3 renders that as the offline card, not a 500.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly detail: string;
  readonly requestId: string | null;

  constructor(status: number, detail: string, requestId: string | null) {
    super(detail);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
    this.requestId = requestId;
  }

  /** True when the request never got a response — offline or the backend is down. */
  get isNetwork(): boolean {
    return this.status === 0;
  }

  get isTimeout(): boolean {
    return this.status === 504 || this.status === 408;
  }

  /** What "Copy details" puts on the clipboard (§12.3). */
  toDetails(): string {
    return [
      `status: ${this.status}`,
      `detail: ${this.detail}`,
      `request id: ${this.requestId ?? "none"}`,
      `time: ${new Date().toISOString()}`,
    ].join("\n");
  }
}

/* ---------------------------------------------------------------------------
   X-Request-ID ring buffer — §11.4.
   Every response carries one; it is the only way to find the matching backend
   log line, so error cards and Settings both read from here.
   ------------------------------------------------------------------------- */

const REQUEST_ID_BUFFER_SIZE = 10;
let requestIds: readonly string[] = [];

/**
 * Subscribers, so the UI can render the latest id without polling for it.
 * The array is replaced rather than mutated, which lets `useSyncExternalStore`
 * use it directly as the snapshot.
 */
const requestIdListeners = new Set<() => void>();

export function subscribeToRequestIds(listener: () => void): () => void {
  requestIdListeners.add(listener);
  return () => requestIdListeners.delete(listener);
}

function recordRequestId(id: string | null): void {
  if (!id) return;
  requestIds = [id, ...requestIds].slice(0, REQUEST_ID_BUFFER_SIZE);
  for (const listener of requestIdListeners) listener();
}

/** Newest first. A stable reference between writes, safe as a store snapshot. */
export function recentRequestIds(): readonly string[] {
  return requestIds;
}

export function latestRequestId(): string | null {
  return requestIds[0] ?? null;
}

/* ------------------------------------------------------------------------- */

type Method = "GET" | "POST" | "PATCH" | "DELETE";

interface RequestOptions<T> {
  path: string;
  method?: Method;
  body?: unknown;
  /** Response schema. Omit for 204s and other empty bodies. */
  schema?: z.ZodType<T>;
  timeoutMs?: number;
  /**
   * §11.4: GETs retry twice with backoff. The generate endpoints never retry
   * automatically — they cost time and money, so retry is a user action.
   */
  retries?: number;
  signal?: AbortSignal;
}

const RETRY_BASE_DELAY_MS = 400;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Retrying a 4xx just burns the same error; only transient failures are worth a second go. */
function isRetryable(error: ApiError): boolean {
  return error.isNetwork || error.status === 502 || error.status === 503 || error.status === 504;
}

async function extractDetail(response: Response): Promise<string> {
  try {
    const body: unknown = await response.json();
    if (body && typeof body === "object" && "detail" in body) {
      const { detail } = body as { detail: unknown };
      if (typeof detail === "string") return detail;
      // 422 hands back an array of validation objects.
      if (detail !== undefined) return JSON.stringify(detail);
    }
    return response.statusText || `HTTP ${response.status}`;
  } catch {
    return response.statusText || `HTTP ${response.status}`;
  }
}

async function attempt<T>(options: RequestOptions<T>): Promise<T> {
  const {
    path,
    method = "GET",
    body,
    schema,
    timeoutMs = TIMEOUT_DEFAULT_MS,
    signal,
  } = options;

  // Our own timeout, combined with any caller-supplied abort (Stop button).
  const timeoutController = new AbortController();
  const timer = setTimeout(() => timeoutController.abort("timeout"), timeoutMs);
  const combined = signal
    ? AbortSignal.any([signal, timeoutController.signal])
    : timeoutController.signal;

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: combined,
      cache: "no-store",
    });
  } catch (cause) {
    clearTimeout(timer);

    // A caller-driven abort (Stop) must stay an AbortError so callers can tell
    // it apart from a failure; only our own timeout becomes a 504.
    if (signal?.aborted) throw cause;
    if (timeoutController.signal.aborted) {
      throw new ApiError(504, "Request timed out", null);
    }
    throw new ApiError(0, cause instanceof Error ? cause.message : "Network error", null);
  }
  clearTimeout(timer);

  const requestId = response.headers.get("X-Request-ID");
  recordRequestId(requestId);

  if (!response.ok) {
    throw new ApiError(response.status, await extractDetail(response), requestId);
  }

  // 204 (delete plan) and any other empty body.
  if (response.status === 204 || !schema) {
    return undefined as T;
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new ApiError(response.status, "Malformed response body", requestId);
  }

  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    // §11.4: contract drift must be loud in dev, not a silent `undefined` in the UI.
    if (process.env.NODE_ENV !== "production") {
      console.error(`[api] ${method} ${path} failed schema validation`, parsed.error.issues);
    }
    throw new ApiError(response.status, "Unexpected response shape from the server", requestId);
  }

  return parsed.data;
}

export async function request<T>(options: RequestOptions<T>): Promise<T> {
  const method = options.method ?? "GET";
  const retries = options.retries ?? (method === "GET" ? 2 : 0);

  let lastError: ApiError | undefined;
  for (let i = 0; i <= retries; i += 1) {
    try {
      return await attempt(options);
    } catch (error) {
      if (!(error instanceof ApiError)) throw error; // an abort — propagate untouched
      if (i === retries || !isRetryable(error)) throw error;
      lastError = error;
      await sleep(RETRY_BASE_DELAY_MS * 2 ** i);
    }
  }

  throw lastError ?? new ApiError(0, "Request failed", null);
}
