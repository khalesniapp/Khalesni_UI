import { describe, expect, it } from "vitest";

import {
  appendFragment,
  closeParagraph,
  emptyTranscript,
  insertRow,
  type TranscriptState,
} from "@/lib/voice/transcript";

/**
 * Transcript assembly — UI_Plan.md §7.7.
 *
 * Gemini Live streams transcription in fragments, one `transcript` event per
 * piece. The bug these tests exist to prevent is rendering one row per event,
 * which turns a sentence into a column of single words.
 *
 * This is also the only part of the voice path that can be tested without a
 * microphone, so it carries more weight than usual.
 */

let counter = 0;
const nextId = () => `row-${(counter += 1)}`;

/** Feed a sequence of fragments, as the socket would. */
function speak(
  state: TranscriptState,
  role: "user" | "assistant",
  pieces: readonly string[],
): TranscriptState {
  return pieces.reduce((acc, piece) => appendFragment(acc, role, piece, nextId), state);
}

function texts(state: TranscriptState): string[] {
  return state.rows.map((row) => (row.kind === "speech" ? row.text : `[${row.kind}]`));
}

describe("appendFragment", () => {
  it("joins fragments from one speaker into a single paragraph", () => {
    const state = speak(emptyTranscript, "assistant", [
      "Sure",
      " — which",
      " area",
      " are you in?",
    ]);

    expect(state.rows).toHaveLength(1);
    expect(texts(state)).toEqual(["Sure — which area are you in?"]);
  });

  it("concatenates with no separator of its own", () => {
    // The pieces already carry their spacing; adding more would double it.
    const state = speak(emptyTranscript, "user", ["ham", "ra"]);

    expect(texts(state)).toEqual(["hamra"]);
  });

  it("starts a new paragraph when the speaker changes", () => {
    let state = speak(emptyTranscript, "user", ["i want to go", " out tonight"]);
    state = speak(state, "assistant", ["Sure", " — which area?"]);

    expect(texts(state)).toEqual(["i want to go out tonight", "Sure — which area?"]);
  });

  it("returns to the same speaker in a new paragraph after the other one spoke", () => {
    let state = speak(emptyTranscript, "user", ["hi"]);
    state = speak(state, "assistant", ["hello"]);
    state = speak(state, "user", ["hamra"]);

    expect(texts(state)).toEqual(["hi", "hello", "hamra"]);
    expect(state.rows).toHaveLength(3);
  });

  it("ignores empty fragments instead of opening an empty bubble", () => {
    // The stream emits these at turn boundaries.
    const state = speak(emptyTranscript, "assistant", ["", "Hello", ""]);

    expect(texts(state)).toEqual(["Hello"]);
  });

  it("leaves the state untouched for an empty fragment", () => {
    expect(appendFragment(emptyTranscript, "user", "", nextId)).toBe(emptyTranscript);
  });
});

describe("transcription arriving after turn_complete", () => {
  it("keeps the tail of a reply in the same paragraph", () => {
    // The bug this guards: Gemini's output transcription lags the audio it
    // describes, so the end of a reply keeps arriving after the turn is
    // reported complete. Breaking the paragraph on `turn_complete` put every
    // trailing fragment on its own line — the assistant rendered word-by-word
    // while the user, whose transcription arrives as one block before its turn
    // boundary, looked fine.
    let state = speak(emptyTranscript, "assistant", ["Sure, one moment", " while I"]);

    // `turn_complete` lands here. It must NOT break the paragraph.
    state = speak(state, "assistant", [" put that together", " for you."]);

    expect(state.rows).toHaveLength(1);
    expect(texts(state)).toEqual(["Sure, one moment while I put that together for you."]);
  });

  it("still separates the filler from the answer, because a tool row sits between", () => {
    let state = speak(emptyTranscript, "assistant", ["Let me find some places."]);
    state = insertRow(state, { id: nextId(), kind: "tool", name: "create_plan" });
    state = speak(state, "assistant", ["Found three spots in Hamra."]);

    expect(texts(state)).toEqual([
      "Let me find some places.",
      "[tool]",
      "Found three spots in Hamra.",
    ]);
  });
});

describe("closeParagraph", () => {
  it("makes the next fragment from the same speaker a new paragraph", () => {
    let state = speak(emptyTranscript, "assistant", ["First answer."]);
    state = closeParagraph(state);
    state = speak(state, "assistant", ["Second answer."]);

    expect(texts(state)).toEqual(["First answer.", "Second answer."]);
  });

  it("is a no-op when nothing is open", () => {
    const closed = closeParagraph(emptyTranscript);
    expect(closed).toBe(emptyTranscript);
  });
});

describe("insertRow", () => {
  it("puts a continuation below the inserted row, not above it", () => {
    let state = speak(emptyTranscript, "assistant", ["Let me build that."]);

    // §7.7: the tool notice explains the silence while the graph runs.
    state = insertRow(state, { id: nextId(), kind: "tool", name: "create_plan" });
    state = speak(state, "assistant", ["Done — here it is."]);

    expect(texts(state)).toEqual(["Let me build that.", "[tool]", "Done — here it is."]);
  });

  it("closes the open paragraph", () => {
    const state = insertRow(speak(emptyTranscript, "user", ["hi"]), {
      id: nextId(),
      kind: "error",
      detail: "boom",
    });

    expect(state.openRole).toBeNull();
  });
});

describe("a whole turn", () => {
  it("assembles the §7.7 example transcript", () => {
    let state = emptyTranscript;

    // No closeParagraph calls: turn boundaries are not paragraph breaks, and
    // the speaker changes are what separate these.
    state = speak(state, "user", ["i want to go", " out tonight"]);
    state = speak(state, "assistant", ["Sure", " — which area", " are you in?"]);
    state = speak(state, "user", ["hamra"]);
    state = insertRow(state, { id: nextId(), kind: "tool", name: "create_plan" });

    expect(texts(state)).toEqual([
      "i want to go out tonight",
      "Sure — which area are you in?",
      "hamra",
      "[tool]",
    ]);
  });
});
