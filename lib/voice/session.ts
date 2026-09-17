import { API_BASE } from "@/lib/api/client";
import { startCapture, MicError, type Capture } from "./capture";
import { createPlayback, type Playback } from "./playback";
import { closeReason, parseVoiceEvent, type VoiceCloseReason, type VoiceEvent } from "./events";

/**
 * One voice session — UI_Plan.md §7.7, §11.6.
 *
 * Deliberately not a React hook: it owns a WebSocket, an AudioContext, a
 * worklet and a media stream, none of which should be re-created because a
 * component re-rendered. The screen drives it imperatively and subscribes to
 * events.
 *
 * Two rules from the spec that are structural rather than cosmetic:
 *
 * 1. **No auto-reconnect.** "A silently reopened mic is a privacy problem.
 *    Always require a tap." So a closed socket is terminal; the UI offers a
 *    button and nothing reconnects on its own.
 * 2. **Audio is not sent before `ready`.** The backend's own reference client
 *    gates the mic on that event, and chunks sent earlier are discarded — which
 *    would silently eat the first second of the first sentence.
 */

/** §7.7: the connect phase gets 10 seconds before it is called a failure. */
export const CONNECT_TIMEOUT_MS = 10_000;

export interface VoiceSessionHandlers {
  onEvent: (event: VoiceEvent) => void;
  /** Socket closed — terminal. `code` is mapped for copy, kept for logging. */
  onClosed: (reason: VoiceCloseReason, code: number) => void;
  onMicError: (kind: "denied" | "unavailable") => void;
  /** Connecting → ready, so the orb can stop pulsing grey. */
  onReady: (sessionId: string) => void;
  /**
   * The mic prompt is up and we are waiting on the user.
   *
   * §7.7 lists Permission and Connecting as separate phases, and they really
   * are: `getUserMedia` does not resolve until someone answers the browser's
   * prompt, and it has no timeout. Labelling that wait "Connecting…" leaves an
   * unanswered prompt looking like a hung server.
   */
  onPermission?: () => void;
  /** The mic is open; we are now waiting on the socket and the model. */
  onConnecting?: () => void;
}

export interface VoiceSession {
  /** Mic amplitude while listening, playback amplitude while speaking. */
  amplitude: () => number;
  isSpeaking: () => boolean;
  setMuted: (muted: boolean) => void;
  /** Send a typed message instead of speaking (§7.7's `text` frame). */
  sendText: (text: string) => void;
  /** Graceful end: tells the server, then tears down. */
  end: () => Promise<void>;
}

function socketUrl(userId: string): string {
  const base = API_BASE.replace(/^http/, "ws");
  return `${base}/api/voice/ws?user_id=${encodeURIComponent(userId)}`;
}

export async function startVoiceSession(
  userId: string,
  handlers: VoiceSessionHandlers,
): Promise<VoiceSession> {
  const playback: Playback = createPlayback();

  let capture: Capture | null = null;
  let socket: WebSocket | null = null;
  let ready = false;
  let closed = false;

  async function teardown() {
    if (closed) return;
    closed = true;
    await capture?.stop();
    capture = null;
    await playback.close();
  }

  // The mic is opened first, on purpose: if permission is refused there is no
  // point holding a session open on the server, and 1013 would then block the
  // retry that follows the user fixing their settings.
  handlers.onPermission?.();

  try {
    capture = await startCapture((chunk) => {
      // Before `ready` the server is still negotiating with the model and
      // drops what it receives, so there is nothing to gain by sending.
      if (ready && socket?.readyState === WebSocket.OPEN) socket.send(chunk);
    });
  } catch (cause) {
    await playback.close();
    if (cause instanceof MicError) {
      handlers.onMicError(cause.kind);
      throw cause;
    }
    throw cause;
  }

  // Permission is settled — from here the wait is the server's, and the 10 s
  // timeout below applies to it.
  handlers.onConnecting?.();

  socket = new WebSocket(socketUrl(userId));
  socket.binaryType = "arraybuffer";

  const connectTimer = window.setTimeout(() => {
    if (!ready) {
      // Closing with 1000 rather than leaving it hanging: the server should
      // release the single-session lock so a retry is not met with 1013.
      socket?.close(1000, "connect timeout");
    }
  }, CONNECT_TIMEOUT_MS);

  socket.onmessage = (message) => {
    if (message.data instanceof ArrayBuffer) {
      playback.push(message.data);
      return;
    }
    if (typeof message.data !== "string") return;

    const event = parseVoiceEvent(message.data);
    // Unknown or malformed events are ignored, not fatal — the backend may add
    // types and a live session must survive that.
    if (!event) return;

    if (event.type === "ready") {
      ready = true;
      window.clearTimeout(connectTimer);
      handlers.onReady(event.data.session_id);
    }

    // Barge-in. Flushed here, before the event reaches React, so the audio
    // stops on the socket callback rather than one render later.
    if (event.type === "interrupted") playback.flush();

    handlers.onEvent(event);
  };

  socket.onclose = (event) => {
    window.clearTimeout(connectTimer);
    void teardown();
    handlers.onClosed(closeReason(event.code), event.code);
  };

  socket.onerror = () => {
    // `onerror` carries no useful detail in browsers and is always followed by
    // `onclose`, which is where the reason actually is.
  };

  return {
    amplitude: () => (playback.isSpeaking() ? playback.amplitude() : (capture?.amplitude() ?? 0)),
    isSpeaking: () => playback.isSpeaking(),
    setMuted: (muted) => capture?.setMuted(muted),

    sendText: (text) => {
      const trimmed = text.trim();
      if (!trimmed || socket?.readyState !== WebSocket.OPEN) return;
      socket.send(JSON.stringify({ type: "text", text: trimmed }));
    },

    end: async () => {
      window.clearTimeout(connectTimer);
      if (socket?.readyState === WebSocket.OPEN) {
        // Ask the server to wind the session down before dropping the socket,
        // so it can release the per-user lock cleanly.
        socket.send(JSON.stringify({ type: "stop" }));
        socket.close(1000, "user ended");
      }
      await teardown();
    },
  };
}
