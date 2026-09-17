"use client";

import { useState } from "react";
import { CaretDown } from "@phosphor-icons/react/dist/ssr/CaretDown";
import { useTranslations } from "next-intl";

import type { ItemType } from "@/lib/api/types";
import { AddItemRow } from "./AddItemRow";
import { ChecklistRow } from "./ChecklistRow";
import { ProgressMeter } from "./ProgressMeter";

/**
 * One checklist section — UI_Plan.md §7.3.
 *
 * Used for both collections: `tasks` and `outing_readiness`. The two differ
 * only in their header copy, their progress label and whether items carry an
 * estimated time, so they share one component rather than diverging into two
 * that drift apart.
 */

export interface ChecklistItem {
  /**
   * The item's position in the **server document**, not in this array.
   *
   * The API addresses items by index, and the rendered list can be a subset
   * (a row hidden while its delete is in flight). Deriving the index from the
   * rendered position is trap 2 all over again — one layer up — so the index
   * travels with the item instead.
   */
  index: number;
  name: string;
  estimatedTime?: string | null;
  completed: boolean;
}

/** §7.3: the first five show, the rest hide behind "Show N more". */
export const COLLAPSE_AFTER = 5;

export function Checklist({
  itemType,
  heading,
  items,
  onToggle,
  onRename,
  onRemove,
  onAdd,
  busyIndices,
  /** Detail view shows everything; the card collapses past five (§7.6). */
  collapsible = true,
  disabled = false,
}: {
  itemType: ItemType;
  heading: string;
  items: readonly ChecklistItem[];
  onToggle: (itemType: ItemType, index: number, completed: boolean) => void;
  onRename?: (itemType: ItemType, index: number, name: string) => void;
  onRemove?: (itemType: ItemType, index: number, name: string) => void;
  onAdd?: (itemType: ItemType, name: string) => Promise<void> | void;
  busyIndices?: ReadonlySet<number>;
  collapsible?: boolean;
  disabled?: boolean;
}) {
  const t = useTranslations("plan");
  const [expanded, setExpanded] = useState(false);

  const hidden = collapsible && !expanded ? Math.max(0, items.length - COLLAPSE_AFTER) : 0;
  const visible = hidden > 0 ? items.slice(0, COLLAPSE_AFTER) : items;
  const done = items.filter((item) => item.completed).length;

  return (
    <section className="flex flex-col gap-(--space-2)">
      <div className="flex flex-wrap items-center justify-between gap-(--space-2)">
        <h3 className="text-h3">{heading}</h3>
        <ProgressMeter
          done={done}
          total={items.length}
          labelKey={itemType === "outing_readiness" ? "packed" : "done"}
        />
      </div>

      {items.length === 0 ? (
        // §12.2: an emptied list still needs a way back in.
        <p className="text-body-sm text-muted-foreground">{t("allGone")}</p>
      ) : (
        <ul className="flex flex-col">
          {visible.map((item) => (
            <ChecklistRow
              key={`${itemType}-${item.index}`}
              name={item.name}
              estimatedTime={item.estimatedTime}
              completed={item.completed}
              busy={busyIndices?.has(item.index)}
              disabled={disabled}
              onToggle={(completed) => onToggle(itemType, item.index, completed)}
              onRename={
                onRename ? (name) => onRename(itemType, item.index, name) : undefined
              }
              onRemove={onRemove ? () => onRemove(itemType, item.index, item.name) : undefined}
            />
          ))}
        </ul>
      )}

      {hidden > 0 ? (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="inline-flex min-h-11 items-center gap-(--space-1) self-end rounded-md px-(--space-2) text-body-sm text-primary hover:bg-muted"
        >
          {t("showMore", { n: hidden })}
          <CaretDown
            aria-hidden="true"
            style={{ width: "var(--icon-sm)", height: "var(--icon-sm)" }}
          />
        </button>
      ) : null}

      {onAdd ? (
        <AddItemRow
          label={t(itemType === "tasks" ? "addTask" : "addItem")}
          onAdd={(name) => onAdd(itemType, name)}
        />
      ) : null}
    </section>
  );
}
