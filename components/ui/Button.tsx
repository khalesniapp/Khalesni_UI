import type { ButtonHTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/utils/cn";
import { Spinner } from "./Spinner";

/**
 * The one button — UI_Plan.md §10, §13.
 *
 * Every variant is at least 44 px tall so it clears the touch target minimum
 * without a call site having to remember. `loading` keeps the button mounted
 * and disabled rather than swapping it for a spinner, so focus is not lost
 * mid-interaction (`loading-buttons`).
 */

export type ButtonVariant = "primary" | "secondary" | "ghost" | "destructive";
export type ButtonSize = "md" | "sm";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-primary text-on-primary hover:opacity-90",
  secondary: "border border-border-input bg-card text-foreground hover:bg-muted",
  ghost: "text-foreground hover:bg-muted",
  destructive: "bg-destructive text-on-destructive hover:opacity-90",
};

const SIZES: Record<ButtonSize, string> = {
  // 44 px minimum on both axes (§13). `sm` shrinks the padding, never the height.
  md: "min-h-11 px-(--space-4) text-body",
  sm: "min-h-11 px-(--space-3) text-body-sm",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  /** Leading icon. Decorative — give the button a text label or an `aria-label`. */
  icon?: ReactNode;
  fullWidth?: boolean;
}

export function Button({
  variant = "secondary",
  size = "md",
  loading = false,
  icon,
  fullWidth = false,
  className,
  children,
  disabled,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        "inline-flex items-center justify-center gap-(--space-2) rounded-md",
        "font-medium transition-[opacity,background-color] duration-(--dur-fast)",
        "disabled:cursor-not-allowed disabled:opacity-60",
        VARIANTS[variant],
        SIZES[size],
        fullWidth && "w-full",
        className,
      )}
      {...rest}
    >
      {loading ? <Spinner /> : icon}
      {children}
    </button>
  );
}

/**
 * Icon-only button. `label` is mandatory and becomes the accessible name —
 * §13 does not allow an unlabelled icon control anywhere in the app.
 */
export function IconButton({
  label,
  variant = "ghost",
  className,
  children,
  type = "button",
  loading = false,
  disabled,
  ...rest
}: Omit<ButtonProps, "icon" | "fullWidth" | "size"> & { label: string }) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        "inline-flex size-11 shrink-0 items-center justify-center rounded-md",
        "transition-[opacity,background-color] duration-(--dur-fast)",
        "disabled:cursor-not-allowed disabled:opacity-60",
        VARIANTS[variant],
        className,
      )}
      {...rest}
    >
      {loading ? <Spinner /> : children}
    </button>
  );
}
