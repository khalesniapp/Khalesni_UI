"use client";

import { useEffect, useRef } from "react";

import { cn } from "@/lib/utils/cn";

/**
 * The orb — UI_Plan.md §7.7.
 *
 * It is the only indication that the microphone is live, so it has to react
 * immediately and continuously. The amplitude is read on an animation frame
 * from a callback rather than through React state: a 60 fps `setState` would
 * re-render the whole screen sixty times a second for one number.
 *
 * Only `transform` and `opacity` are animated (§8.5), so the scaling never
 * touches layout.
 *
 * Colour alone does not carry the state — the label beneath it says
 * "Listening…" or "Khalesni is speaking" in words (§13, `color-not-only`).
 */
export type OrbState = "idle" | "connecting" | "listening" | "speaking" | "muted";

export function VoiceOrb({
  state,
  amplitude,
}: {
  state: OrbState;
  /** Polled, not passed: called on each frame for the current 0–1 level. */
  amplitude?: () => number;
}) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!amplitude || state === "idle" || state === "connecting") return;

    // Respect reduced motion: the orb still changes colour and the label still
    // changes, so nothing is lost by holding it still (§8.5).
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;

    let frame = 0;
    let current = 1;

    const tick = () => {
      const level = Math.min(1, amplitude() * 3);
      // Ease towards the target so a sharp consonant does not snap the orb.
      const target = 1 + level * 0.28;
      current += (target - current) * 0.25;

      if (ref.current) ref.current.style.transform = `scale(${current.toFixed(3)})`;
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [amplitude, state]);

  return (
    <div className="grid place-items-center py-(--space-6)">
      <span
        ref={ref}
        aria-hidden="true"
        className={cn(
          "block size-32 rounded-full transition-colors duration-(--dur-base)",
          "will-change-transform",
          state === "idle" && "bg-muted",
          state === "connecting" && "bg-muted motion-safe:animate-pulse",
          state === "listening" && "bg-primary",
          // §7.7: the assistant's turn is the accent colour, a different hue
          // from the user's, so the two turns are never confusable.
          state === "speaking" && "bg-accent",
          state === "muted" && "bg-muted-foreground/40",
        )}
      />
    </div>
  );
}
