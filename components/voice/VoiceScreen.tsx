"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Microphone } from "@phosphor-icons/react/dist/ssr/Microphone";
import { MicrophoneSlash } from "@phosphor-icons/react/dist/ssr/MicrophoneSlash";
import { Square } from "@phosphor-icons/react/dist/ssr/Square";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/Button";
import { useCapabilities } from "@/lib/hooks/useCapabilities";
import { queryKeys } from "@/lib/hooks/queryKeys";
import { useIdentity } from "@/lib/stores/identity";
import { useToasts } from "@/lib/stores/toasts";
import { startVoiceSession, type VoiceSession } from "@/lib/voice/session";
import type { VoiceCloseReason } from "@/lib/voice/events";
import { durationLabel } from "@/lib/utils/time";
import {
  appendFragment,
  closeParagraph,
  emptyTranscript,
  insertRow,
  type TranscriptState,
  type VoiceRow,
} from "@/lib/voice/transcript";
import { VoiceOrb, type OrbState } from "./VoiceOrb";
import { VoiceTranscript } from "./VoiceTranscript";

/**
 * Voice mode — UI_Plan.md §7.7.
 *
 * The session object owns the audio and the socket; this component owns the
 * screen's phase and the transcript. Nothing here re-creates the session on
 * re-render, and nothing reconnects on its own: §7.7 requires a deliberate tap
 * every time the mic opens.
 */

type Phase = "idle" | "permission" | "connecting" | "live" | "ended";

let rowCounter = 0;
const nextRowId = () => `row-${(rowCounter += 1)}`;

export function VoiceScreen() {
  const t = useTranslations("voice");
  const tPlan = useTranslations("plan");
  const router = useRouter();
  const { canUseVoice, health, loading } = useCapabilities();
  const userId = useIdentity((state) => state.userId);
  const hydrated = useIdentity((state) => state.hydrated);
  const showToast = useToasts((state) => state.show);
  const queryClient = useQueryClient();

  const [phase, setPhase] = useState<Phase>("idle");
  const [transcript, setTranscript] = useState<TranscriptState>(emptyTranscript);
  const [muted, setMuted] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [micError, setMicError] = useState<"denied" | "unavailable" | null>(null);
  const [closed, setClosed] = useState<VoiceCloseReason | null>(null);
  const [plansCreated, setPlansCreated] = useState<Array<{ id: string; title: string }>>([]);
  const [duration, setDuration] = useState(0);

  const sessionRef = useRef<VoiceSession | null>(null);
  const startedAtRef = useRef(0);
  /**
   * Set when the user leaves or ends while `startVoiceSession` is still
   * awaiting the microphone prompt.
   *
   * `getUserMedia` does not resolve until the prompt is answered, which can be
   * long after this screen is gone. Without this flag the session would resolve
   * into a ref nobody reads, and the microphone would open with nothing left to
   * close it — the recording indicator staying lit on a screen the user has
   * already navigated away from.
   */
  const abandonedRef = useRef(false);

  const appendRow = useCallback((row: VoiceRow) => {
    setTranscript((current) => insertRow(current, row));
  }, []);

  /**
   * Append a transcript fragment into the speaker's open paragraph.
   *
   * Gemini streams transcription piece by piece; without this the transcript
   * renders one word per row. See lib/voice/transcript.ts.
   */
  const appendTranscript = useCallback((role: "user" | "assistant", text: string) => {
    setTranscript((current) => appendFragment(current, role, text, nextRowId));
  }, []);

  /** End the current paragraph so the next fragment starts a fresh one. */
  const closeTranscripts = useCallback(() => {
    setTranscript(closeParagraph);
  }, []);

  /**
   * A stable reader for the orb's animation frame.
   *
   * Passing `sessionRef.current.amplitude` directly would read the ref during
   * render — and would capture `null`, because the session does not exist yet
   * on the render that mounts the orb. Reading the ref *inside* the callback
   * means each frame asks the session that exists at that moment.
   */
  const amplitude = useCallback(() => sessionRef.current?.amplitude() ?? 0, []);

  // Poll whether the assistant is speaking. Cheap, and it avoids threading an
  // extra callback through the session for a boolean that changes twice a turn.
  useEffect(() => {
    if (phase !== "live") return;

    const timer = window.setInterval(() => {
      setSpeaking(sessionRef.current?.isSpeaking() ?? false);
      setDuration(Date.now() - startedAtRef.current);
    }, 250);

    return () => window.clearInterval(timer);
  }, [phase]);

  // Releasing the mic when the screen goes away is not optional — navigating
  // off with the recording indicator still lit is the worst bug this screen
  // could have.
  useEffect(() => {
    return () => {
      abandonedRef.current = true;
      void sessionRef.current?.end();
      sessionRef.current = null;
    };
  }, []);

  async function start() {
    if (!userId || phase === "permission" || phase === "connecting" || phase === "live") return;

    setPhase("permission");
    setTranscript(emptyTranscript);
    setMicError(null);
    setClosed(null);
    setPlansCreated([]);
    setMuted(false);
    startedAtRef.current = Date.now();
    abandonedRef.current = false;
    closeTranscripts();

    try {
      const session = await startVoiceSession(userId, {
        onPermission: () => setPhase("permission"),
        // The mic resolved, so the socket is what we are waiting on now.
        onConnecting: () => setPhase("connecting"),
        onReady: () => setPhase("live"),

        onEvent: (event) => {
          switch (event.type) {
            case "transcript":
              appendTranscript(event.data.role, event.data.text);
              break;

            case "tool_started":
              // Explains the silence while the graph runs (§7.7). It also ends
              // the paragraph, so the reply that follows lands below the notice.
              closeTranscripts();
              appendRow({ id: nextRowId(), kind: "tool", name: event.data.name });
              break;

            case "plan_generated": {
              closeTranscripts();
              appendRow({ id: nextRowId(), kind: "plan", response: event.data });

              const planId = event.data.plan_id;
              showToast({
                message: t("planSaved"),
                // Hands-free is the whole point of this screen, so the plan has
                // to be one tap away rather than something to go hunting for
                // in the library afterwards. The card in the transcript carries
                // the same link; this is the version you can act on without
                // scrolling back up mid-conversation.
                ...(planId
                  ? {
                      action: {
                        label: tPlan("open"),
                        onAction: () => router.push(`/plans/${planId}`),
                      },
                    }
                  : {}),
              });

              // It was saved server-side, so the library is now stale.
              if (userId) {
                void queryClient.invalidateQueries({ queryKey: queryKeys.plansAll(userId) });
              }
              if (event.data.plan_id && event.data.plan) {
                setPlansCreated((current) => [
                  ...current,
                  { id: event.data.plan_id as string, title: event.data.plan!.title },
                ]);
              }
              break;
            }

            case "error":
              // §7.7: an inline row, and the session stays open if the socket
              // is still alive — one failed turn is not a dead session.
              appendRow({
                id: nextRowId(),
                kind: "error",
                detail: event.data.detail ?? t("genericError"),
              });
              break;

            case "turn_complete":
              // Deliberately does NOT close the paragraph. Transcription lags
              // the audio, so the tail of the reply arrives after this event;
              // breaking here put every trailing fragment on its own line. A
              // speaker change or an inserted row ends a paragraph instead —
              // the same rule the backend uses for the transcript it persists.
              break;

            case "session_ending":
              // The close event that follows is what moves the phase; this
              // just records why, while the reason is still available.
              break;

            default:
              // `interrupted` needs no transcript row — the orb reflects it and
              // the playback flush already happened inside the session. The
              // paragraph is left open on purpose: a barge-in changes speaker,
              // and the role check above starts the new paragraph anyway.
              break;
          }
        },

        onClosed: (reason) => {
          sessionRef.current = null;
          setClosed(reason);
          setPhase("ended");
        },

        onMicError: (kind) => {
          setMicError(kind);
          setPhase("idle");
        },
      });

      // Answered the prompt after we had already gone. Close it immediately
      // rather than leaving an unowned microphone open.
      if (abandonedRef.current) {
        await session.end();
        return;
      }

      sessionRef.current = session;
    } catch {
      // startVoiceSession already reported the specific cause through
      // onMicError; this just makes sure the screen leaves "connecting".
      if (phase !== "idle") setPhase("idle");
      sessionRef.current = null;
    }
  }

  async function end() {
    abandonedRef.current = true;
    await sessionRef.current?.end();
    sessionRef.current = null;
    setPhase("ended");
  }

  function toggleMute() {
    const next = !muted;
    setMuted(next);
    sessionRef.current?.setMuted(next);
  }

  /* ----------------------------------------------------------------------- */

  // §7.7: when voice is off the tab stays visible and says why. Never hide it —
  // a missing destination reads as a broken build.
  if (!loading && health && !canUseVoice) {
    return (
      <div className="flex flex-col items-start gap-(--space-4) rounded-lg border border-border bg-card p-(--space-5)">
        <p className="text-body-sm text-muted-foreground">{t("off")}</p>
        <Link
          href="/"
          className="inline-flex min-h-11 items-center rounded-md bg-primary px-(--space-4) text-body font-medium text-on-primary hover:opacity-90"
        >
          {t("backToChat")}
        </Link>
      </div>
    );
  }

  if (!hydrated || !userId) {
    return <p className="text-body-sm text-muted-foreground" role="status" />;
  }

  const orbState: OrbState =
    phase === "connecting" || phase === "permission"
      ? "connecting"
      : phase !== "live"
        ? "idle"
        : muted
          ? "muted"
          : speaking
            ? "speaking"
            : "listening";

  const statusKey =
    phase === "permission"
      ? "permission"
      : phase === "connecting"
        ? "connecting"
        : phase === "live"
          ? muted
            ? "mutedLabel"
            : speaking
              ? "speaking"
              : "listening"
          : null;

  return (
    <div className="flex flex-col gap-(--space-4) pb-(--space-7)">
      <VoiceOrb state={orbState} amplitude={amplitude} />

      {/* The state in words, not only in the orb's colour (§13). */}
      <p role="status" className="text-center text-body text-muted-foreground">
        {statusKey ? t(statusKey) : t("sub")}
      </p>

      {micError ? (
        <div className="flex flex-col items-start gap-(--space-3) rounded-lg border border-destructive/40 bg-destructive/8 p-(--space-4)">
          <p className="text-body-sm">
            {t(micError === "denied" ? "micDenied" : "micUnavailable")}
          </p>
          <Link href="/" className="text-body-sm text-primary hover:underline">
            {t("useChatInstead")}
          </Link>
        </div>
      ) : null}

      {phase === "idle" ? (
        <div className="flex flex-col items-center gap-(--space-3)">
          {/* §7.7: explain why the mic is needed *before* triggering the
              browser prompt, so the permission dialog is not a surprise. */}
          <p className="text-center text-body-sm text-muted-foreground">{t("micWhy")}</p>
          <Button
            variant="primary"
            onClick={start}
            icon={
              <Microphone
                aria-hidden="true"
                style={{ width: "var(--icon-md)", height: "var(--icon-md)" }}
              />
            }
          >
            {t("start")}
          </Button>
        </div>
      ) : null}

      {phase === "live" || transcript.rows.length > 0 ? (
        <VoiceTranscript rows={transcript.rows} />
      ) : null}

      {phase === "live" ? (
        <div className="flex justify-center gap-(--space-3)">
          <Button
            onClick={toggleMute}
            aria-pressed={muted}
            icon={
              muted ? (
                <MicrophoneSlash
                  aria-hidden="true"
                  style={{ width: "var(--icon-md)", height: "var(--icon-md)" }}
                />
              ) : (
                <Microphone
                  aria-hidden="true"
                  style={{ width: "var(--icon-md)", height: "var(--icon-md)" }}
                />
              )
            }
          >
            {t(muted ? "unmute" : "mute")}
          </Button>

          <Button
            variant="destructive"
            onClick={end}
            icon={
              <Square
                aria-hidden="true"
                weight="fill"
                style={{ width: "var(--icon-sm)", height: "var(--icon-sm)" }}
              />
            }
          >
            {t("end")}
          </Button>
        </div>
      ) : null}

      {/* §7.7's session summary. */}
      {phase === "ended" ? (
        <div className="flex flex-col items-start gap-(--space-3) rounded-lg border border-border bg-card p-(--space-4)">
          <p className="text-body">{t("ended", { duration: durationLabel(duration) })}</p>

          {closed && closed !== "ended" ? (
            <p className="text-body-sm text-warning">
              {t(closed === "busy" ? "busy" : "badHandle")}
            </p>
          ) : null}

          {plansCreated.length > 0 ? (
            <div className="flex flex-col gap-(--space-2)">
              <p className="text-body-sm text-muted-foreground">
                {t("plansCreated", { count: plansCreated.length })}
              </p>
              {plansCreated.map((plan) => (
                <Link
                  key={plan.id}
                  href={`/plans/${plan.id}`}
                  className="inline-flex min-h-11 items-center rounded-md border border-border-input px-(--space-3) text-body-sm hover:bg-muted"
                >
                  {plan.title}
                </Link>
              ))}
            </div>
          ) : null}

          <div className="flex flex-wrap gap-(--space-2)">
            <Button variant="primary" onClick={start}>
              {t("startAgain")}
            </Button>
            <Link
              href="/"
              className="inline-flex min-h-11 items-center rounded-md border border-border-input px-(--space-4) text-body-sm hover:bg-muted"
            >
              {t("backToChat")}
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
