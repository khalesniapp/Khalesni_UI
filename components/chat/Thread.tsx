"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";

import type { MenuAction } from "@/components/ui/Menu";
import { mergeDocumentIntoResponse } from "@/lib/api/normalise";
import {
  assistantHistoryContent,
  isPending,
  useThread,
  type MessageId,
  type ResponseMessage,
  type ThreadMessage,
} from "@/lib/stores/thread";
import { ReplyBubble, UserBubble } from "./Bubbles";
import { ErrorCard } from "./ErrorCard";
import { PlaceRow } from "@/components/places/PlaceRow";
import { ResponseRouter } from "./ResponseRouter";
import type { LocationAnswer } from "./locationAnswer";
import { StageChip } from "./StageChip";

/**
 * The transcript — UI_Plan.md §7.2.5.
 *
 * Scroll rule: follow the newest message only while the reader is already at
 * the bottom. Someone who has scrolled up is reading, and yanking them back
 * down mid-sentence is the single most irritating thing a chat UI can do — so
 * they get a "Jump to latest" pill instead and decide for themselves.
 *
 * The pill itself is drawn by `ChatScreen`, directly above the composer:
 * positioned against the viewport it would sit on top of the composer, whose
 * height changes as the textarea grows.
 */

export function Thread({
  messages,
  generating,
  onRetry,
  onEdit,
  onStop,
  onLocationAnswer,
  onWiderArea,
  atBottom,
  scrollToBottom,
}: {
  messages: readonly ThreadMessage[];
  generating: boolean;
  onRetry: (promptMessageId: MessageId) => void;
  onEdit: (promptMessageId: MessageId) => void;
  onStop: () => void;
  /** §5.4: the three ways out of the location handshake. */
  onLocationAnswer: (promptMessageId: MessageId, answer: LocationAnswer) => void;
  /** §7.4: re-ask with the city instead of the neighbourhood. */
  onWiderArea: (promptMessageId: MessageId) => void;
  /** From `useAtBottom`, shared with the composer block that draws the pill. */
  atBottom: boolean;
  scrollToBottom: (smooth?: boolean) => void;
}) {
  const t = useTranslations("chat");
  const tCommon = useTranslations("common");

  // Follow new messages only while pinned. `messages.length` rather than the
  // array identity: a token append during streaming must not re-scroll on every
  // frame.
  useEffect(() => {
    if (atBottom) scrollToBottom(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length]);

  return (
      <div
        // §7.2.3: the whole region is busy while a turn is in flight, which is
        // what pairs with the stage chip's polite announcements.
        aria-busy={generating}
        aria-live="polite"
        className="flex flex-col gap-(--space-4) pb-(--space-4)"
      >
        {messages.map((message) => (
          <MessageView
            key={message.id}
            message={message}
            onRetry={onRetry}
            onEdit={onEdit}
            onStop={onStop}
            onLocationAnswer={onLocationAnswer}
            onWiderArea={onWiderArea}
            copyLabel={tCommon("copy")}
            retryLabel={t("retryLabel")}
            actionsLabel={tCommon("messageActions")}
          />
        ))}
      </div>
  );
}

function MessageView({
  message,
  onRetry,
  onEdit,
  onStop,
  onLocationAnswer,
  onWiderArea,
  copyLabel,
  retryLabel,
  actionsLabel,
}: {
  message: ThreadMessage;
  onRetry: (promptMessageId: MessageId) => void;
  onEdit: (promptMessageId: MessageId) => void;
  onStop: () => void;
  onLocationAnswer: (promptMessageId: MessageId, answer: LocationAnswer) => void;
  onWiderArea: (promptMessageId: MessageId) => void;
  copyLabel: string;
  retryLabel: string;
  actionsLabel: string;
}) {
  if (message.role === "user") {
    return <UserBubble>{message.content}</UserBubble>;
  }

  if (isPending(message)) {
    // A stopped turn keeps its place in the thread with a way back in, rather
    // than vanishing and leaving the user wondering what happened (§11.5).
    if (message.stopped) {
      return (
        <ReplyBubble
          actions={[
            {
              key: "retry",
              label: retryLabel,
              onSelect: () => onRetry(message.promptMessageId),
            },
          ]}
          actionsLabel={actionsLabel}
        >
          {/* The label lives in the chip's catalogue namespace; reused here so
              "Stopped." reads identically wherever it appears. */}
          <StoppedNotice onRetry={() => onRetry(message.promptMessageId)} />
        </ReplyBubble>
      );
    }

    return (
      <div className="flex flex-col gap-(--space-3)">
        <StageChip
          stage={message.stage}
          detail={message.stageDetail}
          startedAt={message.startedAt}
          onStop={onStop}
        />

        {/* §5.5: tokens render as they arrive, with no added typewriter delay.
            This preview is discarded the moment `result` lands — that frame is
            the source of truth, not the text accumulated on the way there. */}
        {message.tokens ? <ReplyBubble>{message.tokens}</ReplyBubble> : null}

        {/* Places arrive before the plan that mentions them. */}
        {message.places.length > 0 ? (
          <ul className="flex flex-col gap-(--space-3)">
            {message.places.map((place, index) => (
              <PlaceRow
                key={place.osm_id ?? `${place.name}-${index}`}
                place={place}
                index={index}
              />
            ))}
          </ul>
        ) : null}
      </div>
    );
  }

  if (message.kind === "error") {
    return (
      <ErrorCard
        status={message.status}
        detail={message.detail}
        requestId={message.requestId}
        onRetry={() => onRetry(message.promptMessageId)}
        onEdit={() => onEdit(message.promptMessageId)}
      />
    );
  }

  const actions: MenuAction[] = [
    {
      key: "copy",
      label: copyLabel,
      onSelect: () => {
        const text = assistantHistoryContent(message.response);
        if (text) void navigator.clipboard.writeText(text).catch(() => undefined);
      },
    },
    {
      key: "retry",
      label: retryLabel,
      onSelect: () => onRetry(message.promptMessageId),
    },
  ];

  return (
    <ResponseMessageView
      message={message}
      actions={actions}
      onLocationAnswer={onLocationAnswer}
      onWiderArea={onWiderArea}
    />
  );
}

/**
 * A completed turn, with its plan wired back into the transcript.
 *
 * Item mutations answer with a `PlanDocument`; the thread stores
 * `GeneratePlanResponse`. `mergeDocumentIntoResponse` folds one into the other
 * and the whole message is replaced — trap 2's "replace from the response,
 * never splice" rule, applied to the message rather than the array.
 */
function ResponseMessageView({
  message,
  actions,
  onLocationAnswer,
  onWiderArea,
}: {
  message: ResponseMessage;
  actions: readonly MenuAction[];
  onLocationAnswer: (promptMessageId: MessageId, answer: LocationAnswer) => void;
  onWiderArea: (promptMessageId: MessageId) => void;
}) {
  const replaceResponse = useThread((state) => state.replaceResponse);

  return (
    <ResponseRouter
      response={message.response}
      actions={actions}
      onDocument={(document) =>
        replaceResponse(message.id, mergeDocumentIntoResponse(message.response, document))
      }
      location={{
        onCoords: (coords) =>
          onLocationAnswer(message.promptMessageId, { kind: "coords", value: coords }),
        onTyped: (area) =>
          onLocationAnswer(message.promptMessageId, { kind: "typed", value: area }),
        onSkip: () => onLocationAnswer(message.promptMessageId, { kind: "skip" }),
      }}
      onWiderArea={() => onWiderArea(message.promptMessageId)}
    />
  );
}

function StoppedNotice({ onRetry }: { onRetry: () => void }) {
  const t = useTranslations("chat");

  return (
    <span className="flex flex-wrap items-center gap-(--space-2) text-body-sm text-muted-foreground">
      {t("stopped")}
      <button type="button" onClick={onRetry} className="text-primary hover:underline">
        {t("retryLabel")}
      </button>
    </span>
  );
}
