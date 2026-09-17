"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

import { useCapabilities } from "@/lib/hooks/useCapabilities";
import { cn } from "@/lib/utils/cn";
import { NAV_ITEMS, isActive } from "./navItems";

/**
 * Bottom tab bar — UI_Plan.md §4, shown below 1024 px.
 *
 * Icon *and* label (`nav-label-icon`), 44 px minimum target (§13), active item
 * in brand colour with a 2 px indicator, and bottom safe-area padding so the
 * home indicator does not sit on top of the tabs.
 */
export function BottomNav() {
  const pathname = usePathname();
  const t = useTranslations("nav");
  const tVoice = useTranslations("voice");
  const { canUseVoice, loading } = useCapabilities();

  return (
    <nav
      aria-label={t("primary")}
      className={cn(
        "sticky bottom-0 lg:hidden",
        "border-t border-border bg-card",
        "pb-[env(safe-area-inset-bottom)]",
      )}
      style={{ zIndex: "var(--z-nav)", boxShadow: "var(--shadow-2)" }}
    >
      <ul className="mx-auto flex max-w-160 items-stretch">
        {NAV_ITEMS.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;

          // Never disable on an unresolved probe — that would flicker the tab
          // off and on. Only a resolved `false` disables it.
          const disabled = item.capability === "voice" && !loading && !canUseVoice;

          const content = (
            <>
              <Icon
                aria-hidden="true"
                weight={active ? "fill" : "regular"}
                style={{ width: "var(--icon-lg)", height: "var(--icon-lg)" }}
              />
              <span className="text-label">{t(item.labelKey)}</span>
            </>
          );

          return (
            <li key={item.href} className="flex-1">
              {disabled ? (
                <span
                  aria-disabled="true"
                  title={tVoice("off")}
                  className={cn(
                    "relative flex min-h-11 flex-col items-center justify-center gap-1 px-2 py-2",
                    "text-muted-foreground opacity-60",
                  )}
                >
                  {content}
                  <span className="sr-only">{tVoice("off")}</span>
                </span>
              ) : (
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative flex min-h-11 flex-col items-center justify-center gap-1 px-2 py-2",
                    "transition-colors duration-(--dur-fast)",
                    active ? "text-primary" : "text-muted-foreground",
                  )}
                >
                  {/* 2 px active indicator, drawn on the inline axis so it flips under RTL. */}
                  {active && (
                    <span
                      aria-hidden="true"
                      className="absolute inset-x-0 top-0 h-0.5 bg-primary"
                    />
                  )}
                  {content}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
