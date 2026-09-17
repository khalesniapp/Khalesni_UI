"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

import type { GeneratePlanResponse, HistoryTurn, Place, StreamStage } from "@/lib/api/types";
import { HISTORY_MAX_TURNS } from "@/lib/api/types";
import { middleTruncate } from "@/lib/utils/text";

/**
 * The transcript — UI_Plan.md §5.2, §11.2.
 *
 * Trap 5: the API is stateless. This store *is* the conversation; whatever is
 * not in here does not exist as far as the backend is concerned, because
 * `history` is rebuilt from it on every send. "the first one", "what about
 * sushi?" and "what's their number?" all work or break here.
 *
 * Persisted to `sessionStorage`: a reload keeps the conversation, closing the
 * tab ends it. That matches how people treat a chat they never named.
 *
 * The in-flight `AbortController` deliberately lives outside the store — it is
 * not serialisable, and one restored from storage would be a stale object that
 * aborts nothing.
 */

export type MessageId = string;

export interface UserMessage {
  id: MessageId;
  role: "user";
  content: string;
  /** The context actually sent with this turn, so we can show what it used. */
  mood: string | null;
  location: string | null;
  createdAt: string;
}

/** A completed assistant turn. The raw response is kept so the router can re-run on it. */
export interface ResponseMessage {
  id: MessageId;
  role: "assistant";
  kind: "response";
  response: GeneratePlanResponse;
  /**
   * The user message this answered. Retry re-sends *that* prompt, so every
   * assistant turn has to be able to name the one it came from.
   */
  promptMessageId: MessageId;
  createdAt: string;
}

/**
 * A turn that failed. It carries the id of the user message that produced it,
 * so Retry and "Edit message" (§12.3) know which prompt to act on.
 */
export interface ErrorMessage {
  id: MessageId;
  role: "assistant";
  kind: "error";
  status: number;
  detail: string;
  requestId: string | null;
  promptMessageId: MessageId;
  createdAt: string;
}

/**
 * The turn currently being generated. In Phase 1 it only records that
 * something is in flight; Phase 4 fills `stage`, `tokens` and `places` from the
 * SSE frames and renders them progressively (§5.5).
 */
export interface PendingMessage {
  id: MessageId;
  role: "assistant";
  kind: "pending";
  promptMessageId: MessageId;
  stage: StreamStage | string | null;
  stageDetail: string | null;
  tokens: string;
  places: Place[];
  /** Set when the user pressed Stop — the bubble stays, marked, with a Retry (§11.5). */
  stopped: boolean;
  /** Wall-clock start, for the 20 s and 45 s reassurances (§7.2.3). */
  startedAt: number;
  createdAt: string;
}

export type ThreadMessage = UserMessage | ResponseMessage | ErrorMessage | PendingMessage;

export function isPending(message: ThreadMessage): message is PendingMessage {
  return message.role === "assistant" && message.kind === "pending";
}

/* ---------------------------------------------------------------------------
   History — the part the backend actually sees.
   ------------------------------------------------------------------------- */

/**
 * What an assistant turn contributes to `history`.
 *
 * The backend only gets text, so a plan has to be flattened into something a
 * follow-up can refer to. Title plus description is what makes "make the second
 * one shorter" resolvable; the checklist itself would blow the 2000-char budget
 * for no gain.
 */
export function assistantHistoryContent(response: GeneratePlanResponse): string | null {
  if (response.type === "plan" && response.plan) {
    return `${response.plan.title}. ${response.plan.description}`.trim();
  }
  if (response.type === "realtime" && response.realtime) {
    return response.realtime.answer.trim();
  }
  if (response.type === "chat" && response.chat) {
    const { reply, places } = response.chat;
    if (places.length === 0) return reply.trim();
    // Naming the venues is what lets "what's their number?" resolve to one of
    // them next turn — the reply text alone often just says "three places".
    return `${reply.trim()} (${places.map((place) => place.name).join(", ")})`;
  }
  return null;
}

/**
 * §5.2: the last 10 turns, `{role, content}`, oldest first, current prompt
 * excluded. Errors and pending turns are not history — they were never said.
 *
 * Each `content` is middle-truncated to the backend's 2000-char limit, and
 * empty turns are dropped rather than sent as `""`, which the contract rejects
 * (`min(1)`).
 */
export function buildHistory(messages: readonly ThreadMessage[]): HistoryTurn[] {
  const turns: HistoryTurn[] = [];

  for (const message of messages) {
    if (message.role === "user") {
      const content = middleTruncate(message.content.trim());
      if (content) turns.push({ role: "user", content });
      continue;
    }
    if (message.kind !== "response") continue;

    const raw = assistantHistoryContent(message.response);
    if (!raw) continue;
    const content = middleTruncate(raw);
    if (content) turns.push({ role: "assistant", content });
  }

  return turns.slice(-HISTORY_MAX_TURNS);
}

/* ------------------------------------------------------------------------- */

interface ThreadState {
  messages: ThreadMessage[];
  /** Mirrors the presence of a pending message, kept as an explicit flag for the composer. */
  generating: boolean;
  /** Draft composer text, autosaved (§7.2.4). */
  draft: string;
  hydrated: boolean;

  appendUser: (message: UserMessage) => void;
  startPending: (message: PendingMessage) => void;
  updatePending: (
    id: MessageId,
    patch: Partial<Omit<PendingMessage, "id" | "kind" | "role">>,
  ) => void;
  /** Replaces the pending turn with its result — the chip is replaced, never stacked (§7.2.3). */
  resolvePending: (id: MessageId, message: ResponseMessage | ErrorMessage) => void;
  /** Drops a message entirely (used when a retry supersedes a failed turn). */
  dropMessage: (id: MessageId) => void;
  /** Rewrites a stored response after an item mutation returns a new document. */
  replaceResponse: (id: MessageId, response: GeneratePlanResponse) => void;
  setDraft: (draft: string) => void;
  /** §5.2: "New chat" clears the thread. Clearing the location sits with the caller. */
  clear: () => void;
  setHydrated: () => void;
}

export const useThread = create<ThreadState>()(
  persist(
    (set) => ({
      messages: [],
      generating: false,
      draft: "",
      hydrated: false,

      appendUser: (message) => set((state) => ({ messages: [...state.messages, message] })),

      startPending: (message) =>
        set((state) => ({ messages: [...state.messages, message], generating: true })),

      updatePending: (id, patch) =>
        set((state) => ({
          messages: state.messages.map((message) =>
            message.id === id && isPending(message) ? { ...message, ...patch } : message,
          ),
        })),

      resolvePending: (id, next) =>
        set((state) => ({
          messages: state.messages.map((message) => (message.id === id ? next : message)),
          generating: false,
        })),

      dropMessage: (id) =>
        set((state) => {
          const messages = state.messages.filter((message) => message.id !== id);
          return { messages, generating: messages.some(isPending) };
        }),

      replaceResponse: (id, response) =>
        set((state) => ({
          messages: state.messages.map((message) =>
            message.id === id && message.role === "assistant" && message.kind === "response"
              ? { ...message, response }
              : message,
          ),
        })),

      setDraft: (draft) => set({ draft }),

      clear: () => set({ messages: [], generating: false, draft: "" }),

      setHydrated: () => set({ hydrated: true }),
    }),
    {
      name: "khalesni.thread",
      storage: createJSONStorage(() => sessionStorage),
      // `generating` is never persisted: a reload kills the request, so a
      // restored `true` would leave a spinner running for a fetch that is gone.
      partialize: (state) => ({ messages: state.messages, draft: state.draft }),
      /**
       * A pending turn cannot survive a reload — its fetch died with the page.
       * Rehydration drops any that were mid-flight, so the thread never comes
       * back with a permanently spinning bubble.
       *
       * Set through the callback's `state` argument, not the store const: this
       * runs while `create()` is still evaluating (see lib/stores/identity.ts).
       */
      onRehydrateStorage: () => (state, error) => {
        if (error && process.env.NODE_ENV !== "production") {
          console.error("[thread] failed to rehydrate", error);
        }
        if (!state) return;
        state.messages = state.messages.filter((message) => !isPending(message));
        state.generating = false;
        state.setHydrated();
      },
    },
  ),
);
