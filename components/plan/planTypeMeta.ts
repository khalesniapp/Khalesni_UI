import { BookOpen } from "@phosphor-icons/react/dist/ssr/BookOpen";
import { ListChecks } from "@phosphor-icons/react/dist/ssr/ListChecks";
import { MapTrifold } from "@phosphor-icons/react/dist/ssr/MapTrifold";
import { Suitcase } from "@phosphor-icons/react/dist/ssr/Suitcase";
import { SunHorizon } from "@phosphor-icons/react/dist/ssr/SunHorizon";
import type { Icon } from "@phosphor-icons/react";

import type { PlanType } from "@/lib/api/types";

/**
 * Plan type → badge label and icon (UI_Plan.md §7.3).
 *
 * `plan_type` also carries the three non-plan values (`realtime`, `chat`,
 * `places`), which never reach a PlanCard — the ResponseRouter sends those
 * elsewhere. They fall back to the general icon rather than crashing, because
 * a checklist arriving under an unexpected type is still a checklist.
 */
export interface PlanTypeMeta {
  icon: Icon;
  /** Key under `planType.` in the catalogues (§9: no literal labels). */
  labelKey: "trip" | "outing" | "study" | "day" | "general";
  /**
   * §7.3: the readiness section header is contextual — "Before you go" for
   * things you leave the house for, "Bring / prepare" otherwise.
   */
  readinessKey: "outing" | "general";
}

const GENERAL: PlanTypeMeta = {
  icon: ListChecks,
  labelKey: "general",
  readinessKey: "general",
};

const BY_TYPE: Partial<Record<PlanType, PlanTypeMeta>> = {
  trip: { icon: Suitcase, labelKey: "trip", readinessKey: "outing" },
  outing: { icon: MapTrifold, labelKey: "outing", readinessKey: "outing" },
  study: { icon: BookOpen, labelKey: "study", readinessKey: "general" },
  daily_schedule: { icon: SunHorizon, labelKey: "day", readinessKey: "general" },
  general: GENERAL,
};

export function planTypeMeta(planType: PlanType): PlanTypeMeta {
  return BY_TYPE[planType] ?? GENERAL;
}

/** The filter chips in the plans library, in a stable order (§7.6). */
export const FILTERABLE_PLAN_TYPES = [
  "trip",
  "daily_schedule",
  "study",
  "outing",
  "general",
] as const satisfies readonly PlanType[];
