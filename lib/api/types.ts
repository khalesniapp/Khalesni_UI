import { z } from "zod";

/**
 * The API contract — UI_Plan.md §6.3, mirroring the backend's app/models.py.
 *
 * Every response is parsed through these at the boundary (§11.4) so contract
 * drift fails loudly in dev instead of rendering `undefined` three components
 * deep. Nothing outside lib/api/ should import the raw wire types; components
 * consume the normalised `Plan` from ./normalise.
 */

export const PLAN_TYPES = [
  "outing",
  "trip",
  "study",
  "daily_schedule",
  "general",
  "realtime",
  "chat",
  "places",
] as const;

export const planTypeSchema = z.enum(PLAN_TYPES);
export type PlanType = z.infer<typeof planTypeSchema>;

/** The two checklist collections. Never spell these as bare strings at a call site (§6.2). */
export const ITEM_TYPES = ["tasks", "outing_readiness"] as const;
export const itemTypeSchema = z.enum(ITEM_TYPES);
export type ItemType = z.infer<typeof itemTypeSchema>;

export const taskSchema = z.object({
  task_name: z.string(),
  estimated_time: z.string(),
  completed: z.boolean(),
});
export type Task = z.infer<typeof taskSchema>;

export const readinessItemSchema = z.object({
  item_name: z.string(),
  completed: z.boolean(),
});
export type ReadinessItem = z.infer<typeof readinessItemSchema>;

export const placeSchema = z.object({
  name: z.string(),
  kind: z.string().nullish(), // OSM type: "restaurant" | "cafe" | "park" | …
  cuisine: z.string().nullish(), // "italian", "ice_cream"
  distance: z.string().nullish(), // "578 m" — from the searched centre
  address: z.string().nullish(),
  phone: z.string().nullish(),
  phone_source: z.string().nullish(), // set when the phone came from the web → MUST be shown (§7.4)
  opening_hours: z.string().nullish(), // raw OSM, e.g. "Mo-Su 12:00-23:00"
  website: z.string().nullish(),
  osm_id: z.string().nullish(), // "node/4718183548"
  source: z.string().nullish(), // web page that recommended it
  note: z.string().nullish(), // why that page recommends it
  latitude: z.number().nullish(), // null → NOT on the map
  longitude: z.number().nullish(),
  map_link: z.string().nullish(),
});
export type Place = z.infer<typeof placeSchema>;

export const planOutputSchema = z.object({
  title: z.string(),
  description: z.string(),
  tasks: z.array(taskSchema), // 1–25 on generation, may be 0 after deletes
  outing_readiness: z.array(readinessItemSchema),
  places: z.array(placeSchema),
});
export type PlanOutput = z.infer<typeof planOutputSchema>;

export const chatReplySchema = z.object({
  reply: z.string(),
  needs: z.literal("location").nullable(),
  places: z.array(placeSchema),
});
export type ChatReply = z.infer<typeof chatReplySchema>;

export const realtimeAnswerSchema = z.object({
  answer: z.string(),
  sources: z.array(
    z.object({
      title: z.string().nullish(),
      url: z.string(),
    }),
  ),
});
export type RealtimeAnswer = z.infer<typeof realtimeAnswerSchema>;

export const generatePlanResponseSchema = z.object({
  type: z.enum(["plan", "realtime", "chat"]),
  plan_type: planTypeSchema,
  plan_id: z.string().nullable(), // null → not saved → item editing impossible (trap 3)
  persisted: z.boolean(), // false → Mongo write failed, plan is still valid
  created_at: z.string(),
  plan: planOutputSchema.nullable(),
  realtime: realtimeAnswerSchema.nullable(),
  chat: chatReplySchema.nullable(),
  location: z.string().nullable(), // cleaned location actually used → remember it (§5.3)
});
export type GeneratePlanResponse = z.infer<typeof generatePlanResponseSchema>;

/**
 * A saved plan. FLAT — the checklist fields sit at the top level, with no
 * nested `plan` key. This is trap 1: the same content arrives in two shapes
 * depending on the endpoint. See ./normalise.
 */
export const planDocumentSchema = planOutputSchema.extend({
  id: z.string(),
  user_id: z.string(),
  prompt: z.string(), // the original brain-dump
  mood: z.string(),
  plan_type: planTypeSchema,
  model: z.string().nullish(), // which LLM wrote it
  created_at: z.string(),
  updated_at: z.string(),
});
export type PlanDocument = z.infer<typeof planDocumentSchema>;

export const planDocumentListSchema = z.array(planDocumentSchema);

/** §6.5 — capability flags. Extra keys are tolerated; missing ones are not. */
export const healthSchema = z.object({
  status: z.string(),
  env: z.string().nullish(),
  llm_provider: z.string().nullish(),
  llm_model: z.string().nullish(),
  mongo_ready: z.boolean(), // false → hide/disable Plans, warn on chat
  pinecone_index: z.string().nullish(),
  rag_ready: z.boolean(), // false → "Khalesni won't remember preferences yet"
  places: z.boolean(), // false → hide the map-search UI
  voice_enabled: z.boolean(), // false → Voice tab disabled with a reason
  active_voice_sessions: z.number().nullish(),
});
export type Health = z.infer<typeof healthSchema>;

/* ---------------------------------------------------------------------------
   Request payloads — the §6.2 limits, enforced before we send.
   A 422 from the backend means one of these was bypassed.
   ------------------------------------------------------------------------- */

/** `^[a-z0-9_\-]{1,128}$` — trimmed and lowercased server-side, so we match it here. */
export const USER_ID_PATTERN = /^[a-z0-9_-]{1,128}$/;

export const userIdSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(USER_ID_PATTERN, "Letters, numbers, - and _ only");

export const PROMPT_MAX = 4000;
export const PROMPT_COUNTER_FROM = 3600;
export const MOOD_MAX = 50;
export const LOCATION_MAX = 300;
export const ITEM_NAME_MAX = 300;
export const ESTIMATED_TIME_MAX = 50;
export const HISTORY_MAX_TURNS = 10; // the contract allows 20; we send the last 10 (§5.2)
export const HISTORY_CONTENT_MAX = 2000;

export const historyTurnSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(HISTORY_CONTENT_MAX),
});
export type HistoryTurn = z.infer<typeof historyTurnSchema>;

export const generatePlanRequestSchema = z.object({
  user_id: userIdSchema,
  prompt: z.string().trim().min(1).max(PROMPT_MAX),
  mood: z.string().trim().min(1).max(MOOD_MAX).optional(),
  location: z.string().trim().max(LOCATION_MAX).optional(),
  ask_location: z.boolean().optional(),
  history: z.array(historyTurnSchema).max(HISTORY_MAX_TURNS).optional(),
});
export type GeneratePlanRequest = z.infer<typeof generatePlanRequestSchema>;

export const patchItemRequestSchema = z.object({
  user_id: userIdSchema,
  item_type: itemTypeSchema,
  index: z.number().int().min(0),
  completed: z.boolean().optional(),
  name: z.string().trim().min(1).max(ITEM_NAME_MAX).optional(),
  estimated_time: z.string().trim().max(ESTIMATED_TIME_MAX).optional(),
});
export type PatchItemRequest = z.infer<typeof patchItemRequestSchema>;

export const addItemRequestSchema = z.object({
  user_id: userIdSchema,
  item_type: itemTypeSchema,
  name: z.string().trim().min(1).max(ITEM_NAME_MAX),
  estimated_time: z.string().trim().max(ESTIMATED_TIME_MAX).optional(),
});
export type AddItemRequest = z.infer<typeof addItemRequestSchema>;

/* ---------------------------------------------------------------------------
   SSE frames — §5.5 / §11.5. Phase 4 consumes these; the shapes live here so
   the contract stays in one file.
   ------------------------------------------------------------------------- */

export const STREAM_STAGES = [
  "thinking",
  "remembering",
  "searching",
  "checking",
  "writing",
] as const;
export type StreamStage = (typeof STREAM_STAGES)[number];

export const streamStatusSchema = z.object({
  stage: z.string(),
  detail: z.string().nullish(),
});

export const streamErrorSchema = z.object({
  detail: z.string(),
  request_id: z.string().nullish(),
});
