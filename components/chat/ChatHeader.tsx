"use client";

import { useRouter } from "next/navigation";
import { NotePencil } from "@phosphor-icons/react/dist/ssr/NotePencil";
import { useTranslations } from "next-intl";

import { ThemeCycleButton } from "@/components/settings/ThemeCycleButton";
import { IconButton } from "@/components/ui/Button";
import { Menu } from "@/components/ui/Menu";
import type { Theme } from "@/lib/theme";

/**
 * The chat header — UI_Plan.md §7.2.1.
 *
 * Sticky, because "New chat" and the handle menu have to stay reachable in a
 * long thread. The handle is shown rather than hidden behind an avatar: it is
 * the only identity there is, and anyone can be using it (§7.1).
 *
 * "New chat" confirms only when there is something to lose — §7.2.1 asks for a
 * prompt on unsaved content, and a confirm on an empty thread would be noise.
 */
export function ChatHeader({
  userId,
  theme,
  hasContent,
  onNewChat,
}: {
  userId: string;
  theme: Theme;
  hasContent: boolean;
  onNewChat: () => void;
}) {
  const t = useTranslations("chat");
  const tSettings = useTranslations("settings");
  const router = useRouter();

  function newChat() {
    // The thread lives in sessionStorage only; once cleared it is gone. A
    // native confirm is honest here and needs no focus-trap of its own.
    if (hasContent && !window.confirm(t("newConfirm"))) return;
    onNewChat();
  }

  return (
    <header
      className="sticky top-0 z-(--z-sticky) -mx-(--space-4) flex items-center justify-between gap-(--space-2) border-b border-border bg-background/95 px-(--space-4) py-(--space-2) backdrop-blur"
    >
      <h1 className="text-h3">{t("title")}</h1>

      <div className="flex items-center gap-(--space-1)">
        <Menu
          label={tSettings("identity")}
          actions={[
            {
              key: "handle",
              // Not an action — the handle itself, shown as the menu's first
              // line so it is visible without opening Settings.
              label: userId,
              disabled: true,
              onSelect: () => undefined,
            },
            {
              key: "settings",
              label: tSettings("title"),
              onSelect: () => router.push("/settings"),
            },
            {
              key: "switch",
              label: tSettings("switchHandle"),
              onSelect: () => router.push("/onboarding"),
            },
          ]}
        />

        <ThemeCycleButton initial={theme} />

        <IconButton label={t("new")} onClick={newChat}>
          <NotePencil
            aria-hidden="true"
            style={{ width: "var(--icon-md)", height: "var(--icon-md)" }}
          />
        </IconButton>
      </div>
    </header>
  );
}
