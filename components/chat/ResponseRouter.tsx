"use client";

import { useTranslations } from "next-intl";

import { EditablePlanCard } from "@/components/plan/EditablePlanCard";
import { PlanCard } from "@/components/plan/PlanCard";
import { PlacesCard } from "@/components/places/PlacesCard";
import { AnswerCard } from "@/components/realtime/AnswerCard";
import type { MenuAction } from "@/components/ui/Menu";
import { fromGenerateResponse } from "@/lib/api/normalise";
import type { GeneratePlanResponse, PlanDocument } from "@/lib/api/types";
import { ReplyBubble } from "./Bubbles";
import { LocationAskCard } from "./LocationAskCard";

/**
 * The response router — UI_Plan.md §5.1.
 *
 * This is the **only** place in the codebase that branches on `type` /
 * `plan_type`. Every card below it receives data it can render without asking
 * where it came from; if a component ever seems to need the response type, the
 * answer is to add a branch here and pass the result down as a prop.
 *
 *   type === "plan"                     → PlanCard
 *   type === "realtime"                 → AnswerCard
 *   type === "chat" + needs "location"  → LocationAskCard
 *   type === "chat" + places[]          → PlacesCard
 *   else                                → ReplyBubble
 */

/** The three ways out of the location handshake (§5.4). */
export interface LocationHandlers {
  onCoords: (coords: string) => void;
  onTyped: (area: string) => void;
  onSkip: () => void;
}

export function ResponseRouter({
  response,
  actions = [],
  /** Where an updated document goes after an item mutation. Absent → read-only. */
  onDocument,
  onStale,
  onRetrySave,
  retryingSave,
  location,
  onWiderArea,
}: {
  response: GeneratePlanResponse;
  actions?: readonly MenuAction[];
  onDocument?: (document: PlanDocument) => void;
  onStale?: () => void;
  onRetrySave?: () => void;
  retryingSave?: boolean;
  location?: LocationHandlers;
  onWiderArea?: () => void;
}) {
  const t = useTranslations("common");

  if (response.type === "plan") {
    const plan = fromGenerateResponse(response);

    // `type: "plan"` with a null `plan` body is a contract violation Zod cannot
    // catch (both fields are individually valid). Falling through to the reply
    // bubble is better than rendering an empty card.
    if (plan) {
      return onDocument ? (
        <EditablePlanCard
          plan={plan}
          onDocument={onDocument}
          onStale={onStale}
          actions={actions}
          onRetrySave={onRetrySave}
          retryingSave={retryingSave}
        />
      ) : (
        <PlanCard
          plan={plan}
          actions={actions}
          onRetrySave={onRetrySave}
          retryingSave={retryingSave}
        />
      );
    }
  }

  if (response.type === "realtime" && response.realtime) {
    return (
      <AnswerCard answer={response.realtime} createdAt={response.created_at} actions={actions} />
    );
  }

  const chat = response.chat;
  const reply = chat?.reply?.trim() ?? "";

  // §5.4: the backend is asking where the user is. Without the handlers (a
  // read-only render) it degrades to the question as plain text, which still
  // reads correctly.
  if (chat?.needs === "location" && location) {
    return (
      <LocationAskCard
        reply={reply || t("noReply")}
        onCoords={location.onCoords}
        onTyped={location.onTyped}
        onSkip={location.onSkip}
      />
    );
  }

  if (chat && chat.places.length > 0) {
    return (
      <PlacesCard
        reply={reply}
        places={chat.places}
        actions={actions}
        onWiderArea={onWiderArea}
      />
    );
  }

  return (
    <ReplyBubble actions={actions} actionsLabel={t("messageActions")}>
      {reply || t("noReply")}
    </ReplyBubble>
  );
}
