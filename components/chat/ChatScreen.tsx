"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown } from "@phosphor-icons/react/dist/ssr/ArrowDown";
import { useTranslations } from "next-intl";

import { useCapabilities } from "@/lib/hooks/useCapabilities";
import { useGeneratePlan } from "@/lib/hooks/useGeneratePlan";
import { useIdentity } from "@/lib/stores/identity";
import { usePrefs } from "@/lib/stores/prefs";
import { useThread, type MessageId } from "@/lib/stores/thread";
import type { Theme } from "@/lib/theme";
import { greetingSlot } from "@/lib/utils/time";
import { ChatHeader } from "./ChatHeader";
import { Composer, useDraftAutosave } from "./Composer";
import { ContextChips } from "./ContextChips";
import { EmptyState } from "./EmptyState";
import { Thread } from "./Thread";
import { useAtBottom } from "./useAtBottom";
import { DEFAULT_MOOD, isMood, type Mood } from "./moods";
import type { LocationAnswer } from "./locationAnswer";

/**
 * Home — UI_Plan.md §7.2.
 *
 * The one client component that owns the chat screen's state. Everything below
 * it is presentational or self-contained: this is where the stores, the send
 * hook and the composer's local draft meet.
 *
 * Identity is checked here rather than in a route guard, because the handle
 * lives in `localStorage` and is therefore unknowable on the server — a guard
 * would either flash the wrong screen or force the whole route to be dynamic.
 */
export function ChatScreen({ theme }: { theme: Theme }) {
  const router = useRouter();

  const userId = useIdentity((state) => state.userId);
  const identityHydrated = useIdentity((state) => state.hydrated);

  const moodPref = usePrefs((state) => state.mood);
  const location = usePrefs((state) => state.location);
  const setMood = usePrefs((state) => state.setMood);
  const setLocation = usePrefs((state) => state.setLocation);

  const messages = useThread((state) => state.messages);
  const generating = useThread((state) => state.generating);
  const storedDraft = useThread((state) => state.draft);
  const threadHydrated = useThread((state) => state.hydrated);
  const setStoredDraft = useThread((state) => state.setDraft);
  const clearThread = useThread((state) => state.clear);
  const dropMessage = useThread((state) => state.dropMessage);

  const { canUseVoice, canSearchPlaces, health } = useCapabilities();
  const { send, stop } = useGeneratePlan();
  const { atBottom, scrollToBottom } = useAtBottom();
  const t = useTranslations("chat");

  const [draft, setDraft] = useState("");
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const mood: Mood = isMood(moodPref) ? moodPref : DEFAULT_MOOD;

  // No handle yet → first run. `replace`, not `push`: onboarding is not a step
  // anyone should be able to go "back" into from the chat.
  useEffect(() => {
    if (identityHydrated && !userId) router.replace("/onboarding");
  }, [identityHydrated, userId, router]);

  // Adopt the persisted draft once, after rehydration. Seeding `useState`
  // directly would be a hydration mismatch — the server renders an empty box —
  // and an effect would be a render-then-correct flash. Adjusting state during
  // render is React's own answer to "derive from a prop/store change": the
  // component re-runs before anything is committed to the DOM.
  const [adoptedDraft, setAdoptedDraft] = useState(false);
  if (threadHydrated && !adoptedDraft) {
    setAdoptedDraft(true);
    if (storedDraft) setDraft(storedDraft);
  }

  useDraftAutosave(draft, setStoredDraft);

  const greeting = useMemo(() => greetingSlot(), []);

  function submit() {
    const prompt = draft.trim();
    if (!prompt || generating) return;
    setDraft("");
    setStoredDraft("");
    void send(prompt);
  }

  /** Retry re-sends an existing user message rather than duplicating it (§12.3). */
  function retry(promptMessageId: MessageId) {
    const state = useThread.getState();
    const prompt = state.messages.find(
      (message) => message.id === promptMessageId && message.role === "user",
    );
    if (!prompt || prompt.role !== "user") return;

    // Drop the failed or stopped turn that followed it — a retry replaces the
    // outcome, it does not append a second one below the first.
    const failed = state.messages.find(
      (message) =>
        message.role === "assistant" &&
        message.kind !== "response" &&
        message.promptMessageId === promptMessageId,
    );
    if (failed) dropMessage(failed.id);

    void send(prompt.content, { resendMessageId: promptMessageId });
  }

  /** "Edit message" pulls the prompt back into the composer and removes the turn. */
  function edit(promptMessageId: MessageId) {
    const state = useThread.getState();
    const prompt = state.messages.find((message) => message.id === promptMessageId);
    if (!prompt || prompt.role !== "user") return;

    const failed = state.messages.find(
      (message) =>
        message.role === "assistant" &&
        message.kind !== "response" &&
        message.promptMessageId === promptMessageId,
    );
    if (failed) dropMessage(failed.id);
    dropMessage(promptMessageId);

    setDraft(prompt.content);
    composerRef.current?.focus();
  }

  /**
   * Finds the user message a given assistant turn was answering, plus the
   * assistant turn itself — both are needed to resend a prompt in place.
   */
  function turnFor(promptMessageId: MessageId) {
    const { messages: current } = useThread.getState();
    const prompt = current.find(
      (message) => message.id === promptMessageId && message.role === "user",
    );
    const answer = current.find(
      (message) => message.role === "assistant" && message.promptMessageId === promptMessageId,
    );
    return { prompt: prompt?.role === "user" ? prompt : null, answer };
  }

  /** §5.4: the location handshake. Each branch is a different request shape. */
  function answerLocation(promptMessageId: MessageId, answer: LocationAnswer) {
    // A typed area is a new message with history — the sentence may carry more
    // than a location, and the backend is the one that extracts the place name.
    if (answer.kind === "typed") {
      void send(answer.value);
      return;
    }

    const { prompt, answer: previous } = turnFor(promptMessageId);
    if (!prompt) return;

    // The question has been answered, so the card that asked it goes away.
    if (previous) dropMessage(previous.id);

    if (answer.kind === "coords") {
      // Remember it: the response will come back with the cleaned name, which
      // replaces these coordinates in the chip (§5.3).
      setLocation(answer.value);
      void send(prompt.content, {
        resendMessageId: promptMessageId,
        location: answer.value,
      });
      return;
    }

    // "Not now" → a plan with no venues, and we stop asking for this turn.
    void send(prompt.content, {
      resendMessageId: promptMessageId,
      askLocation: false,
      location: null,
    });
  }

  /**
   * §7.4: "Try a wider area" re-asks with the city rather than the
   * neighbourhood. "Hamra, Beirut" → "Beirut"; a single-part location has no
   * wider form, so the location is dropped entirely and the backend decides.
   */
  function widerArea(promptMessageId: MessageId) {
    const { prompt, answer } = turnFor(promptMessageId);
    if (!prompt) return;

    const parts = (location ?? "").split(",").map((part) => part.trim()).filter(Boolean);
    const wider = parts.length > 1 ? parts[parts.length - 1] : null;

    if (answer) dropMessage(answer.id);
    setLocation(wider);
    void send(prompt.content, { resendMessageId: promptMessageId, location: wider });
  }

  function newChat() {
    clearThread();
    setDraft("");
    // §5.2: "New chat" clears the thread *and* the remembered location — the
    // next conversation should not inherit where the last one happened.
    setLocation(null);
  }

  // Wait for the handle before rendering the thread: the greeting needs a name
  // and every request needs a user id.
  if (!identityHydrated || !userId) {
    return (
      <div className="py-(--space-7) text-body-sm text-muted-foreground" role="status" />
    );
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <ChatHeader
        userId={userId}
        theme={theme}
        hasContent={messages.length > 0}
        onNewChat={newChat}
      />

      <div className="flex-1">
        {messages.length === 0 ? (
          <EmptyState
            name={userId}
            slot={greeting}
            placesOff={Boolean(health) && !canSearchPlaces}
            onPick={(prompt) => {
              // §7.2.2: the chip fills the composer, it does not send. Focus
              // follows so the next keystroke edits rather than hunting.
              setDraft(prompt);
              composerRef.current?.focus();
            }}
          />
        ) : (
          <Thread
            messages={messages}
            generating={generating}
            onRetry={retry}
            onEdit={edit}
            onStop={stop}
            onLocationAnswer={answerLocation}
            onWiderArea={widerArea}
            atBottom={atBottom}
            scrollToBottom={scrollToBottom}
          />
        )}
      </div>

      {/* Sticky, above the bottom nav, with the context chips riding on top —
          the composer is the screen's primary action and never scrolls away. */}
      <div className="sticky bottom-0 -mx-(--space-4) flex flex-col gap-(--space-2) bg-background/95 px-(--space-4) pt-(--space-2) pb-(--space-3) backdrop-blur">
        {/* §7.2.5: above the composer, not over it — the composer grows with
            its content, so no fixed viewport offset would stay clear of it. */}
        {!atBottom && messages.length > 0 ? (
          <button
            type="button"
            onClick={() => scrollToBottom()}
            className="mx-auto inline-flex min-h-11 items-center gap-(--space-2) rounded-full border border-border bg-card px-(--space-4) text-body-sm"
            style={{ boxShadow: "var(--shadow-2)" }}
          >
            <ArrowDown
              aria-hidden="true"
              style={{ width: "var(--icon-sm)", height: "var(--icon-sm)" }}
            />
            {t("jumpLatest")}
          </button>
        ) : null}

        <ContextChips
          mood={mood}
          location={location}
          onClearMood={() => setMood(DEFAULT_MOOD)}
          onClearLocation={() => setLocation(null)}
        />

        <Composer
          value={draft}
          onChange={setDraft}
          onSubmit={submit}
          onStop={stop}
          generating={generating}
          mood={mood}
          location={location}
          onMoodChange={setMood}
          onLocationChange={setLocation}
          voiceEnabled={canUseVoice}
          inputRef={composerRef}
        />
      </div>
    </div>
  );
}
