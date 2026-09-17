"use client";

import { cn } from "@/lib/utils/cn";

/**
 * A small segmented control for the two- and three-way choices in Settings
 * (§7.8: Language, Theme).
 *
 * Built on real radio inputs rather than styled buttons so arrow-key roving
 * focus, screen-reader grouping and form semantics come from the platform
 * (§13). The input is visually hidden but never `display: none`, which would
 * take it out of the focus order.
 */
export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

export function SegmentedControl<T extends string>({
  name,
  legend,
  value,
  options,
  onChange,
  disabled,
}: {
  name: string;
  legend: string;
  value: T;
  options: readonly SegmentedOption<T>[];
  onChange: (value: T) => void;
  disabled?: boolean;
}) {
  return (
    <fieldset disabled={disabled} className="min-w-0">
      <legend className="sr-only">{legend}</legend>
      <div className="flex rounded-md bg-muted p-1">
        {options.map((option) => {
          const checked = option.value === value;
          return (
            <label
              key={option.value}
              className={cn(
                "flex min-h-11 flex-1 cursor-pointer items-center justify-center rounded-sm px-(--space-3)",
                "text-label whitespace-nowrap transition-colors duration-(--dur-fast)",
                "has-[:focus-visible]:outline has-[:focus-visible]:outline-2",
                "has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-(--color-ring)",
                checked
                  ? "bg-card font-medium text-primary"
                  : "text-muted-foreground hover:text-foreground",
                disabled && "cursor-not-allowed opacity-60",
              )}
              style={checked ? { boxShadow: "var(--shadow-1)" } : undefined}
            >
              <input
                type="radio"
                name={name}
                value={option.value}
                checked={checked}
                onChange={() => onChange(option.value)}
                className="sr-only"
              />
              {option.label}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
