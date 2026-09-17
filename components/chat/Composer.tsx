"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { Microphone } from "@phosphor-icons/react/dist/ssr/Microphone";
import { PaperPlaneRight } from "@phosphor-icons/react/dist/ssr/PaperPlaneRight";
import { Plus } from "@phosphor-icons/react/dist/ssr/Plus";
import { Square } from "@phosphor-icons/react/dist/ssr/Square";
import { useTranslations } from "next-intl";

import { IconButton } from "@/components/ui/Button";
import { PROMPT_COUNTER_FROM, PROMPT_MAX } from "@/lib/api/types";
import { cn } from "@/lib/utils/cn";
import { ContextTray } from "./ContextTray";
import type { Mood } from "./moods";

/**
 * The composer — UI_Plan.md §7.2.4.
 *
 * Three behaviours worth stating outright:
 *
 * 1. Enter sends on a mouse-and-keyboard machine and inserts a newline on a
 *    touch one. Losing someone's paragraph to a stray Enter on a phone keyboard
 *    is unrecoverable, so the rule is decided by pointer type, not by width.
 * 2. The textarea grows from one row to six and then scrolls internally, so a
 *    long paste never pushes the thread off screen.
 * 3. The draft is autosaved on every keystroke (debounced) — the parent owns
 *    the store write, this component just reports the value.
 */

const MAX_ROWS = 6;
const DRAFT_DEBOUNCE_MS = 300;

export function Composer({
  value,
  onChange,
  onSubmit,
  onStop,
  generating,
  mood,
  location,
  onMoodChange,
  onLocationChange,
  voiceEnabled,
  /** Imperative focus target, so "Edit message" can put the cursor back here. */
  inputRef,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onStop: () => void;
  generating: boolean;
  mood: Mood;
  location: string | null;
  onMoodChange: (mood: Mood) => void;
  onLocationChange: (location: string | null) => void;
  voiceEnabled: boolean;
  inputRef?: React.RefObject<HTMLTextAreaElement | null>;
}) {
  const t = useTranslations("chat");
  const tContext = useTranslations("context");
  const tVoice = useTranslations("nav");

  const localRef = useRef<HTMLTextAreaElement>(null);
  const textarea = inputRef ?? localRef;
  const [trayOpen, setTrayOpen] = useState(false);

  // Auto-grow. Measured before paint so the box never renders at the wrong
  // height for a frame, which would show up as layout shift (§15).
  useLayoutEffect(() => {
    const element = textarea.current;
    if (!element) return;

    element.style.height = "auto";
    const lineHeight = Number.parseFloat(getComputedStyle(element).lineHeight) || 24;
    const padding = element.offsetHeight - element.clientHeight;
    const max = lineHeight * MAX_ROWS + padding;

    element.style.height = `${Math.min(element.scrollHeight, max)}px`;
    element.style.overflowY = element.scrollHeight > max ? "auto" : "hidden";
  }, [value, textarea]);

  const trimmed = value.trim();
  const canSend = trimmed.length > 0 && !generating;
  const showCounter = value.length >= PROMPT_COUNTER_FROM;
  const overLimit = value.length >= PROMPT_MAX;

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey) return;

    // A coarse pointer means a touch keyboard, where Enter is "new line" and
    // Send is a deliberate tap.
    const touch =
      typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;
    if (touch) return;

    event.preventDefault();
    if (canSend) onSubmit();
  }

  return (
    <div className="flex flex-col gap-(--space-2)">
      {trayOpen ? (
        <ContextTray
          mood={mood}
          location={location}
          onMoodChange={onMoodChange}
          onLocationChange={onLocationChange}
        />
      ) : null}

      <div className="flex items-end gap-(--space-2)">
        <div
          className={cn(
            "flex min-w-0 flex-1 items-end gap-(--space-1) rounded-xl border bg-card p-(--space-2)",
            overLimit ? "border-destructive" : "border-border-input",
          )}
          style={{ boxShadow: "var(--shadow-2)" }}
        >
          <IconButton
            label={trayOpen ? tContext("close") : tContext("open")}
            aria-expanded={trayOpen}
            onClick={() => setTrayOpen((open) => !open)}
            className="size-11"
          >
            <Plus
              aria-hidden="true"
              className={cn(
                "transition-transform duration-(--dur-fast)",
                trayOpen && "rotate-45",
              )}
              style={{ width: "var(--icon-md)", height: "var(--icon-md)" }}
            />
          </IconButton>

          <textarea
            ref={textarea}
            rows={1}
            value={value}
            onChange={(event) => onChange(event.target.value.slice(0, PROMPT_MAX))}
            onKeyDown={handleKeyDown}
            placeholder={t("placeholder")}
            aria-label={t("placeholder")}
            maxLength={PROMPT_MAX}
            className={cn(
              "min-h-11 min-w-0 flex-1 resize-none bg-transparent py-(--space-2) text-body",
              // 16 px exactly: anything smaller makes iOS zoom the viewport on
              // focus and never zoom back out (§14).
              "placeholder:text-muted-foreground focus:outline-none",
            )}
          />

          {generating ? (
            <IconButton label={t("stop")} variant="primary" onClick={onStop}>
              <Square
                aria-hidden="true"
                weight="fill"
                style={{ width: "var(--icon-sm)", height: "var(--icon-sm)" }}
              />
            </IconButton>
          ) : (
            <IconButton
              label={t("send")}
              variant="primary"
              disabled={!canSend}
              onClick={onSubmit}
            >
              <PaperPlaneRight
                aria-hidden="true"
                weight="fill"
                className="icon-directional"
                style={{ width: "var(--icon-md)", height: "var(--icon-md)" }}
              />
            </IconButton>
          )}
        </div>

        {/* §7.2.4: the mic navigates to the voice surface, it does not record
            inline — one voice surface, not two. */}
        {voiceEnabled ? (
          <Link
            href="/voice"
            aria-label={tVoice("voice")}
            title={tVoice("voice")}
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-full border border-border-input bg-card text-muted-foreground hover:bg-muted"
          >
            <Microphone
              aria-hidden="true"
              style={{ width: "var(--icon-md)", height: "var(--icon-md)" }}
            />
          </Link>
        ) : null}
      </div>

      {showCounter ? (
        <p
          className={cn(
            "tnum self-end text-caption",
            overLimit ? "text-destructive" : "text-muted-foreground",
          )}
          // Announced only when it starts mattering, and politely — a counter
          // that interrupts every keystroke is unusable with a screen reader.
          aria-live="polite"
        >
          {value.length} / {PROMPT_MAX}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Debounced draft persistence (§7.2.4, `form-autosave`).
 *
 * Kept out of the component so the textarea re-renders on every keystroke
 * without the store doing the same — the write lands 300 ms after typing stops.
 */
export function useDraftAutosave(value: string, save: (value: string) => void) {
  const saveRef = useRef(save);

  // Written in an effect, not during render: a ref mutation during render is
  // a side effect, and it would also be wrong under Strict Mode's double
  // invocation.
  useEffect(() => {
    saveRef.current = save;
  });

  useEffect(() => {
    const timer = window.setTimeout(() => saveRef.current(value), DRAFT_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [value]);
}
