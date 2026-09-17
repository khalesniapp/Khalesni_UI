"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

import { useCapabilities } from "@/lib/hooks/useCapabilities";
import { cn } from "@/lib/utils/cn";
import { NAV_ITEMS, isActive } from "./navItems";

/**
 * Left sidebar — UI_Plan.md §4, 240 px, shown at 1024 px and up.
 *
 * Same four destinations as the bottom bar (`navigation-consistency`). The
 * recent-plans list the spec calls for lands in Phase 2, once there is a plans
 * query to read; the slot is marked below so it is not forgotten.
 */
export function Sidebar() {
  const pathname = usePathname();
  const t = useTranslations("nav");
  const tApp = useTranslations("app");
  const tVoice = useTranslations("voice");
  const { canUseVoice, loading } = useCapabilities();

  return (
    <aside
      className="hidden shrink-0 border-e border-border bg-card lg:block lg:w-60"
      style={{ zIndex: "var(--z-nav)" }}
    >
      <div className="sticky top-0 flex h-dvh flex-col gap-(--space-5) p-(--space-4)">
        <p className="text-h3 px-(--space-2) font-heading text-primary">{tApp("name")}</p>

        <nav aria-label={t("primary")}>
          <ul className="flex flex-col gap-1">
            {NAV_ITEMS.map((item) => {
              const active = isActive(pathname, item.href);
              const Icon = item.icon;
              const disabled = item.capability === "voice" && !loading && !canUseVoice;

              const inner = (
                <>
                  <Icon
                    aria-hidden="true"
                    weight={active ? "fill" : "regular"}
                    style={{ width: "var(--icon-md)", height: "var(--icon-md)" }}
                  />
                  <span>{t(item.labelKey)}</span>
                </>
              );

              const shared = cn(
                "flex min-h-11 items-center gap-(--space-3) rounded-md px-(--space-3)",
                "transition-colors duration-(--dur-fast)",
              );

              return (
                <li key={item.href}>
                  {disabled ? (
                    <span
                      aria-disabled="true"
                      title={tVoice("off")}
                      className={cn(shared, "text-muted-foreground opacity-60")}
                    >
                      {inner}
                      <span className="sr-only">{tVoice("off")}</span>
                    </span>
                  ) : (
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        shared,
                        active
                          ? "bg-brand-100 font-medium text-primary"
                          : "text-muted-foreground hover:bg-muted",
                      )}
                    >
                      {inner}
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Phase 2: the recent-plans list from §4 renders here. */}
      </div>
    </aside>
  );
}
