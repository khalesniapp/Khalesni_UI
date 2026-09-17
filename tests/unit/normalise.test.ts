import { describe, expect, it } from "vitest";

import {
  completedItems,
  fromGenerateResponse,
  fromPlanDocument,
  isEditable,
  totalItems,
} from "@/lib/api/normalise";
import {
  generatePlanResponseSchema,
  planDocumentSchema,
  type GeneratePlanResponse,
  type PlanDocument,
} from "@/lib/api/types";

/**
 * Trap 1 (§6.3): the same checklist arrives nested under `.plan` from the
 * generate endpoint and flat from a saved document. These tests pin the shape
 * of the normalised result so a component can never tell the difference.
 */

const generateResponse: GeneratePlanResponse = {
  type: "plan",
  plan_type: "daily_schedule",
  plan_id: "plan_123",
  persisted: true,
  created_at: "2026-09-17T10:00:00Z",
  plan: {
    title: "Your day",
    description: "A calm run at it.",
    tasks: [
      { task_name: "Email triage", estimated_time: "20 min", completed: false },
      { task_name: "Gym", estimated_time: "1 h", completed: true },
    ],
    outing_readiness: [{ item_name: "Water bottle", completed: false }],
    places: [],
  },
  realtime: null,
  chat: null,
  location: "Hamra, Beirut",
};

const planDocument: PlanDocument = {
  id: "plan_123",
  user_id: "nour",
  prompt: "i have energy but no plan today",
  mood: "energetic",
  plan_type: "daily_schedule",
  model: "gemma4:31b",
  created_at: "2026-09-17T10:00:00Z",
  updated_at: "2026-09-17T11:00:00Z",
  title: "Your day",
  description: "A calm run at it.",
  tasks: [
    { task_name: "Email triage", estimated_time: "20 min", completed: false },
    { task_name: "Gym", estimated_time: "1 h", completed: true },
  ],
  outing_readiness: [{ item_name: "Water bottle", completed: false }],
  places: [],
};

describe("the two plan shapes normalise to one", () => {
  it("accepts both fixtures as valid wire payloads", () => {
    expect(generatePlanResponseSchema.safeParse(generateResponse).success).toBe(true);
    expect(planDocumentSchema.safeParse(planDocument).success).toBe(true);
  });

  it("produces identical checklist content from either source", () => {
    const fromGenerate = fromGenerateResponse(generateResponse);
    const fromDocument = fromPlanDocument(planDocument);

    expect(fromGenerate).not.toBeNull();
    expect(fromGenerate!.title).toBe(fromDocument.title);
    expect(fromGenerate!.tasks).toEqual(fromDocument.tasks);
    expect(fromGenerate!.outing_readiness).toEqual(fromDocument.outing_readiness);
    expect(fromGenerate!.planType).toBe(fromDocument.planType);
  });

  it("returns null for a chat reply, which carries no plan", () => {
    const chat: GeneratePlanResponse = {
      ...generateResponse,
      type: "chat",
      plan_type: "chat",
      plan: null,
      chat: { reply: "hey", needs: null, places: [] },
    };
    expect(fromGenerateResponse(chat)).toBeNull();
  });

  it("only a saved document carries the original prompt for the You-asked block", () => {
    expect(fromGenerateResponse(generateResponse)!.prompt).toBeNull();
    expect(fromPlanDocument(planDocument).prompt).toBe("i have energy but no plan today");
  });
});

describe("trap 3 — persisted: false blocks editing", () => {
  it("is not editable when Mongo failed, even though the plan is valid", () => {
    const unsaved = fromGenerateResponse({
      ...generateResponse,
      plan_id: null,
      persisted: false,
    })!;

    expect(unsaved.tasks).toHaveLength(2); // the plan itself is intact
    expect(isEditable(unsaved)).toBe(false); // but there is nothing to PATCH
  });

  it("is not editable when an id exists but the write did not land", () => {
    const halfSaved = fromGenerateResponse({ ...generateResponse, persisted: false })!;
    expect(halfSaved.id).toBe("plan_123");
    expect(isEditable(halfSaved)).toBe(false);
  });

  it("is editable once it round-trips from the database", () => {
    expect(isEditable(fromPlanDocument(planDocument))).toBe(true);
  });
});

describe("progress counts span both checklists", () => {
  it("counts tasks and readiness items together", () => {
    const plan = fromPlanDocument(planDocument);
    expect(totalItems(plan)).toBe(3);
    expect(completedItems(plan)).toBe(1);
  });

  it("survives a plan emptied by deletes", () => {
    const emptied = fromPlanDocument({ ...planDocument, tasks: [], outing_readiness: [] });
    expect(totalItems(emptied)).toBe(0);
    expect(completedItems(emptied)).toBe(0);
  });
});
