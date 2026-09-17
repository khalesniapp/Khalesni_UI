import type { GeneratePlanResponse } from "@/lib/api/types";

/**
 * Transcript assembly — UI_Plan.md §7.7.
 *
 * Gemini Live streams transcription in **fragments**. The backend forwards each
 * `input_transcription` / `output_transcription` piece as its own `transcript`
 * event — the variable in `app/voice/bridge.py` is literally named `piece` — so
 * a naive "one row per event" renderer produces a column of single words
 * instead of a sentence.
 *
 * The fix: keep one open paragraph per speaker and append into it.
 *
 * A paragraph is broken by a **speaker change** or by a row being inserted
 * (a tool notice, a plan card) — deliberately **not** by `turn_complete`.
 * Gemini's output transcription lags the audio it describes, so the tail of a
 * reply keeps arriving *after* the turn is reported complete; treating that
 * event as a paragraph break put every trailing fragment on its own line, which
 * is why the assistant rendered word-by-word while the user did not (the user's
 * transcription arrives as one block before its turn boundary).
 *
 * This is the same rule the backend applies to the transcript it persists —
 * `_add_transcript` in `app/voice/bridge.py` coalesces on role alone.
 *
 * Kept pure and separate from the component because it is the one piece of
 * voice logic that can be tested without a microphone.
 */

export type VoiceRow =
  | { id: string; kind: "speech"; role: "user" | "assistant"; text: string }
  | { id: string; kind: "tool"; name: string }
  | { id: string; kind: "plan"; response: GeneratePlanResponse }
  | { id: string; kind: "error"; detail: string };

export type OpenRole = "user" | "assistant" | null;

export interface TranscriptState {
  rows: VoiceRow[];
  /** Whose paragraph is currently open, if any. */
  openRole: OpenRole;
}

export const emptyTranscript: TranscriptState = { rows: [], openRole: null };

/**
 * Append a transcript fragment.
 *
 * Fragments are concatenated with **no separator**: Gemini's pieces already
 * carry their own leading spaces, and adding more would double them up
 * mid-sentence.
 *
 * A new paragraph starts when the speaker changes or when the previous one was
 * closed. Empty fragments are ignored — the stream emits them at turn
 * boundaries and they would otherwise open an empty bubble.
 */
export function appendFragment(
  state: TranscriptState,
  role: "user" | "assistant",
  text: string,
  nextId: () => string,
): TranscriptState {
  if (!text) return state;

  const last = state.rows[state.rows.length - 1];
  const canContinue =
    state.openRole === role && last?.kind === "speech" && last.role === role;

  if (canContinue) {
    const merged: VoiceRow = { ...last, text: last.text + text };
    return { rows: [...state.rows.slice(0, -1), merged], openRole: role };
  }

  return {
    rows: [...state.rows, { id: nextId(), kind: "speech", role, text }],
    openRole: role,
  };
}

/**
 * Insert a non-speech row (a tool notice, a plan card, an error).
 *
 * This closes the open paragraph, so a continuation lands *below* the inserted
 * row rather than being appended to the paragraph above it.
 */
export function insertRow(state: TranscriptState, row: VoiceRow): TranscriptState {
  return { rows: [...state.rows, row], openRole: null };
}

/**
 * End the current paragraph.
 *
 * Used at session start and by `insertRow`. **Not** wired to `turn_complete` —
 * see the note at the top of this file; doing so fragments every reply.
 */
export function closeParagraph(state: TranscriptState): TranscriptState {
  return state.openRole === null ? state : { ...state, openRole: null };
}
