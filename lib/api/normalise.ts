import type {
  GeneratePlanResponse,
  Place,
  PlanDocument,
  PlanType,
  ReadinessItem,
  Task,
} from "./types";

/**
 * Trap 1 — UI_Plan.md §6.3.
 *
 * `GeneratePlanResponse` nests the checklist under `.plan`; a saved
 * `PlanDocument` is flat. Both are normalised here into one internal `Plan` so
 * that no component ever has to know which endpoint the data came from.
 *
 * If you find yourself writing `"plan" in x` inside a component, the answer is
 * to come back here instead.
 */
export interface Plan {
  /** `null` → never persisted. Item editing is impossible without it (trap 3). */
  id: string | null;
  title: string;
  description: string;
  tasks: Task[];
  outing_readiness: ReadinessItem[];
  places: Place[];
  planType: PlanType;
  createdAt: string;
  updatedAt: string | null;
  /** `false` → Mongo write failed. The plan is still valid; show the amber notice (§7.3). */
  persisted: boolean;
  /** The original brain-dump. Only saved documents carry it (§7.6 "You asked"). */
  prompt: string | null;
  mood: string | null;
  model: string | null;
}

/**
 * The single gate for item mutations. `persisted: false` means there is no
 * document to PATCH, so ticks stay local — trap 3 is "do not attempt PATCH",
 * not "retry the PATCH".
 */
export function isEditable(plan: Plan): boolean {
  return plan.id !== null && plan.persisted;
}

export function totalItems(plan: Plan): number {
  return plan.tasks.length + plan.outing_readiness.length;
}

export function completedItems(plan: Plan): number {
  return (
    plan.tasks.filter((t) => t.completed).length +
    plan.outing_readiness.filter((i) => i.completed).length
  );
}

/** A generate response that carried a plan. Returns null for chat/realtime replies. */
export function fromGenerateResponse(response: GeneratePlanResponse): Plan | null {
  if (!response.plan) return null;

  return {
    id: response.plan_id,
    title: response.plan.title,
    description: response.plan.description,
    tasks: response.plan.tasks,
    outing_readiness: response.plan.outing_readiness,
    places: response.plan.places,
    planType: response.plan_type,
    createdAt: response.created_at,
    updatedAt: null,
    persisted: response.persisted,
    prompt: null,
    mood: null,
    model: null,
  };
}

/** A saved document, from the list or the detail endpoint, or returned by a mutation. */
export function fromPlanDocument(document: PlanDocument): Plan {
  return {
    id: document.id,
    title: document.title,
    description: document.description,
    tasks: document.tasks,
    outing_readiness: document.outing_readiness,
    places: document.places,
    planType: document.plan_type,
    createdAt: document.created_at,
    updatedAt: document.updated_at,
    // It came back from the database, so by definition it is stored.
    persisted: true,
    prompt: document.prompt,
    mood: document.mood,
    model: document.model ?? null,
  };
}
