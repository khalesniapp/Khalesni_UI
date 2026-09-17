"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Copy } from "@phosphor-icons/react/dist/ssr/Copy";

import { useLatestRequestId } from "@/lib/hooks/useRequestId";

/**
 * The copyable request id — UI_Plan.md §7.8, §11.4.
 *
 * "It makes any bug report actionable." The id comes from a subscription to
 * the client's ring buffer, so it appears the moment a response lands — no
 * polling, and no mismatch with the server render, which has no id at all.
 */
export function RequestIdFooter({ version }: { version: string }) {
  const t = useTranslations("settings");
  const tCommon = useTranslations("common");
  const requestId = useLatestRequestId();
  const [copied, setCopied] = useState(false);

  async function copy() {
    if (!requestId) return;
    try {
      await navigator.clipboard.writeText(requestId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be blocked by permissions; the id stays selectable.
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-(--space-3) text-caption text-muted-foreground">
      <span>{t("version", { version })}</span>
      {requestId ? (
        <>
          <span className="token-ltr">{t("requestId", { id: requestId })}</span>
          <button
            type="button"
            onClick={copy}
            className="inline-flex min-h-11 items-center gap-(--space-2) rounded-md px-(--space-2) text-primary"
          >
            <Copy
              aria-hidden="true"
              style={{ width: "var(--icon-sm)", height: "var(--icon-sm)" }}
            />
            {copied ? tCommon("copied") : tCommon("copy")}
          </button>
        </>
      ) : (
        <span>{t("noRequestId")}</span>
      )}
    </div>
  );
}
