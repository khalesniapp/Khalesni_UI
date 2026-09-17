"use client";

import { useState } from "react";
import { WarningCircle } from "@phosphor-icons/react/dist/ssr/WarningCircle";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils/cn";

/**
 * A failed turn, inline in the thread — UI_Plan.md §12.3.
 *
 * Every error states a cause and a way forward, and it lives where the work
 * was rather than in a toast that scrolls away. The copy is chosen by HTTP
 * status, never by matching the `detail` text: message copy changes upstream,
 * status codes are the contract (§11.4).
 *
 * The request id is what makes a report actionable, so "Copy details" puts the
 * status, detail, id and timestamp on the clipboard in one go.
 */

/** §12.3's table, keyed by status. Anything unlisted falls back to the generic 500 copy. */
function messageKeyFor(status: number): "generate" | "timeout" | "offline" | "server" {
  if (status === 0) return "offline";
  if (status === 504 || status === 408) return "timeout";
  if (status === 502 || status === 503) return "generate";
  return "server";
}

export function ErrorCard({
  status,
  detail,
  requestId,
  onRetry,
  onEdit,
  retrying = false,
}: {
  status: number;
  detail: string;
  requestId: string | null;
  onRetry?: () => void;
  /** Puts the failed prompt back in the composer (§12.3). */
  onEdit?: () => void;
  retrying?: boolean;
}) {
  const t = useTranslations("error");
  const tCommon = useTranslations("common");
  const [copied, setCopied] = useState(false);

  async function copyDetails() {
    const text = [
      `status: ${status}`,
      `detail: ${detail}`,
      `request id: ${requestId ?? "none"}`,
      `time: ${new Date().toISOString()}`,
    ].join("\n");

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard permission can be denied outright; the id stays visible and
      // selectable below, so there is still a way to report the failure.
    }
  }

  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col gap-(--space-3) rounded-lg border p-(--space-4)",
        "border-destructive/40 bg-destructive/8",
      )}
    >
      <p className="flex items-start gap-(--space-2) text-body-sm">
        <WarningCircle
          aria-hidden="true"
          weight="fill"
          className="mt-0.5 shrink-0 text-destructive"
          style={{ width: "var(--icon-md)", height: "var(--icon-md)" }}
        />
        {t(messageKeyFor(status))}
      </p>

      <div className="flex flex-wrap gap-(--space-2)">
        {onRetry ? (
          <Button size="sm" variant="primary" onClick={onRetry} loading={retrying}>
            {t("retry")}
          </Button>
        ) : null}

        {onEdit ? (
          <Button size="sm" onClick={onEdit}>
            {t("edit")}
          </Button>
        ) : null}

        <Button size="sm" variant="ghost" onClick={copyDetails}>
          {copied ? tCommon("copied") : t("copyDetails")}
        </Button>
      </div>

      {requestId ? (
        // Selectable, LTR-isolated: an id is a machine token and must not
        // reorder inside an Arabic paragraph (§9).
        <p className="token-ltr text-caption text-muted-foreground">{requestId}</p>
      ) : null}
    </div>
  );
}
