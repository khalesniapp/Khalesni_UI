import { request } from "./client";
import { healthSchema, type Health } from "./types";

/**
 * Capability probe — UI_Plan.md §6.5.
 *
 * Trap 6: capabilities are off by default on the backend. Every dependent
 * surface reads this snapshot instead of discovering the limitation through a
 * failed click.
 */
export function getHealth(signal?: AbortSignal): Promise<Health> {
  return request({ path: "/health", schema: healthSchema, signal });
}

/** §11.2 — fetched on boot, cached 60 s, re-fetched on window focus. */
export const HEALTH_STALE_MS = 60_000;

export type CapabilityState = "working" | "unavailable" | "off";

/**
 * The §7.8 status list. A red/amber/green dot alone would fail `color-not-only`,
 * so each entry carries a text label key that renders beside it.
 */
export interface CapabilityRow {
  key: "core" | "plans" | "memory" | "places" | "voice";
  state: CapabilityState;
  /** Message key explaining the consequence in plain language, when degraded. */
  consequenceKey?: "plansOff" | "memoryOff" | "placesOff" | "voiceOff";
}

export function capabilityRows(health: Health): CapabilityRow[] {
  return [
    {
      key: "core",
      state: health.status === "ok" ? "working" : "unavailable",
    },
    {
      key: "plans",
      state: health.mongo_ready ? "working" : "unavailable",
      consequenceKey: health.mongo_ready ? undefined : "plansOff",
    },
    {
      key: "memory",
      state: health.rag_ready ? "working" : "unavailable",
      consequenceKey: health.rag_ready ? undefined : "memoryOff",
    },
    {
      key: "places",
      state: health.places ? "working" : "unavailable",
      consequenceKey: health.places ? undefined : "placesOff",
    },
    {
      // Voice being off is a server setting, not a fault — "off", not "unavailable".
      key: "voice",
      state: health.voice_enabled ? "working" : "off",
      consequenceKey: health.voice_enabled ? undefined : "voiceOff",
    },
  ];
}
