import { ChatCircleDots } from "@phosphor-icons/react/dist/ssr/ChatCircleDots";
import { ListChecks } from "@phosphor-icons/react/dist/ssr/ListChecks";
import { Microphone } from "@phosphor-icons/react/dist/ssr/Microphone";
import { UserCircle } from "@phosphor-icons/react/dist/ssr/UserCircle";
import type { Icon } from "@phosphor-icons/react";

/**
 * The four destinations — UI_Plan.md §4.
 *
 * Four is deliberate (`bottom-nav-limit` allows five). Adding a fifth means
 * revisiting the rule, not just pushing an item onto this array.
 */
export interface NavItem {
  href: "/" | "/plans" | "/voice" | "/settings";
  /** Key under `nav.` in the message catalogues — never a literal label (§9). */
  labelKey: "chat" | "plans" | "voice" | "you";
  icon: Icon;
  /**
   * Voice is gated on `/health.voice_enabled`. It is shown disabled with a
   * reason rather than removed — `empty-nav-state` in §4.
   */
  capability?: "voice";
}

export const NAV_ITEMS: readonly NavItem[] = [
  { href: "/", labelKey: "chat", icon: ChatCircleDots },
  { href: "/plans", labelKey: "plans", icon: ListChecks },
  { href: "/voice", labelKey: "voice", icon: Microphone, capability: "voice" },
  { href: "/settings", labelKey: "you", icon: UserCircle },
] as const;

/** `/plans/[planId]` should keep the Plans tab lit. */
export function isActive(pathname: string, href: NavItem["href"]): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
