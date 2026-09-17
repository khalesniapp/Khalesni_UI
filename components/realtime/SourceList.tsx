import { ArrowSquareOut } from "@phosphor-icons/react/dist/ssr/ArrowSquareOut";
import { useTranslations } from "next-intl";

import type { RealtimeAnswer } from "@/lib/api/types";
import { domainOf, safeHttpUrl } from "@/lib/utils/text";

/**
 * Citations for a live-web answer — UI_Plan.md §7.5.
 *
 * Always rendered, never collapsed: the answer came off the open web minutes
 * ago and the citation is the only thing making it checkable. When the list is
 * empty the footer says so in words rather than showing an empty heading.
 *
 * `title` when present, otherwise the bare domain — a URL is not a label.
 */
export function SourceList({ sources }: { sources: RealtimeAnswer["sources"] }) {
  const t = useTranslations("realtime");

  if (sources.length === 0) {
    return <p className="text-caption text-muted-foreground">{t("noSources")}</p>;
  }

  return (
    <section className="flex flex-col gap-(--space-2) border-t border-border pt-(--space-3)">
      <h3 className="text-overline uppercase text-muted-foreground">{t("sources")}</h3>

      <ol className="flex flex-col">
        {sources.map((source, index) => {
          const href = safeHttpUrl(source.url);
          const label = source.title?.trim() || domainOf(source.url);

          // A source we cannot safely link (javascript:, data:, malformed) is
          // still evidence — it renders as plain text rather than disappearing.
          if (!href) {
            return (
              <li key={`${source.url}-${index}`} className="py-(--space-1) text-body-sm">
                <span className="tnum me-(--space-2) text-muted-foreground">{index + 1}.</span>
                {label}
              </li>
            );
          }

          return (
            <li key={`${source.url}-${index}`}>
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-h-11 items-center gap-(--space-2) rounded-md px-(--space-1) text-body-sm hover:bg-muted"
              >
                <span className="tnum shrink-0 text-muted-foreground">{index + 1}.</span>
                <span className="min-w-0 flex-1 truncate">{label}</span>
                <ArrowSquareOut
                  aria-hidden="true"
                  className="shrink-0 text-muted-foreground"
                  style={{ width: "var(--icon-sm)", height: "var(--icon-sm)" }}
                />
              </a>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
