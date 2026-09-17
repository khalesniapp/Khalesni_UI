import { z } from "zod";

import { generatePlanResponseSchema } from "@/lib/api/types";

/**
 * The voice wire protocol — UI_Plan.md §7.7, and `../khalesni/README.md`.
 *
 * Server → browser is either a binary frame (PCM16 LE mono **24 kHz** speech)
 * or a JSON envelope `{type, data}`. `data` always exists server-side (it
 * defaults to `{}`), so the absent-payload events still parse.
 *
 * Parsed at the boundary like every other response (§11.4): a voice session is
 * long-lived and an unparsed event would surface as a broken transcript row
 * several seconds after the mistake, which is a miserable thing to debug.
 */

export const VOICE_EVENT_TYPES = [
  "ready",
  "transcript",
  "interrupted",
  "turn_complete",
  "tool_started",
  "plan_generated",
  "session_ending",
  "error",
] as const;

/** The two tools the voice graph can run, both of which explain a silence. */
export const VOICE_TOOLS = ["create_plan", "get_my_preferences"] as const;
export type VoiceTool = (typeof VOICE_TOOLS)[number];

const envelope = z.object({
  type: z.string(),
  data: z.record(z.string(), z.unknown()).default({}),
});

export const voiceEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("ready"),
    data: z.object({ session_id: z.string() }),
  }),
  z.object({
    type: z.literal("transcript"),
    data: z.object({
      role: z.enum(["user", "assistant"]),
      text: z.string(),
    }),
  }),
  z.object({ type: z.literal("interrupted"), data: z.unknown().optional() }),
  z.object({ type: z.literal("turn_complete"), data: z.unknown().optional() }),
  z.object({
    type: z.literal("tool_started"),
    data: z.object({ name: z.string() }),
  }),
  z.object({
    // The payload is a full GeneratePlanResponse, so the plan renders through
    // exactly the same card as one generated from the chat screen.
    type: z.literal("plan_generated"),
    data: generatePlanResponseSchema,
  }),
  z.object({
    type: z.literal("session_ending"),
    data: z.object({ reason: z.string() }).partial(),
  }),
  z.object({
    type: z.literal("error"),
    data: z.object({ detail: z.string() }).partial(),
  }),
]);

export type VoiceEvent = z.infer<typeof voiceEventSchema>;

/**
 * Parse one JSON frame.
 *
 * Returns null for anything unrecognised rather than throwing — the backend may
 * add event types, and an unknown one must not kill a live session (the same
 * tolerance §11.5 asks for on the SSE stream).
 */
export function parseVoiceEvent(raw: string): VoiceEvent | null {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return null;
  }

  const outer = envelope.safeParse(json);
  if (!outer.success) return null;

  const parsed = voiceEventSchema.safeParse(json);
  if (parsed.success) return parsed.data;

  if (process.env.NODE_ENV !== "production") {
    // A known type that failed its payload check is contract drift and should
    // be loud; a genuinely unknown type is not.
    if ((VOICE_EVENT_TYPES as readonly string[]).includes(outer.data.type)) {
      console.error("[voice] event failed schema validation", outer.data.type, parsed.error.issues);
    }
  }
  return null;
}

/* ---------------------------------------------------------------------------
   Close codes — §7.7.
   ------------------------------------------------------------------------- */

export type VoiceCloseReason = "handle" | "busy" | "ended";

/**
 * Maps a WebSocket close code to the message key the user sees.
 *
 * 1008 and 1013 are the backend's own signals and mean genuinely different
 * things — a handle that is not allowed versus a session already open
 * elsewhere — so they must not collapse into one "connection failed".
 */
export function closeReason(code: number): VoiceCloseReason {
  if (code === 1008) return "handle";
  if (code === 1013) return "busy";
  return "ended";
}
