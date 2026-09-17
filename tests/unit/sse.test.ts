import { describe, expect, it } from "vitest";

import { SseParser, frameJson } from "@/lib/api/sse";

/**
 * UI_Plan.md §11.5: "Buffer partial frames. A split `data:` line is the classic
 * bug here."
 *
 * These tests exist specifically to fail if someone simplifies the parser into
 * something that parses each chunk independently — which passes every casual
 * manual test against a local backend and corrupts messages over a real
 * network.
 */

const RESULT = '{"type":"plan","title":"Three Days in Paris"}';

describe("SseParser", () => {
  it("parses a whole frame from one chunk", () => {
    const parser = new SseParser();
    const frames = parser.push(`event: status\ndata: {"stage":"thinking"}\n\n`);

    expect(frames).toEqual([{ event: "status", data: '{"stage":"thinking"}' }]);
  });

  it("holds a frame split mid-JSON until the rest arrives", () => {
    const parser = new SseParser();

    // The split lands inside the JSON payload, which is where TCP actually
    // puts it in practice.
    expect(parser.push(`event: result\ndata: {"type":"plan","ti`)).toEqual([]);
    expect(parser.push(`tle":"Three Days in Paris"}\n\n`)).toEqual([
      { event: "result", data: RESULT },
    ]);
  });

  it("holds a frame split across the delimiter itself", () => {
    const parser = new SseParser();

    expect(parser.push(`event: token\ndata: {"text":"hi"}\n`)).toEqual([]);
    expect(parser.push(`\nevent: token\ndata: {"text":" there"}\n\n`)).toEqual([
      { event: "token", data: '{"text":"hi"}' },
      { event: "token", data: '{"text":" there"}' },
    ]);
  });

  it("emits several frames delivered in one chunk", () => {
    const parser = new SseParser();
    const frames = parser.push(
      `event: status\ndata: {"stage":"writing"}\n\nevent: token\ndata: {"text":"a"}\n\n`,
    );

    expect(frames.map((frame) => frame.event)).toEqual(["status", "token"]);
  });

  it("survives CRLF line endings from a rewriting proxy", () => {
    const parser = new SseParser();
    const frames = parser.push(`event: status\r\ndata: {"stage":"searching"}\r\n\r\n`);

    expect(frames).toEqual([{ event: "status", data: '{"stage":"searching"}' }]);
  });

  it("ignores comment heartbeats without emitting a frame", () => {
    const parser = new SseParser();

    expect(parser.push(`: keep-alive\n\n`)).toEqual([]);
  });

  it("joins multiple data lines in one frame", () => {
    const parser = new SseParser();
    const frames = parser.push(`event: token\ndata: line one\ndata: line two\n\n`);

    expect(frames[0].data).toBe("line one\nline two");
  });

  it("defaults a frame with no event name to 'message'", () => {
    const parser = new SseParser();

    expect(parser.push(`data: {"text":"x"}\n\n`)[0].event).toBe("message");
  });

  it("flushes a final frame that arrived without a trailing blank line", () => {
    const parser = new SseParser();

    expect(parser.push(`event: result\ndata: ${RESULT}\n`)).toEqual([]);
    // Losing this frame would mean losing the result — the one frame that
    // actually matters.
    expect(parser.flush()).toEqual([{ event: "result", data: RESULT }]);
  });

  it("flushes nothing when the buffer is empty", () => {
    const parser = new SseParser();
    parser.push(`event: token\ndata: {"text":"x"}\n\n`);

    expect(parser.flush()).toEqual([]);
  });

  it("keeps a byte-level split of a multi-byte character intact across pushes", () => {
    const parser = new SseParser();

    // Arabic stage copy and the ellipsis are both multi-byte; the decoder
    // handles the bytes, the parser must handle the resulting fragments.
    expect(parser.push(`event: status\ndata: {"detail":"أبحث عن `)).toEqual([]);
    const frames = parser.push(`أماكن…"}\n\n`);

    expect(frameJson(frames[0])).toEqual({ detail: "أبحث عن أماكن…" });
  });
});

describe("frameJson", () => {
  it("returns null for a malformed payload rather than throwing", () => {
    // §11.5 tolerates junk: one bad frame must not kill a live generation.
    expect(frameJson({ event: "token", data: "{not json" })).toBeNull();
  });
});
