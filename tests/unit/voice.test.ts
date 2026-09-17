import { describe, expect, it } from "vitest";

import { closeReason, parseVoiceEvent } from "@/lib/voice/events";

/**
 * The voice wire protocol — UI_Plan.md §7.7 and `../khalesni/README.md`.
 *
 * Events arrive as `{type, data}`, where `data` defaults to `{}` server-side.
 * These tests pin the envelope against the backend's documented shapes so a
 * contract change fails here rather than as a silently empty transcript.
 */

function frame(type: string, data?: unknown): string {
  return JSON.stringify(data === undefined ? { type } : { type, data });
}

describe("parseVoiceEvent", () => {
  it("reads the session id off `ready`", () => {
    const event = parseVoiceEvent(frame("ready", { session_id: "sess-1" }));

    expect(event).toEqual({ type: "ready", data: { session_id: "sess-1" } });
  });

  it("reads a transcript turn", () => {
    const event = parseVoiceEvent(frame("transcript", { role: "user", text: "hamra" }));

    expect(event).toEqual({
      type: "transcript",
      data: { role: "user", text: "hamra" },
    });
  });

  it("accepts payload-free events", () => {
    // The server sends these with `data: {}`, and barge-in depends on
    // `interrupted` surviving the parse.
    expect(parseVoiceEvent(frame("interrupted", {}))?.type).toBe("interrupted");
    expect(parseVoiceEvent(frame("turn_complete", {}))?.type).toBe("turn_complete");
  });

  it("reads the tool name, which is what explains the silence", () => {
    const event = parseVoiceEvent(frame("tool_started", { name: "create_plan" }));

    expect(event).toEqual({ type: "tool_started", data: { name: "create_plan" } });
  });

  it("parses `plan_generated` as a full GeneratePlanResponse", () => {
    const response = {
      type: "plan",
      plan_type: "trip",
      plan_id: "abc123",
      persisted: true,
      created_at: "2026-09-18T00:00:00Z",
      plan: {
        title: "Three Days in Paris",
        description: "A relaxed first trip.",
        tasks: [{ task_name: "Book the flight", estimated_time: "1 hour", completed: false }],
        outing_readiness: [],
        places: [],
      },
      realtime: null,
      chat: null,
      location: null,
    };

    const event = parseVoiceEvent(frame("plan_generated", response));

    expect(event?.type).toBe("plan_generated");
    // It has to satisfy the same schema as a chat-generated plan, because it
    // renders through the same card.
    expect(event?.type === "plan_generated" && event.data.plan?.title).toBe(
      "Three Days in Paris",
    );
  });

  it("reads the reason off `session_ending`", () => {
    const event = parseVoiceEvent(frame("session_ending", { reason: "client_stop" }));

    expect(event).toEqual({ type: "session_ending", data: { reason: "client_stop" } });
  });

  describe("tolerates what it should not die on", () => {
    it("ignores an unknown event type", () => {
      // §11.5's rule, applied here: the backend may add events and a live
      // session must survive one it has never seen.
      expect(parseVoiceEvent(frame("some_future_event", { x: 1 }))).toBeNull();
    });

    it("ignores malformed JSON", () => {
      expect(parseVoiceEvent("{not json")).toBeNull();
    });

    it("ignores a known event whose payload is wrong", () => {
      // Contract drift: null rather than a half-built transcript row.
      expect(parseVoiceEvent(frame("transcript", { role: "narrator" }))).toBeNull();
    });
  });
});

describe("closeReason", () => {
  it("distinguishes the backend's two deliberate close codes", () => {
    // These mean genuinely different things and must not collapse into one
    // "connection failed" message (§7.7).
    expect(closeReason(1008)).toBe("handle");
    expect(closeReason(1013)).toBe("busy");
  });

  it("treats a normal or network close as simply ended", () => {
    expect(closeReason(1000)).toBe("ended");
    expect(closeReason(1006)).toBe("ended");
    expect(closeReason(1011)).toBe("ended");
  });
});
