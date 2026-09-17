"use client";

import { useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { ApiError } from "@/lib/api/client";
import { generatePlan } from "@/lib/api/plans";
import { generatePlanStream, NotStreamingError } from "@/lib/api/stream";
import { STREAMING_ENABLED } from "@/lib/env";
import type { GeneratePlanRequest, GeneratePlanResponse } from "@/lib/api/types";
import { useIdentity } from "@/lib/stores/identity";
import { usePrefs } from "@/lib/stores/prefs";
import { buildHistory, isPending, useThread, type MessageId } from "@/lib/stores/thread";
import { DEFAULT_MOOD } from "@/components/chat/moods";
import { queryKeys } from "./queryKeys";

/**
 * Sending a turn — UI_Plan.md §5.2, §11.4.
 *
 * Everything that makes a turn a *conversation* rather than an isolated request
 * happens here: the transcript is read to build `history` (trap 5), the
 * remembered mood and location are attached (§5.3), and whatever the backend
 * says it actually used comes back into the prefs store so we stop asking.
 *
 * There is no automatic retry. Generate is the expensive endpoint and §11.4
 * makes retry a user action; the error card in the thread is how they take it.
 */

export interface SendOptions {
  /** §5.4: "Not now" resends the same prompt with `ask_location: false`. */
  askLocation?: boolean;
  /** Overrides the remembered location for this turn only (the handshake). */
  location?: string | null;
  /**
   * Re-sending an existing user message rather than adding a new one — Retry.
   * The failed assistant turn is dropped and a fresh one takes its place.
   */
  resendMessageId?: MessageId;
}

function newId(): MessageId {
  // `randomUUID` needs a secure context; localhost qualifies, but a LAN IP over
  // http does not, and these ids only have to be unique within one tab.
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function useGeneratePlan() {
  const queryClient = useQueryClient();
  const userId = useIdentity((state) => state.userId);
  const mood = usePrefs((state) => state.mood);
  const rememberedLocation = usePrefs((state) => state.location);
  const setLocation = usePrefs((state) => state.setLocation);

  const abortRef = useRef<AbortController | null>(null);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  const send = useCallback(
    async (rawPrompt: string, options: SendOptions = {}) => {
      const prompt = rawPrompt.trim();
      if (!prompt || !userId) return;

      const store = useThread.getState();

      // History is built from the transcript *before* this turn is added —
      // §5.2 excludes the current prompt.
      const history = buildHistory(store.messages);

      const promptMessageId = options.resendMessageId ?? newId();
      const turnLocation =
        options.location !== undefined ? options.location : rememberedLocation;

      if (!options.resendMessageId) {
        store.appendUser({
          id: promptMessageId,
          role: "user",
          content: prompt,
          mood: mood ?? null,
          location: turnLocation,
          createdAt: new Date().toISOString(),
        });
      }

      const pendingId = newId();
      useThread.getState().startPending({
        id: pendingId,
        role: "assistant",
        kind: "pending",
        promptMessageId,
        stage: null,
        stageDetail: null,
        tokens: "",
        places: [],
        stopped: false,
        startedAt: Date.now(),
        createdAt: new Date().toISOString(),
      });

      const controller = new AbortController();
      abortRef.current = controller;

      const payload: GeneratePlanRequest = {
        user_id: userId,
        prompt,
        // `neutral` is the absence of a mood — sending it would colour the plan
        // for no reason (§7.2.4).
        ...(mood && mood !== DEFAULT_MOOD ? { mood } : {}),
        ...(turnLocation ? { location: turnLocation } : {}),
        ...(options.askLocation === false ? { ask_location: false } : {}),
        ...(history.length > 0 ? { history } : {}),
      };

      try {
        let response: GeneratePlanResponse;

        if (STREAMING_ENABLED) {
          try {
            response = await generatePlanStream(
              payload,
              {
                // §5.5: `detail` is already human ("looking for places near
                // Hamra"), so it is shown verbatim rather than re-worded.
                onStatus: (stage, detail) =>
                  useThread.getState().updatePending(pendingId, {
                    stage,
                    stageDetail: detail,
                  }),
                onToken: (text) => {
                  const current = useThread.getState().messages.find(
                    (message) => message.id === pendingId,
                  );
                  if (current && isPending(current)) {
                    useThread
                      .getState()
                      .updatePending(pendingId, { tokens: current.tokens + text });
                  }
                },
                // Rendered before the final result — the biggest perceived
                // speed win in the app.
                onPlaces: (places) =>
                  useThread.getState().updatePending(pendingId, { places }),
              },
              controller.signal,
            );
          } catch (streamFailure) {
            // §5.5: not an event stream → retry once, non-streaming. Any other
            // failure is a real failure and must not be silently re-run: these
            // calls cost time and money (§11.4).
            if (!(streamFailure instanceof NotStreamingError)) throw streamFailure;
            response = await generatePlan(payload, controller.signal);
          }
        } else {
          response = await generatePlan(payload, controller.signal);
        }

        useThread.getState().resolvePending(pendingId, {
          id: pendingId,
          role: "assistant",
          kind: "response",
          response,
          promptMessageId,
          createdAt: new Date().toISOString(),
        });

        // §5.3: the cleaned location comes back in the response — store it and
        // stop asking. The backend turns "Beirut is fine, I want Chinese" into
        // "Beirut", and that cleaned form is what we want to remember.
        if (response.location) setLocation(response.location);

        // §11.3: a saved plan changes the library.
        if (response.plan_id) {
          void queryClient.invalidateQueries({ queryKey: queryKeys.plansAll(userId) });
        }
      } catch (error) {
        // A user-initiated Stop is not a failure. The pending turn is marked
        // rather than replaced with an error card (§11.5).
        if (controller.signal.aborted) {
          useThread.getState().updatePending(pendingId, { stopped: true });
          useThread.setState({ generating: false });
          return;
        }

        const apiError =
          error instanceof ApiError
            ? error
            : new ApiError(0, error instanceof Error ? error.message : "Request failed", null);

        useThread.getState().resolvePending(pendingId, {
          id: pendingId,
          role: "assistant",
          kind: "error",
          status: apiError.status,
          detail: apiError.detail,
          requestId: apiError.requestId,
          promptMessageId,
          createdAt: new Date().toISOString(),
        });
      } finally {
        if (abortRef.current === controller) abortRef.current = null;
      }
    },
    [userId, mood, rememberedLocation, setLocation, queryClient],
  );

  return { send, stop };
}
