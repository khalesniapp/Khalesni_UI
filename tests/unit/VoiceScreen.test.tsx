import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import messages from "@/messages/en.json";
import type { VoiceSessionHandlers } from "@/lib/voice/session";

/**
 * Does the voice screen actually assemble fragments into a paragraph?
 *
 * `tests/unit/transcript.test.ts` proves the pure reducer does. This proves the
 * component wired to it does too — the reducer passing while the screen still
 * rendered one word per row is exactly the gap that let this bug survive a fix.
 */

const startVoiceSession = vi.hoisted(() => vi.fn());

vi.mock("@/lib/voice/session", () => ({ startVoiceSession }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock("@/lib/hooks/useCapabilities", () => ({
  useCapabilities: () => ({
    health: { voice_enabled: true },
    canUseVoice: true,
    loading: false,
    unreachable: false,
  }),
}));

import { VoiceScreen } from "@/components/voice/VoiceScreen";
import { useIdentity } from "@/lib/stores/identity";

beforeAll(() => {
  // jsdom implements neither of these; the orb asks matchMedia about
  // prefers-reduced-motion and the transcript scrolls itself into view.
  Element.prototype.scrollIntoView = () => undefined;

  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      onchange: null,
      dispatchEvent: () => false,
    }),
  });
});

afterEach(() => {
  cleanup();
  startVoiceSession.mockReset();
});

function renderScreen() {
  useIdentity.setState({ userId: "demo-user", hydrated: true });

  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="en" messages={messages}>
        <VoiceScreen />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

/** Start a session and hand back the handlers the screen registered. */
async function startAndCaptureHandlers(): Promise<VoiceSessionHandlers> {
  let captured: VoiceSessionHandlers | null = null;

  startVoiceSession.mockImplementation(async (_userId: string, handlers: VoiceSessionHandlers) => {
    captured = handlers;
    handlers.onPermission?.();
    handlers.onConnecting?.();
    handlers.onReady("session-1");
    return {
      amplitude: () => 0,
      isSpeaking: () => false,
      setMuted: () => undefined,
      sendText: () => undefined,
      end: async () => undefined,
    };
  });

  renderScreen();
  await userEvent.click(screen.getByRole("button", { name: /start talking/i }));
  await waitFor(() => expect(captured).not.toBeNull());

  return captured as unknown as VoiceSessionHandlers;
}

const fragment = (role: "user" | "assistant", text: string) =>
  ({ type: "transcript", data: { role, text } }) as const;

describe("VoiceScreen transcript", () => {
  it("renders one paragraph for a reply that arrives in fragments", async () => {
    const handlers = await startAndCaptureHandlers();

    // The exact shape Gemini streams — 2-3 word chunks, contiguous, one role.
    for (const piece of ["Sure, I", " can check", " that for", " you."]) {
      handlers.onEvent(fragment("assistant", piece));
    }

    await waitFor(() => {
      expect(screen.getByText("Sure, I can check that for you.")).toBeTruthy();
    });
  });

  it("keeps the tail of a reply in the same paragraph across a turn boundary", async () => {
    const handlers = await startAndCaptureHandlers();

    handlers.onEvent(fragment("assistant", "Okay, Beirut tomorrow"));
    handlers.onEvent({ type: "turn_complete" } as never);
    // Transcription lags the audio, so the rest lands after turn_complete.
    handlers.onEvent(fragment("assistant", " between 10 AM and 5 PM."));

    await waitFor(() => {
      expect(screen.getByText("Okay, Beirut tomorrow between 10 AM and 5 PM.")).toBeTruthy();
    });
  });

  it("still starts a new paragraph when the speaker changes", async () => {
    const handlers = await startAndCaptureHandlers();

    handlers.onEvent(fragment("user", "what's the weather"));
    handlers.onEvent(fragment("assistant", "Where will you be?"));

    await waitFor(() => {
      expect(screen.getByText("what's the weather")).toBeTruthy();
      expect(screen.getByText("Where will you be?")).toBeTruthy();
    });
  });
});
