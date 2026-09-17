"use client";

import { useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/Button";
import { isValidUserId, normaliseUserId, useIdentity } from "@/lib/stores/identity";
import { cn } from "@/lib/utils/cn";

/**
 * First run — UI_Plan.md §7.1. One screen, one field.
 *
 * There is no auth on the backend: `user_id` is trusted as sent. So this is a
 * handle, not an account, and the footnote says exactly that rather than
 * implying a login (§11.1). Softening it would be a trust bug.
 */
export function OnboardingForm() {
  const t = useTranslations("onboarding");
  const router = useRouter();
  const setUserId = useIdentity((state) => state.setUserId);

  const inputId = useId();
  const helpId = useId();
  const errorId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  const [value, setValue] = useState("");
  const [error, setError] = useState<"invalid" | "required" | null>(null);

  const normalised = normaliseUserId(value);
  // "Saved as `nour`" only earns its place once the two actually differ.
  const showNormalised = normalised.length > 0 && normalised !== value;

  function validate(): boolean {
    if (normalised.length === 0) {
      setError("required");
      return false;
    }
    if (!isValidUserId(normalised)) {
      setError("invalid");
      return false;
    }
    setError(null);
    return true;
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!validate()) {
      inputRef.current?.focus();
      return;
    }
    setUserId(normalised);
    router.replace("/");
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-(--space-4)" noValidate>
      <div className="flex flex-col gap-(--space-2)">
        <label htmlFor={inputId} className="text-label">
          {t("name")}
        </label>

        <input
          id={inputId}
          ref={inputRef}
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            // §7.1: validate on blur, not per keystroke. Typing only ever
            // clears an existing error — it never raises a new one mid-word.
            if (error) setError(null);
          }}
          // §7.1 validates on blur so the message arrives once the thought is finished.
          onBlur={() => {
            if (value.length > 0) validate();
          }}
          autoFocus
          inputMode="text"
          autoCapitalize="none"
          autoComplete="username"
          autoCorrect="off"
          spellCheck={false}
          maxLength={128}
          aria-describedby={cn(helpId, error ? errorId : null)}
          aria-invalid={error ? true : undefined}
          className={cn(
            "min-h-11 w-full rounded-sm border bg-card px-(--space-3) text-body",
            // 16 px keeps iOS from zooming the viewport on focus (§14).
            "placeholder:text-muted-foreground",
            error ? "border-destructive" : "border-border-input",
          )}
        />

        <p id={helpId} className="text-caption text-muted-foreground">
          {showNormalised ? t("savedAs", { handle: normalised }) : t("hint")}
        </p>

        {error ? (
          <p id={errorId} role="alert" className="text-caption text-destructive">
            {t(error === "required" ? "required" : "invalid")}
          </p>
        ) : null}
      </div>

      <Button type="submit" variant="primary" fullWidth>
        {t("start")}
      </Button>

      {/* §7.1: warn honestly. This handle is shared by anyone who types it. */}
      <p className="text-caption text-muted-foreground">{t("shared")}</p>
    </form>
  );
}
