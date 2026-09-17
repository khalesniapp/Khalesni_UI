import { describe, expect, it } from "vitest";

import { capabilityRows } from "@/lib/api/health";
import { isValidUserId, normaliseUserId } from "@/lib/stores/identity";
import { healthSchema, generatePlanRequestSchema, placeSchema } from "@/lib/api/types";

/**
 * Boundary rules from §6.2 and §6.5 — the ones that cause real bugs if they
 * drift, rather than a re-test of Zod itself.
 */

describe("user_id normalisation (§6.2)", () => {
  it('treats "Nour" and "nour" as the same person', () => {
    expect(normaliseUserId("Nour")).toBe(normaliseUserId("nour"));
  });

  it("trims surrounding whitespace, as the server does", () => {
    expect(normaliseUserId("  nour  ")).toBe("nour");
  });

  it.each(["nour", "nour_2", "nour-2", "a", "a".repeat(128)])("accepts %s", (id) => {
    expect(isValidUserId(id)).toBe(true);
  });

  it.each(["", "nour 2", "nour!", "nour@example.com", "a".repeat(129)])(
    "rejects %s",
    (id) => {
      expect(isValidUserId(id)).toBe(false);
    },
  );
});

describe("generate request limits (§6.2)", () => {
  const base = { user_id: "nour", prompt: "plan my day" };

  it("lowercases the handle on the way out", () => {
    const parsed = generatePlanRequestSchema.parse({ ...base, user_id: "Nour" });
    expect(parsed.user_id).toBe("nour");
  });

  it("rejects a blank prompt", () => {
    expect(generatePlanRequestSchema.safeParse({ ...base, prompt: "   " }).success).toBe(false);
  });

  it("rejects a prompt over 4000 characters", () => {
    expect(
      generatePlanRequestSchema.safeParse({ ...base, prompt: "a".repeat(4001) }).success,
    ).toBe(false);
  });

  it("caps history at 10 turns", () => {
    const turn = { role: "user" as const, content: "hi" };
    expect(
      generatePlanRequestSchema.safeParse({ ...base, history: Array(10).fill(turn) }).success,
    ).toBe(true);
    expect(
      generatePlanRequestSchema.safeParse({ ...base, history: Array(11).fill(turn) }).success,
    ).toBe(false);
  });
});

describe("places tolerate every optional field being absent (§7.4)", () => {
  it("accepts a bare name", () => {
    expect(placeSchema.safeParse({ name: "Cafe Younes" }).success).toBe(true);
  });

  it("accepts explicit nulls, which is how the backend sends missing coordinates", () => {
    const parsed = placeSchema.parse({
      name: "Somewhere",
      latitude: null,
      longitude: null,
      source: "timeout.com",
    });
    // Trap 4: source but no coordinates → warning row, no map, no distance.
    expect(parsed.latitude).toBeNull();
    expect(parsed.source).toBe("timeout.com");
  });
});

describe("capability gating (§6.5, trap 6)", () => {
  const health = healthSchema.parse({
    status: "ok",
    mongo_ready: true,
    rag_ready: true,
    places: false,
    voice_enabled: false,
  });

  it("marks place search unavailable with the consequence spelled out", () => {
    const places = capabilityRows(health).find((r) => r.key === "places");
    expect(places?.state).toBe("unavailable");
    expect(places?.consequenceKey).toBe("placesOff");
  });

  it('reports voice as "off" — a server setting, not a fault', () => {
    expect(capabilityRows(health).find((r) => r.key === "voice")?.state).toBe("off");
  });

  it("reports working capabilities with no consequence note", () => {
    const plans = capabilityRows(health).find((r) => r.key === "plans");
    expect(plans?.state).toBe("working");
    expect(plans?.consequenceKey).toBeUndefined();
  });
});
