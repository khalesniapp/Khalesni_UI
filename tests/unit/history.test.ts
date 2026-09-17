import { describe, expect, it } from "vitest";

import { HISTORY_CONTENT_MAX, HISTORY_MAX_TURNS } from "@/lib/api/types";
import type { GeneratePlanResponse } from "@/lib/api/types";
import {
  assistantHistoryContent,
  buildHistory,
  type ThreadMessage,
} from "@/lib/stores/thread";

/**
 * Trap 5 — UI_Plan.md §5.2.
 *
 * "The API is stateless. The frontend owns the transcript and must send
 * `history`. Skip it and 'the first one' / 'what about sushi?' / 'what's their
 * number?' all break."
 *
 * These tests pin the four properties the backend depends on: oldest first, the
 * current prompt excluded, at most ten turns, and never an empty `content`
 * (the contract requires `min(1)`).
 */

let counter = 0;

function user(content: string): ThreadMessage {
  counter += 1;
  return {
    id: `u${counter}`,
    role: "user",
    content,
    mood: null,
    location: null,
    createdAt: new Date().toISOString(),
  };
}

function response(partial: Partial<GeneratePlanResponse>): GeneratePlanResponse {
  return {
    type: "chat",
    plan_type: "chat",
    plan_id: null,
    persisted: false,
    created_at: new Date().toISOString(),
    plan: null,
    realtime: null,
    chat: null,
    location: null,
    ...partial,
  };
}

function assistant(partial: Partial<GeneratePlanResponse>): ThreadMessage {
  counter += 1;
  return {
    id: `a${counter}`,
    role: "assistant",
    kind: "response",
    response: response(partial),
    promptMessageId: `u${counter - 1}`,
    createdAt: new Date().toISOString(),
  };
}

const chat = (reply: string) =>
  assistant({ chat: { reply, needs: null, places: [] } });

describe("buildHistory", () => {
  it("returns turns oldest first", () => {
    const history = buildHistory([user("hey"), chat("hi"), user("plan my day")]);

    expect(history).toEqual([
      { role: "user", content: "hey" },
      { role: "assistant", content: "hi" },
      { role: "user", content: "plan my day" },
    ]);
  });

  it("keeps only the last ten turns", () => {
    const messages: ThreadMessage[] = [];
    for (let i = 0; i < 12; i += 1) {
      messages.push(user(`question ${i}`), chat(`answer ${i}`));
    }

    const history = buildHistory(messages);

    expect(history).toHaveLength(HISTORY_MAX_TURNS);
    // The tail is what matters: a follow-up refers to what was just said.
    expect(history.at(-1)).toEqual({ role: "assistant", content: "answer 11" });
  });

  it("omits failed turns — they were never said", () => {
    const history = buildHistory([
      user("plan my day"),
      {
        id: "e1",
        role: "assistant",
        kind: "error",
        status: 502,
        detail: "upstream failed",
        requestId: "req-1",
        promptMessageId: "u1",
        createdAt: new Date().toISOString(),
      },
      user("try again"),
    ]);

    expect(history.map((turn) => turn.content)).toEqual(["plan my day", "try again"]);
  });

  it("omits a turn that is still generating", () => {
    const history = buildHistory([
      user("plan my day"),
      {
        id: "p1",
        role: "assistant",
        kind: "pending",
        promptMessageId: "u1",
        stage: "writing",
        stageDetail: null,
        tokens: "half a sen",
        places: [],
        stopped: false,
        startedAt: Date.now(),
        createdAt: new Date().toISOString(),
      },
    ]);

    expect(history).toEqual([{ role: "user", content: "plan my day" }]);
  });

  it("drops empty turns rather than sending content the contract rejects", () => {
    const history = buildHistory([user("   "), chat(""), user("real question")]);

    expect(history).toEqual([{ role: "user", content: "real question" }]);
  });

  it("middle-truncates an over-long turn to the backend's limit", () => {
    const long = `START${"x".repeat(HISTORY_CONTENT_MAX * 2)}END`;
    const [turn] = buildHistory([user(long)]);

    expect(turn.content).toHaveLength(HISTORY_CONTENT_MAX);
    // Both ends survive: the opening states the request, the ending usually
    // carries what a follow-up refers to.
    expect(turn.content.startsWith("START")).toBe(true);
    expect(turn.content.endsWith("END")).toBe(true);
    expect(turn.content).toContain("…");
  });
});

describe("assistantHistoryContent", () => {
  it("flattens a plan to its title and description", () => {
    const content = assistantHistoryContent(
      response({
        type: "plan",
        plan_type: "trip",
        plan: {
          title: "Three Days in Paris",
          description: "A relaxed first trip.",
          tasks: [],
          outing_readiness: [],
          places: [],
        },
      }),
    );

    expect(content).toBe("Three Days in Paris. A relaxed first trip.");
  });

  it("uses the prose of a real-time answer", () => {
    const content = assistantHistoryContent(
      response({
        type: "realtime",
        plan_type: "realtime",
        realtime: { answer: "Sunny, 24–29 °C.", sources: [] },
      }),
    );

    expect(content).toBe("Sunny, 24–29 °C.");
  });

  it("names the venues so a follow-up can refer to one", () => {
    // "what's their number?" only resolves if the names went into history —
    // the reply text alone usually just says "three places".
    const content = assistantHistoryContent(
      response({
        plan_type: "places",
        chat: {
          reply: "Here are two Italian places near you.",
          needs: null,
          places: [
            { name: "Pizza Nonna" },
            { name: "Trattoria Rosa" },
          ] as never,
        },
      }),
    );

    expect(content).toContain("Pizza Nonna");
    expect(content).toContain("Trattoria Rosa");
  });

  it("returns null when there is nothing the model could refer back to", () => {
    expect(assistantHistoryContent(response({}))).toBeNull();
  });
});
