# Khalesni — UI/UX Plan

> Frontend plan for the Khalesni AI planning assistant.
> Backend lives in `../khalesni` (FastAPI). This document is the single source of truth for the
> frontend built in `khalesni_UI/`.
>
> **Written:** 2026-09-17 · **Backend contract:** `../khalesni/README.md` as of 2026-09-17

---

## Table of contents

1. [The product in one page](#1-the-product-in-one-page)
2. [Who uses it, and what for](#2-who-uses-it-and-what-for)
3. [UX principles (the eight rules we do not break)](#3-ux-principles-the-eight-rules-we-do-not-break)
4. [Information architecture & navigation](#4-information-architecture--navigation)
5. [The core interaction model](#5-the-core-interaction-model)
6. [The API contract the UI codes against](#6-the-api-contract-the-ui-codes-against)
7. [Screen-by-screen specification](#7-screen-by-screen-specification)
8. [Design system](#8-design-system)
9. [Bilingual & RTL](#9-bilingual--rtl)
10. [Component inventory](#10-component-inventory)
11. [State, data & streaming layer](#11-state-data--streaming-layer)
12. [Every state: loading, empty, error](#12-every-state-loading-empty-error)
13. [Accessibility specification](#13-accessibility-specification)
14. [Responsive specification](#14-responsive-specification)
15. [Performance budget](#15-performance-budget)
16. [Micro-copy library](#16-micro-copy-library)
17. [Tech stack & file structure](#17-tech-stack--file-structure)
18. [Build phases](#18-build-phases)
19. [QA checklist before shipping](#19-qa-checklist-before-shipping)
20. [Open questions for the team](#20-open-questions-for-the-team)

---

## 1. The product in one page

**Khalesni** ("خلّصني" — *get it done for me*) turns a messy brain-dump into something actionable.

The user types or says one unstructured sentence. Khalesni works out what they actually want and
answers in one of four shapes:

| User says | They get | Backend shape |
|---|---|---|
| "I have energy but no plan today" | A **checklist** they can tick off, saved to history | `type: "plan"` |
| "I'm hungry, somewhere Italian near Hamra" | **Real places** with map link, phone, hours | `type: "chat"`, `plan_type: "places"` |
| "What's the weather in Beirut tomorrow?" | A **short answer with sources** | `type: "realtime"` |
| "hey" / an unclear message | A **short reply or a question back** | `type: "chat"` |

It remembers preferences (Pinecone memory keyed on `user_id`), so the second plan beats the first,
and it never invents a venue that does not exist.

### The UI's whole job

Make those four shapes feel like one calm conversation, make the waiting legible, and make a
generated checklist feel like *the user's own* the moment it appears.

### What the UI must never do

- Never make the user pick a "mode" before typing. One input box answers everything.
- Never surface a raw field name, a `plan_type`, or an HTTP status code to a user.
- Never lose a plan silently. If the database write failed (`persisted: false`), say so on the card.
- Never show a place the backend did not verify, and never drop the source link of one it found.

---

## 2. Who uses it, and what for

### Primary persona — "the overloaded planner"

Bilingual (Arabic/English), Beirut, 22–35, phone-first, low patience for setup. Opens the app with a
half-formed thought and wants momentum, not a form.

### Jobs to be done

| # | Job | Entry point | Success looks like |
|---|---|---|---|
| J1 | "Turn this mess in my head into steps" | Composer, free text | A checklist in < 15 s, first item tickable |
| J2 | "Where do I go tonight?" | Composer, or a suggestion chip | 3–6 real places, map link, phone |
| J3 | "Quick fact, don't make me open a browser" | Composer | One short answer + source link |
| J4 | "Where did my plan from Tuesday go?" | Plans library | Found in ≤ 2 taps, same tick state |
| J5 | "My hands are busy, let me just talk" | Voice tab | Speak, hear a reply, plan appears on screen |
| J6 | "Keep track of what I've done" | Plan detail | Ticking persists across reload and devices |

### Non-goals for v1

No accounts/passwords (the backend has no auth yet — see §11.1), no sharing, no push notifications,
no calendar sync, no team features, no offline plan generation.

---

## 3. UX principles (the eight rules we do not break)

1. **One input, four answers.** The composer is the only thing the user must understand. Response
   shape is the system's problem, not theirs.
2. **Waiting is narrated, never blank.** The backend streams five named stages
   (`thinking → remembering → searching → checking → writing`). Every one becomes a human sentence.
   A place request costs ~4–6 upstream calls; eight seconds of silence is a bug, not a wait.
3. **Answers are ticked, not admired.** A checklist arrives with working checkboxes, editable in
   place. No "open the plan to edit it" detour.
4. **The system never overstates certainty.** Web-sourced phone numbers carry "may be outdated" plus
   their source link. A place with no coordinates is never drawn on the map.
5. **Nothing is destroyed without a way back.** Deleting a plan asks first; deleting an item offers
   Undo.
6. **Arabic is a first-class citizen, not a translation.** Full RTL mirroring, Arabic-first font
   stack, language remembered across sessions.
7. **Touch-first, keyboard-complete.** 44 px minimum targets; every action reachable by keyboard with
   a visible focus ring.
8. **Degrade loudly, not silently.** Map server down, voice disabled, database unreachable — each has
   a specific honest message and a still-usable app around it.

---

## 4. Information architecture & navigation

```
Khalesni
├── /                      Chat            ← home, the default surface
│   └── inline results     plan · places · realtime · chat cards
├── /plans                 Plans library   ← saved checklists, newest first
│   └── /plans/[planId]    Plan detail     ← full checklist, editable, deletable
├── /voice                 Voice mode      ← live conversation (disabled if unavailable)
└── /settings              You             ← user id, language, mood, location, theme, status
```

### Navigation shell

| Viewport | Pattern | Detail |
|---|---|---|
| < 768 px | **Bottom tab bar**, 4 items | Chat · Plans · Voice · You. Icon **and** label. Active item in brand colour with a 2 px indicator. Bottom safe-area padding. |
| 768–1023 px | Bottom tab bar, wider gutters | Content column max-width 640 px, centred. |
| ≥ 1024 px | **Left sidebar**, 240 px | Same four destinations plus a recent-plans list. Content column max-width 760 px. |

Applied rules: `bottom-nav-limit` (4 ≤ 5), `nav-label-icon`, `nav-state-active`,
`adaptive-navigation`, `navigation-consistency`, `deep-linking` (every plan has its own URL),
`state-preservation` (back from a plan restores chat scroll), `empty-nav-state` (the Voice tab is
shown **disabled with a reason**, never silently removed).

### Route ↔ endpoint map

| Route | Reads | Writes |
|---|---|---|
| `/` | `GET /health` (on boot) | `POST /api/generate-plan/stream` |
| `/plans` | `GET /api/plans/{user_id}?limit=20` | `DELETE /api/plans/{user_id}/{plan_id}` |
| `/plans/[planId]` | `GET /api/plans/{user_id}/{plan_id}` | `PATCH` / `POST` / `DELETE` on `.../items` |
| `/voice` | `GET /health` → `voice_enabled` | `WS /api/voice/ws?user_id=` |
| `/settings` | `GET /health` | localStorage only |

---

## 5. The core interaction model

### 5.1 One conversation, cards inside it

Home is a message thread. User messages are plain bubbles. **Assistant messages are cards** whose
shape depends on the response:

```
┌────────────────────────────────────────────────────────┐
│  RESPONSE ROUTER (frontend)                            │
│                                                        │
│  type === "plan"      → <PlanCard>                     │
│  type === "realtime"  → <AnswerCard>                   │
│  type === "chat" &&                                    │
│     chat.needs === "location" → <LocationAskCard>      │
│     chat.places.length > 0    → <PlacesCard>           │
│     else                      → <ReplyBubble>          │
└────────────────────────────────────────────────────────┘
```

This router is the **only** place in the codebase that branches on `type` / `plan_type`.

### 5.2 The conversation is client-owned

The API is stateless. **The frontend owns the transcript** and replays it on every request:

- Keep the full thread in memory plus `sessionStorage` (survives reload, dies with the tab).
- Send `history` = the last **10** turns (`{role, content}`, oldest first, current prompt excluded).
  The backend accepts up to 20 and uses the last 10 — sending 10 keeps payloads small.
- Truncate each `content` to 2000 chars (backend limit) with a middle ellipsis.
- "New chat" clears the thread and the remembered `location`.

This is what makes "the first one", "what about sushi?" and "what's their number?" work. **Skip it and
follow-ups break.**

### 5.3 Two pieces of remembered context

| Context | Where it lives | How it is set | Shown as |
|---|---|---|---|
| `location` | Zustand + `localStorage` | Returned in every response (`location`), set by the user, or from browser geolocation | Dismissible chip above the composer: `Beirut ×` |
| `mood` | Zustand + `localStorage` | Mood picker in the composer tray (default `neutral`) | Dismissible chip: `Tired ×` |

Both are **visible and removable**. Hidden state that changes answers is a trust bug.

### 5.4 The location handshake (the one multi-step flow)

```
User: "somewhere to eat tonight"
  │  POST /api/generate-plan/stream   (no location known)
  ▼
Khalesni: type=chat · chat.needs="location" · reply="Which area are you in?"
  │  UI renders <LocationAskCard> with three affordances
  ▼
  ┌── [ Use my location ] → navigator.geolocation → send "33.89,35.48" as `location`,
  │                          resend the *same* prompt
  ├── [ typed answer ]    → send as the next *message* with history
  │                          (the backend extracts a clean place name from a whole sentence,
  │                           e.g. "Beirut is fine, I want Chinese food")
  └── [ Not now ]         → resend the same prompt with `ask_location: false`
                             → a plan with no venues
```

The cleaned location comes back in the `location` field — store it and stop asking.

### 5.5 Streaming: what the user sees while waiting

`POST /api/generate-plan/stream` returns Server-Sent Events. Five event types, one meaning each:

| SSE event | Payload | UI reaction |
|---|---|---|
| `status` | `{status, detail}` | Update the **stage chip** (§7.2.3). `detail` is already human ("looking for places near Hamra") — show it verbatim. |
| `token` | `{text}` | Append to the growing reply bubble. Render as it arrives; no extra typewriter delay. |
| `places` | `{places: [...]}` | Render place cards **immediately**, before the final result. Biggest perceived-speed win in the app. |
| `result` | full `GeneratePlanResponse` | Replace the streamed bubble with the final card. Source of truth. |
| `error` | `{detail, request_id}` | Error card with Retry and a copyable `request_id`. |

Stage copy (`status` → what the user reads):

| `status` | English | Arabic | Icon (Phosphor) |
|---|---|---|---|
| `thinking` | Working out what you need… | أفهم طلبك… | `Brain` |
| `remembering` | Checking what you like… | أتذكّر ما تحبّه… | `Bookmarks` |
| `searching` | Looking for places… (+ `detail`) | أبحث عن أماكن… | `MagnifyingGlass` |
| `checking` | Verifying the details… (+ `detail`) | أتحقّق من التفاصيل… | `SealCheck` |
| `writing` | Writing your checklist… | أكتب قائمتك… | `PencilLine` |

Unknown `status` value → show `detail` if present, else "Working on it…". Never print the raw token.

**Non-streaming fallback:** if the stream fails or the response is not `text/event-stream`, retry once
against `POST /api/generate-plan` and show a skeleton card. Feature flag
`NEXT_PUBLIC_STREAMING=on|off`.

---

## 6. The API contract the UI codes against

Base URL: `NEXT_PUBLIC_API_BASE` (default `http://localhost:8000`). The backend's default
`CORS_ORIGINS` is `["http://localhost:3000"]`, so the dev frontend must run on port 3000.

### 6.1 Endpoints

| Method | Path | Body / query | Returns |
|---|---|---|---|
| POST | `/api/generate-plan` | `{user_id, prompt, mood?, location?, ask_location?, history?}` | `GeneratePlanResponse` |
| POST | `/api/generate-plan/stream` | same | SSE: `status` · `token` · `places` · `result` · `error` |
| GET | `/api/plans/{user_id}?limit=20` | – | `PlanDocument[]`, newest first |
| GET | `/api/plans/{user_id}/{plan_id}` | – | `PlanDocument` |
| DELETE | `/api/plans/{user_id}/{plan_id}` | – | `204` |
| PATCH | `/api/plans/{plan_id}/items` | `{user_id, item_type, index, completed?, name?, estimated_time?}` | updated `PlanDocument` |
| POST | `/api/plans/{plan_id}/items` | `{user_id, item_type, name, estimated_time?}` | updated `PlanDocument` (`201`) |
| DELETE | `/api/plans/{plan_id}/items/{item_type}/{index}?user_id=` | – | updated `PlanDocument` |
| GET | `/api/places?near=…&category=…` | – | `Place[]` (`503` unless `MAP_SEARCH_ENABLED=true`) |
| GET | `/health` | – | status object, see §6.5 |
| WS | `/api/voice/ws?user_id=…` | see §7.7 | voice session |

### 6.2 Field limits the UI must enforce *before* sending

| Field | Rule | UI enforcement |
|---|---|---|
| `user_id` | `^[a-z0-9_\-]{1,128}$`, trimmed + lowercased server-side | Lowercase as the user types; inline error on invalid chars. **"Nour" and "nour" are the same person.** |
| `prompt` | 1–4000 chars, not blank | Character counter from 3600; Send disabled when blank |
| `mood` | 1–50 chars | Picker only, no free text |
| `location` | ≤ 300 chars | Input `maxlength` |
| `history` | ≤ 20 turns, each `content` 1–2000 chars | Slice to 10, truncate content |
| `item_type` | `"tasks"` \| `"outing_readiness"` | Typed union, never a string literal at a call site |
| `index` | ≥ 0 | From the rendered array position |
| item `name` | 1–300 chars | Input `maxlength`, trim before send |
| `estimated_time` | ≤ 50 chars | Input `maxlength` |

### 6.3 Response shapes (TypeScript, mirrors `app/models.py`)

```ts
type PlanType =
  | "outing" | "trip" | "study" | "daily_schedule" | "general"
  | "realtime" | "chat" | "places";

interface Task            { task_name: string; estimated_time: string; completed: boolean }
interface ReadinessItem   { item_name: string; completed: boolean }

interface Place {
  name: string;
  kind?: string | null;            // OSM type: "restaurant" | "cafe" | "park" | …
  cuisine?: string | null;         // "italian", "ice_cream"
  distance?: string | null;        // "578 m" — from the searched centre
  address?: string | null;
  phone?: string | null;
  phone_source?: string | null;    // set when the phone came from the web → SHOW IT
  opening_hours?: string | null;   // raw OSM, e.g. "Mo-Su 12:00-23:00"
  website?: string | null;
  osm_id?: string | null;          // "node/4718183548"
  source?: string | null;          // web page that recommended it
  note?: string | null;            // why that page recommends it
  latitude?: number | null;        // null → NOT on the map
  longitude?: number | null;
  map_link?: string | null;
}

interface PlanOutput {
  title: string;
  description: string;
  tasks: Task[];                   // 1–25 on generation, may be 0 after deletes
  outing_readiness: ReadinessItem[];
  places: Place[];
}

interface ChatReply {
  reply: string;
  needs: "location" | null;
  places: Place[];
}

interface RealtimeAnswer {
  answer: string;
  sources: { title?: string | null; url: string }[];
}

interface GeneratePlanResponse {
  type: "plan" | "realtime" | "chat";
  plan_type: PlanType;
  plan_id: string | null;          // null → not saved → item editing impossible
  persisted: boolean;              // false → Mongo write failed, plan still valid
  created_at: string;              // ISO 8601
  plan: PlanOutput | null;
  realtime: RealtimeAnswer | null;
  chat: ChatReply | null;
  location: string | null;         // cleaned location used → remember it
}

// Saved plan: FLAT — checklist fields sit at the top level, no nested `plan`
interface PlanDocument extends PlanOutput {
  id: string;
  user_id: string;
  prompt: string;                  // the original brain-dump
  mood: string;
  plan_type: PlanType;
  model?: string | null;           // which LLM wrote it
  created_at: string;
  updated_at: string;
}
```

> **Trap:** `GeneratePlanResponse` nests the checklist under `plan`, while `PlanDocument` is **flat**.
> Normalise at the API-client boundary into one internal `Plan` type so no component has to know.

### 6.4 Errors

| Status | Body | UI |
|---|---|---|
| 422 | validation detail | Inline field error. Should not happen if §6.2 is enforced. |
| 502 | `{detail: "Plan generation failed", request_id}` | Error card: "Khalesni couldn't finish that one." + **Retry** + request id |
| 503 | – | Plan list/edit only: "Your saved plans aren't reachable right now." Chat still works. |
| 504 | – | "That took too long." + **Retry** + "try a shorter message" |
| 500 | `{detail: "Internal error", request_id}` | Generic error card + request id |

Every response carries an `X-Request-ID` header. **Capture it on every request** and show it on error
cards behind a "Copy details" button — it is the only way to find the matching backend log line.

### 6.5 Capability gating via `/health`

```jsonc
{
  "status": "ok", "env": "dev",
  "llm_provider": "ollama", "llm_model": "gemma4:31b",
  "mongo_ready": true,            // false → hide/disable Plans, warn on chat
  "pinecone_index": "khalesni",
  "rag_ready": true,              // false → "Khalesni won't remember preferences yet"
  "places": true,                 // false → hide the map-search UI
  "voice_enabled": false,         // false → Voice tab disabled with a reason
  "active_voice_sessions": 0
}
```

Fetch once on boot, cache 60 s, re-fetch on window focus. Store in a `CapabilitiesProvider`. Every
capability-dependent surface reads from it instead of failing at click time.

---

## 7. Screen-by-screen specification

### 7.1 First run

No auth exists yet, so identity is a self-chosen handle. Keep it to **one screen, one field**.

```
┌─────────────────────────────────────┐
│                                     │
│            ◆  Khalesni              │
│                                     │
│     Tell me the mess. I'll turn     │
│        it into a checklist.         │
│                                     │
│   What should I call you?           │
│   ┌───────────────────────────────┐ │
│   │ nour                          │ │
│   └───────────────────────────────┘ │
│   Letters, numbers, - and _         │
│                                     │
│   ┌───────────────────────────────┐ │
│   │          Start                │ │
│   └───────────────────────────────┘ │
│                                     │
│   العربية                           │
└─────────────────────────────────────┘
```

- Autofocus the field. `inputmode="text"`, `autocapitalize="none"`, `autocomplete="username"`.
- Lowercase live as the user types, and show why: helper text "Saved as `nour`".
- Validate on **blur**, not per keystroke (`inline-validation`). Error below the field, linked with
  `aria-describedby`.
- Language switch present here — first impressions matter for an Arabic-first user.
- Persist to `localStorage.khalesni.user_id`. Route to `/` on submit.
- **Warn honestly** in a small footnote: "Anyone using this handle on this device sees the same
  plans." Plus, in Settings, a "Switch handle" action.

### 7.2 Home — Chat

```
┌──────────────────────────────────────────────────┐
│ ◆ Khalesni            nour ▾   ☾   [+ New chat] │  header, sticky
├──────────────────────────────────────────────────┤
│                                                  │
│   ┌──── EMPTY STATE (first visit) ────────────┐  │
│   │  Good evening, nour.                      │  │
│   │  What's on your mind?                     │  │
│   │                                           │  │
│   │  ┌───────────────────┐ ┌────────────────┐ │  │
│   │  │ Plan my day       │ │ Pack for a trip│ │  │
│   │  └───────────────────┘ └────────────────┘ │  │
│   │  ┌───────────────────┐ ┌────────────────┐ │  │
│   │  │ Find me a café    │ │ Study schedule │ │  │
│   │  └───────────────────┘ └────────────────┘ │  │
│   └───────────────────────────────────────────┘  │
│                                                  │
│                    ┌───────────────────────────┐ │
│                    │ i want to go out tonight  │ │ user bubble
│                    └───────────────────────────┘ │
│                                                  │
│   ┌─ ⟳ Looking for places near Hamra ─────────┐  │ stage chip
│   └───────────────────────────────────────────┘  │
│                                                  │
│   ┌─ ASSISTANT CARD ──────────────────────────┐  │
│   │  … (PlanCard / PlacesCard / AnswerCard)   │  │
│   └───────────────────────────────────────────┘  │
│                                                  │
├──────────────────────────────────────────────────┤
│  📍 Hamra, Beirut ×    ☾ Tired ×                 │  context chips
│ ┌──────────────────────────────────────────┐     │
│ │ Tell me what's on your mind…       ⊕  ➤ │ 🎙 │  composer
│ └──────────────────────────────────────────┘     │
├──────────────────────────────────────────────────┤
│   Chat        Plans        Voice        You      │  bottom nav
└──────────────────────────────────────────────────┘
```

#### 7.2.1 Header

Left: wordmark. Right: handle menu (switch handle, settings), theme toggle, **New chat** (icon + label
on ≥ 768 px, icon-only with `aria-label` below). New chat asks for confirmation only if the thread has
unsaved-but-unpersisted content.

#### 7.2.2 Empty state

Time-aware greeting ("Good morning/afternoon/evening, {handle}"). Four **starter chips** that fill the
composer *without sending* — the user can edit before committing, which teaches the input's freedom.

Chips map to the real router categories: `Plan my day` (daily_schedule), `Pack for a trip` (trip),
`Find me a café` (places), `Study schedule` (study).

#### 7.2.3 Stage chip (the streaming indicator)

A single pill above the growing answer. Height fixed at 32 px so it never shifts layout
(`layout-shift-avoid`). Contents: spinning 16 px icon + stage sentence + `detail` when present.

- `aria-live="polite"`, `aria-busy="true"` on the thread region while streaming.
- Stage transitions crossfade at 200 ms (`fade-crossfade`). The spinner respects
  `prefers-reduced-motion` by switching to a static icon with a pulsing opacity of 0.6→1.
- After **20 s** with no new event, append a reassurance line: "Still working — map searches can be
  slow." After **45 s**, offer **Stop** (abort the fetch) next to it.
- The chip is replaced by the final card, not stacked above it.

#### 7.2.4 Composer

```
┌────────────────────────────────────────────────────┐
│ Tell me what's on your mind…                       │
│                                          ⊕    ➤   │
└────────────────────────────────────────────────────┘
   ⊕ = context tray (mood · location)     ➤ = send
```

- `<textarea>` auto-growing from 1 to 6 rows, then internal scroll. Font size **16 px** so iOS does
  not zoom (`readable-font-size`).
- Enter sends, Shift+Enter newlines, on desktop. On touch, Enter newlines and the user taps Send —
  never lose someone's paragraph to a stray Enter.
- Send button: 44×44 px, disabled when the trimmed value is empty, spinner while a request is in
  flight (`loading-buttons`). While streaming it becomes **Stop** (square icon).
- Character counter appears at 3600/4000 characters, turns `--color-destructive` at 4000.
- `⊕` opens the context tray: mood chips (Neutral · Tired · Energetic · Stressed · Focused ·
  Excited) and a location field with **Use my location**.
- The mic button sits outside the input and routes to `/voice` (it does not record inline — one voice
  surface, not two).
- Draft autosaved to `sessionStorage` on every keystroke, debounced 300 ms (`form-autosave`).

#### 7.2.5 Thread behaviour

- Scroll pinned to bottom **only when the user is already within 80 px of the bottom**; otherwise show
  a "Jump to latest ↓" pill. Never yank a reading user downward.
- New cards enter with a 12 px upward translate + fade, 200 ms, 40 ms stagger for list children
  (`stagger-sequence`). Exit animations at ~65 % of enter duration.
- Long threads (> 50 messages) virtualise (`virtualize-lists`).
- Every assistant card has an overflow menu: **Copy**, **Retry**, and for plans **Open** / **Delete**.

---

### 7.3 `<PlanCard>` — the heart of the product

Rendered for `type: "plan"`. Two checklists in one card.

```
┌─────────────────────────────────────────────────────┐
│ ◆ TRIP PLAN                       ⋯                 │
│                                                     │
│ Three Days in Paris                                 │
│ A relaxed first trip built around cafés and         │
│ short walks, with a light packing list.             │
│                                                     │
│ ▸ Tasks                                  2/7 done   │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│ ☑  Book the Thursday flight              1 hour     │
│ ☑  Renew the passport                    2 days     │
│ ☐  Reserve a hotel in Le Marais          45 min     │
│ ☐  Buy a museum pass                     15 min     │
│ ☐  Download offline maps                 10 min     │
│                              Show 2 more ▾          │
│ ┌─────────────────────────────────────────────────┐ │
│ │ + Add a task                                    │ │
│ └─────────────────────────────────────────────────┘ │
│                                                     │
│ ▸ Before you go                          0/5 packed │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│ ☐  Passport and boarding pass                       │
│ ☐  Universal power adapter                          │
│ ☐  Comfortable walking shoes                        │
│                              Show 2 more ▾          │
│                                                     │
│ ▸ Places  (3)                            [ Map ▾ ]  │
│ ┌─────────────────────────────────────────────────┐ │
│ │ <PlaceRow> … compact, see §7.4                  │ │
│ └─────────────────────────────────────────────────┘ │
│                                                     │
│ Saved · just now                    Open plan →     │
└─────────────────────────────────────────────────────┘
```

#### Specification

| Element | Spec |
|---|---|
| Type badge | `plan_type` mapped to a human label + icon: Trip `Suitcase` · Outing `MapTrifold` · Study `BookOpen` · Day `SunHorizon` · General `ListChecks`. 11 px uppercase, `letter-spacing: 0.04em`. |
| Title | 20 px / 600 weight, wraps (never truncates), balanced wrapping on ≤ 2 lines. |
| Description | 15 px, `--color-muted-foreground`, `line-clamp-3` with **Show more** (`truncation-strategy`). |
| Progress | `done/total` as text **and** a 4 px bar. Text is required — `color-not-only`. Tabular figures so the count does not jitter. |
| Checkbox row | 44 px min height, whole row is the hit target, 24 px checkbox. Checked: strikethrough + `--color-muted-foreground` + brand-filled box with a check glyph. |
| Item edit | Tap the label → inline `<input>` with the text selected; Enter saves, Escape cancels, blur saves. `⋯` per row → Rename · Delete. |
| Time chip | Right-aligned (start-aligned in RTL), 12 px, `--color-muted`, tabular figures. Hidden when `estimated_time` is empty. |
| Collapse | Show the first 5 items of each list; **Show N more** expands (`progressive-disclosure`). Expanded state remembered per plan. |
| Add item | Ghost-styled row at the end of each list. Opens an inline input; Enter adds and keeps the input open for a fast burst of entries. |
| Sections | `outing_readiness` section only renders when non-empty. Header copy is contextual: "Before you go" for outing/trip, "Bring / prepare" otherwise. |
| Places | Only when `plan.places.length > 0`. Collapsed to a compact list; **Map** expands an inline map (§7.4). |
| Footer | `Saved · {relative time}` or the unsaved warning below. `Open plan →` links to `/plans/{plan_id}`. |

#### Persistence honesty

| Condition | Footer | Checkbox behaviour |
|---|---|---|
| `persisted: true`, `plan_id` set | `Saved · just now` | Optimistic tick → `PATCH`, reconciled from the response |
| `persisted: false` | Amber row: **Not saved.** "Khalesni wrote this plan but couldn't store it. Ticking won't be remembered." + **Try saving again** (re-sends the same prompt) | Ticks are **local only** and visibly marked as such; no `PATCH` is attempted (there is no `plan_id`) |
| `plan_id: null` | Same as above | Same |

This is the single most important honesty affordance in the app. Do not soften it into a toast.

---

### 7.4 `<PlacesCard>` and `<PlaceRow>`

Rendered for `type: "chat"` with `chat.places.length > 0` (`plan_type: "places"`). The reply text is a
normal bubble; the places are cards under it. **These are never saved as plans** — no "Open plan" link.

```
┌─────────────────────────────────────────────────────┐
│ Here are three Italian places near you — Pizza      │
│ Nonna is the closest and the quietest.              │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ ┌─────────┐  Pizza Nonna                            │
│ │         │  Italian · Restaurant · 578 m           │
│ │  MAP    │  Rue Hamra 12, Beirut                   │
│ │ PREVIEW │                                         │
│ └─────────┘  Mo-Su 12:00–23:00   ● Open now         │
│                                                     │
│  “quiet, good wifi, delivers” — timeout.com ↗       │
│                                                     │
│  ┌──────────┐ ┌──────────┐ ┌───────────┐            │
│  │ ☎ Call   │ │ ⌖ Map    │ │ ⇗ Website │            │
│  └──────────┘ └──────────┘ └───────────┘            │
│  Phone found on yellowpages.com.lb ↗ — may be       │
│  outdated                                           │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│    Trattoria Rosa                                   │
│    Italian · Restaurant                             │
│    ⚠ Not on the map — found on blog.example.com ↗   │
│                                                     │
│    ┌───────────┐                                    │
│    │ ⇗ Source  │                                    │
│    └───────────┘                                    │
└─────────────────────────────────────────────────────┘
```

#### Field-by-field rendering rules

| Field | Rule |
|---|---|
| `name` | 17 px / 600. Always present. |
| `kind`, `cuisine` | Meta line: `cuisine · kind`, `_` → space, `;` → `, `, Title Case. Omit silently when absent. |
| `distance` | Appended to the meta line. Tabular figures. |
| `address` | 14 px muted. Omit the line when absent. |
| `opening_hours` | Raw OSM string is shown **as-is** plus a derived `Open now` / `Closed` dot when it parses cleanly. If parsing is uncertain, show the raw string only — never guess. |
| `phone` | `Call` button → `tel:`. **If `phone_source` is set**, the footnote "Phone found on {domain} — may be outdated" is mandatory, with the link. Backend contract requires showing it. |
| `website` | `Website` button → `target="_blank" rel="noopener noreferrer"`. |
| `map_link` | `Map` button. Also the map preview target. |
| `note` | Quoted italic line + `source` domain as a link. This is *why the web recommends it* — it is the most persuasive content on the card; give it room. |
| `source` without `latitude` | **Amber warning row:** "Not on the map — found on {domain}". No map preview, no distance. Only a `Source` button. |
| `osm_id` | Not shown. Used as the React key when present; fall back to `name + index`. |

#### Map

- Default: a **static, non-interactive preview** (96×96 px thumbnail) per place — cheap, no library,
  no layout shift. Tap opens `map_link` in a new tab.
- Optional enhancement (`NEXT_PUBLIC_MAP=leaflet`): one shared Leaflet + OpenStreetMap tiles map,
  lazy-loaded on **Map ▾**, showing all places with coordinates and numbered pins matching the list
  order. Keyboard-reachable list stays the primary interface (`dragging-alternative`).
- Places with `latitude === null` are excluded from the map and get the warning row instead.

#### Empty result

When the live map returns nothing the backend says so in `chat.reply` and names no venue. Render the
reply plainly and add one action: **Try a wider area** (re-sends with the city instead of the
neighbourhood). Never render an empty places section.

---

### 7.5 `<AnswerCard>` — real-time answers

Rendered for `type: "realtime"`.

```
┌─────────────────────────────────────────────────────┐
│ ⚡ REAL-TIME                              ⋯         │
│                                                     │
│ Tomorrow in Beirut: sunny, 24–29 °C, light wind     │
│ from the west. No rain expected.                    │
│                                                     │
│ ── Sources ─────────────────────────────────────    │
│  1. AccuWeather — Beirut hourly forecast         ↗  │
│  2. timeanddate.com                              ↗  │
│                                                     │
│ Checked just now                                    │
└─────────────────────────────────────────────────────┘
```

- `answer` is prose: 16 px, `line-height: 1.6`, `max-width: 68ch` (`line-length`).
- Sources are **always** shown — this is a live-web answer and the citation is the credibility. Each
  is a numbered row: `title` when present, otherwise the bare domain. External-link icon, new tab.
- No sources returned → the footer reads "No sources returned" rather than an empty section.
- `Checked {relative time}` from `created_at` — a real-time answer decays, so its age matters.
- Not saved; no plan actions in the overflow menu beyond Copy and Retry.

---

### 7.6 Plans library and Plan detail

#### `/plans` — library

```
┌──────────────────────────────────────────────────┐
│ Your plans                          ⌕            │
│ ┌──────┬──────┬──────┬──────┬──────┐             │
│ │ All  │ Trip │ Day  │Study │Outing│  filter     │
│ └──────┴──────┴──────┴──────┴──────┘             │
├──────────────────────────────────────────────────┤
│ ┌──────────────────────────────────────────────┐ │
│ │ ◆ TRIP           Three Days in Paris      ⋯  │ │
│ │ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 2/7       │ │
│ │ “I need to prepare for a trip to Paris”      │ │
│ │ 2 days ago                                   │ │
│ └──────────────────────────────────────────────┘ │
│ ┌──────────────────────────────────────────────┐ │
│ │ ◆ DAY            Recover and Reset        ⋯  │ │
│ │ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 5/5  ✓    │ │
│ │ “i have energy but no plan today”            │ │
│ │ Yesterday                                    │ │
│ └──────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────┘
```

- Source: `GET /api/plans/{user_id}?limit=20`, newest first. Infinite scroll raises `limit` in steps
  of 20 up to the backend max of 100; past that, show "Showing your 100 most recent plans".
- Each row shows the **original prompt** in quotes — that is how people actually remember a plan
  ("the one where I said I had no energy").
- Progress counts `tasks` + `outing_readiness` together. A fully complete plan gets a check and a
  4 %-opacity brand background wash.
- Filter chips derive from the `plan_type` values actually present; chips with no plans are not shown.
- Search filters client-side over `title`, `description` and `prompt` (no search endpoint exists).
- `⋯` → **Open** · **Copy as text** · **Delete**.
- Delete: confirmation dialog (`confirmation-dialogs`), destructive button in
  `--color-destructive`, spatially separated from Cancel. On success, remove the row with a 200 ms
  collapse and show a toast. `DELETE` returns `204` and is **not undoable** — hence the dialog rather
  than an Undo toast.
- Completed plans are never auto-hidden. A "Hide completed" toggle is available and remembered.

#### `/plans/[planId]` — detail

Same checklist component as `<PlanCard>`, at full width with everything expanded:

```
┌──────────────────────────────────────────────────┐
│ ← Plans                                     ⋯    │
│                                                  │
│ ◆ TRIP PLAN · 2 days ago · gemma4:31b            │
│ Three Days in Paris                              │
│ A relaxed first trip built around cafés…         │
│                                                  │
│ ┌ You asked ───────────────────────────────────┐ │
│ │ “I need to prepare for a trip to Paris”      │ │
│ │ mood: excited                            ▾   │ │
│ └──────────────────────────────────────────────┘ │
│                                                  │
│ Tasks                                  2/7 done  │
│ … full editable list, no collapse …              │
│                                                  │
│ Before you go                        0/5 packed  │
│ … full editable list …                           │
│                                                  │
│ Places (3)                                       │
│ … full place cards + map …                       │
│                                                  │
│ ┌──────────────────────────────────────────────┐ │
│ │  Continue this in chat                       │ │
│ └──────────────────────────────────────────────┘ │
│  Delete plan                                     │
└──────────────────────────────────────────────────┘
```

- **You asked** block is collapsed by default, showing the original `prompt` and `mood`. It answers
  "why does my plan say this?" — the honesty affordance for a generated artefact.
- `model` is shown quietly in the meta line. Useful, and it costs nothing.
- **Continue this in chat** seeds a new chat thread with the plan title as context — the bridge back
  to the conversation.
- **Delete plan** sits alone at the bottom, visually separated (`destructive-nav-separation`).
- Back preserves the library's scroll position and filter (`state-preservation`).

#### Item mutations — the index-shift trap

All three item endpoints return the **full updated `PlanDocument`**. Indices shift after a delete.

```
RULES (non-negotiable):
1. Always replace local state from the returned PlanDocument. Never splice locally.
2. Serialise mutations per plan_id through a queue — one in flight at a time.
   Two concurrent PATCHes on shifting indices corrupt the plan.
3. Optimistic UI is allowed for `completed` only (instant tick, reconcile on response).
   Rename / add / delete wait for the response with a row-level spinner.
4. On 404 ("Plan or checklist item not found (or changed concurrently)"):
   refetch the plan, show "This plan changed — refreshed it for you."
```

Delete item → optimistic removal + **Undo toast for 5 s** (`undo-support`); Undo re-adds via
`POST .../items` (it lands at the end — tell the user: "Restored at the end of the list").

---

### 7.7 Voice mode

`WS /api/voice/ws?user_id=…`. Gated on `voice_enabled` from `/health`.

```
┌──────────────────────────────────────────────────┐
│ ← Voice                                     ⋯    │
│                                                  │
│                                                  │
│              ╭──────────────╮                    │
│              │              │                    │
│              │      ▮▮▮     │   ← orb, reacts    │
│              │    ▮▮▮▮▮▮▮   │     to amplitude   │
│              │              │                    │
│              ╰──────────────╯                    │
│                                                  │
│                 Listening…                       │
│                                                  │
│  ┌────────────────────────────────────────────┐  │
│  │ You    i want to go out tonight            │  │
│  │ ───────────────────────────────────────    │  │
│  │ K      Sure — which area are you in?       │  │
│  │ ───────────────────────────────────────    │  │
│  │ You    hamra                               │  │
│  │ ───────────────────────────────────────    │  │
│  │ ⚙ Building your plan…                      │  │
│  └────────────────────────────────────────────┘  │
│                                                  │
│  ┌─── PlanCard appears here on plan_generated ─┐ │
│                                                  │
│      ┌──────────┐        ┌──────────┐            │
│      │ ⏸ Mute   │        │  ■ End   │            │
│      └──────────┘        └──────────┘            │
└──────────────────────────────────────────────────┘
```

#### Session lifecycle

| Phase | UI |
|---|---|
| Idle | Big **Start talking** button + one line: "Khalesni will listen and reply out loud." |
| Permission | Browser mic prompt. Before triggering it, a one-liner explains why (`progressive-disclosure`). Denied → "Microphone access is off. Enable it in your browser settings." + a Chat fallback link. |
| Connecting | Orb pulses grey, "Connecting…". Timeout 10 s → error. |
| `ready` | Orb turns brand-coloured, "Listening…". Store `session_id`. |
| User speaking | Orb scales with input amplitude (transform only, 60 fps). |
| Assistant speaking | Orb switches to the accent colour + a distinct waveform. Label "Khalesni is speaking". |
| `tool_started` | Inline row in the transcript: "⚙ Building your plan…" (`create_plan`) / "Checking what you like…" (`get_my_preferences`). **Explain the silence** — the model waits while the graph runs. |
| `plan_generated` | `<PlanCard>` renders in the transcript and the plan is already saved. Toast: "Plan saved." |
| `interrupted` | **Flush the playback queue immediately.** Orb returns to listening. This is barge-in — any delay feels broken. |
| `turn_complete` | Orb back to listening. |
| `session_ending` | Reason-specific line, then the summary screen. |
| `error` | Inline error row; the session stays open if the socket is still alive. |

#### Audio pipeline (exact, from the backend contract)

```
MIC  → getUserMedia({audio:{channelCount:1, echoCancellation:true, noiseSuppression:true}})
     → AudioContext → AudioWorkletNode ("mic-processor")
     → resample to 16 000 Hz mono, Float32 → PCM16 little-endian
     → buffer into ~40 ms chunks (1280 bytes)   [contract: 20–100 ms, ≤ 64 KB]
     → ws.send(ArrayBuffer)

WS binary in (PCM16 LE mono 24 000 Hz)
     → queue → AudioBufferSourceNode chain at 24 kHz → speakers
     → on `interrupted`: stop all sources, clear the queue, reset the play cursor
```

- **Never** send at the mic's native 48 kHz. The backend expects 16 kHz; a mismatch makes the model
  hear chipmunks.
- Playback must be a **queue with a cursor**, not one buffer per frame, or audio will gap and click.
- Keep an `AudioContext.resume()` on the first user gesture (autoplay policy).

#### Close codes

| Code | Meaning | UI |
|---|---|---|
| 1008 | Bad origin or invalid `user_id` | "Voice isn't available for this handle." Log details for the dev. |
| 1013 | A session for this user is already open | "Voice is already open in another tab. Close it and try again." + **Retry** |
| 1000 / other | Normal / network | "Voice ended." + **Start again** |

Reconnect: **do not auto-reconnect.** A silently reopened mic is a privacy problem. Always require a
tap.

#### Session end summary

```
Session ended · 4 min 12 s
1 plan created  →  [ Three Days in Paris ]
[ Start again ]   [ Back to chat ]
```

#### When voice is off

`voice_enabled: false` → the Voice tab stays visible but disabled, with a sheet on tap:
"Voice mode isn't switched on for this server." (`empty-nav-state`). Never hide the tab — a missing
destination reads as a broken build.

---

### 7.8 `/settings` — You

```
┌──────────────────────────────────────────────────┐
│ You                                              │
│                                                  │
│ IDENTITY                                         │
│  Handle                              nour   ✎    │
│  Switch handle                              →    │
│                                                  │
│ PREFERENCES                                      │
│  Language                     English · العربية  │
│  Theme                     System · Light · Dark │
│  Default mood                       Neutral ▾    │
│  Default location            Hamra, Beirut   ✎   │
│  Use my location                          [ ⌖ ]  │
│                                                  │
│ WHAT KHALESNI CAN DO RIGHT NOW                   │
│  ● Plans and chat              Working           │
│  ● Saved plans                 Working           │
│  ● Memory of your preferences  Working           │
│  ● Place search                Unavailable  ⓘ    │
│  ● Voice mode                  Off          ⓘ    │
│  Model: gemma4:31b via ollama                    │
│                                                  │
│ DATA                                             │
│  Clear this conversation                    →    │
│  Delete all my plans                        →    │
│                                                  │
│  Khalesni v0.1 · Request ID a7f3…  [Copy]        │
└──────────────────────────────────────────────────┘
```

- **Status list is generated from `/health`** — a status dot (green / amber / red) with a **text
  label** beside it (`color-not-only`). `ⓘ` explains the consequence in plain language, e.g. place
  search: "Khalesni can still plan, but it won't suggest specific venues."
- Switching handle warns that the current conversation will be cleared and shows what carries over
  (plans and memory live on the server, keyed to the handle).
- **Delete all my plans** is a loop of `DELETE /api/plans/{user_id}/{plan_id}`; requires typing the
  handle to confirm, shows progress, and reports partial failures honestly.
- The last request id is copyable — it makes any bug report actionable.

---

## 8. Design system

### 8.1 Visual direction

**Soft UI Evolution** — modest elevation, soft-but-readable shadows, generous radii, measured
contrast. Right for a tool that must feel calm while it does heavy work: the interface recedes and the
content (checklists, places) carries the visual weight.

Avoid: neumorphism (fails contrast), heavy gradients on data surfaces, glassmorphism over text.

### 8.2 Colour tokens

Base palette source: the verified **Productivity Tool** palette from the design dataset (teal focus +
action orange). Two values were **adjusted for WCAG** and the reasons are recorded — keep them.

```css
:root {
  /* Brand — teal */
  --brand-700: #0F766E;   /* primary action bg; white text = 5.5:1 ✓ AA */
  --brand-600: #0D9488;   /* focus ring, icons, active nav */
  --brand-500: #14B8A6;   /* secondary, dark-mode primary */
  --brand-100: #CCFBF1;   /* subtle fills, progress track */
  --brand-050: #F0FDFA;   /* page canvas */

  /* Accent — action orange (voice active, live badge) */
  --accent-600: #EA580C;  /* fills / icons only — 3.5:1 on white, NOT for text */
  --accent-700: #C2410C;  /* accent TEXT on light; white text = 5.2:1 ✓ AA */

  /* Semantic — light */
  --color-background:       #F0FDFA;
  --color-foreground:       #134E4A;   /* 9.4:1 on white ✓ */
  --color-card:             #FFFFFF;
  --color-card-foreground:  #134E4A;
  --color-muted:            #E8F1F4;
  --color-muted-foreground: #475569;   /* 7.0:1 on white ✓ */
  --color-primary:          var(--brand-700);
  --color-on-primary:       #FFFFFF;
  --color-secondary:        var(--brand-500);
  --color-accent:           var(--accent-600);
  --color-on-accent:        #FFFFFF;
  --color-border:           #CCFBF1;   /* decorative dividers only */
  --color-border-input:     #64748B;   /* 4.8:1 — meaningful boundaries, ≥3:1 ✓ */
  --color-destructive:      #DC2626;
  --color-on-destructive:   #FFFFFF;
  --color-warning:          #B45309;   /* "not on the map", "may be outdated" */
  --color-success:          #047857;
  --color-ring:             var(--brand-600);
  --color-scrim:            rgb(15 23 42 / 0.55);
}

:root[data-theme="dark"] {
  --color-background:       #0B1220;
  --color-foreground:       #E6EDF3;
  --color-card:             #111C2E;
  --color-card-foreground:  #E6EDF3;
  --color-muted:            #17253A;
  --color-muted-foreground: #94A3B8;   /* 7.3:1 on bg ✓ */
  --color-primary:          var(--brand-500);
  --color-on-primary:       #062120;   /* dark text on teal ✓ */
  --color-secondary:        #5EEAD4;
  --color-accent:           #FB923C;   /* desaturated for dark, not the light hex */
  --color-on-accent:        #1C1207;
  --color-border:           rgb(255 255 255 / 0.10);
  --color-border-input:     #64748B;   /* 4.0:1 on bg ✓ */
  --color-destructive:      #F87171;
  --color-on-destructive:   #2A0808;
  --color-warning:          #FBBF24;
  --color-success:          #34D399;
  --color-ring:             #5EEAD4;
  --color-scrim:            rgb(0 0 0 / 0.65);
}
```

**Two adjustments worth remembering:**

1. `--brand-600` (#0D9488) is only **3.75:1** against white — fine for icons and rings (≥3:1) but it
   **fails for button text**. Primary buttons therefore use `--brand-700`.
2. The dataset border (#99F6E4) is ~1.3:1 against white — invisible as an input boundary. Decorative
   dividers keep it (`--color-border`); anything meaning "this is a control" uses
   `--color-border-input`.

Rules applied: `color-semantic`, `color-dark-mode` (desaturated dark variants, not inverted),
`color-accessible-pairs`, `color-not-only`, `state-contrast parity`.

### 8.3 Typography

Bilingual, so the type system is built around matched Latin/Arabic pairs.

```css
@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@500;600;700&family=Open+Sans:wght@400;500;600;700&family=Noto+Kufi+Arabic:wght@500;600;700&family=Noto+Sans+Arabic:wght@400;500;600;700&display=swap');

:root {
  --font-heading: 'Poppins', 'Noto Kufi Arabic', system-ui, sans-serif;
  --font-body:    'Open Sans', 'Noto Sans Arabic', system-ui, sans-serif;
  --font-mono:    ui-monospace, 'SF Mono', Menlo, monospace; /* request ids, coordinates */
}
:root[dir="rtl"] {
  --font-heading: 'Noto Kufi Arabic', 'Poppins', system-ui, sans-serif;
  --font-body:    'Noto Sans Arabic', 'Open Sans', system-ui, sans-serif;
}
```

The Latin pair (geometric Poppins headings + humanist Open Sans body) is the dataset's verified
"Modern Professional" pairing; the Noto Arabic counterparts match its humanist/geometric split and
share compatible metrics. *Single-family alternative if the two stacks ever feel mismatched:* IBM Plex
Sans Arabic for both scripts.

`font-display: swap` on every face; preload only the body regular weight (`font-preload`).

| Token | Size / line-height | Weight | Use |
|---|---|---|---|
| `display` | 32 / 1.2 | 700 | Empty-state greeting |
| `h1` | 24 / 1.3 | 600 | Screen titles |
| `h2` | 20 / 1.35 | 600 | Plan title, card titles |
| `h3` | 17 / 1.4 | 600 | Section headers, place names |
| `body` | 16 / 1.6 | 400 | Everything the user reads |
| `body-sm` | 14 / 1.55 | 400 | Addresses, meta, helper text |
| `label` | 13 / 1.4 | 500 | Buttons, nav, chips |
| `caption` | 12 / 1.4 | 400 | Timestamps, counters, footnotes |
| `overline` | 11 / 1.2, `0.04em` | 600, uppercase | Type badges |

- Body **never** below 16 px on mobile (`readable-font-size`).
- Prose capped at `68ch` (`line-length`).
- `font-variant-numeric: tabular-nums` on progress counts, distances, durations and timers
  (`number-tabular`).
- Support OS text scaling to 200 % without breaking layout (`dynamic-type`).

### 8.4 Spacing, radius, elevation

```css
:root {
  --space-1: 4px;  --space-2: 8px;  --space-3: 12px; --space-4: 16px;
  --space-5: 24px; --space-6: 32px; --space-7: 48px; --space-8: 64px;

  --radius-sm: 8px;    /* chips, inputs */
  --radius-md: 12px;   /* buttons, rows */
  --radius-lg: 16px;   /* cards */
  --radius-xl: 24px;   /* sheets, composer */
  --radius-full: 999px;

  --shadow-1: 0 1px 2px rgb(15 23 42 / 0.05), 0 1px 3px rgb(15 23 42 / 0.06);
  --shadow-2: 0 2px 6px rgb(15 23 42 / 0.06), 0 8px 24px rgb(15 23 42 / 0.07);
  --shadow-3: 0 8px 32px rgb(15 23 42 / 0.12);

  --icon-sm: 16px; --icon-md: 20px; --icon-lg: 24px;

  --z-base: 0; --z-sticky: 10; --z-nav: 20; --z-sheet: 40;
  --z-modal: 100; --z-toast: 1000;
}
```

Elevation map: cards `--shadow-1` · composer & sticky header `--shadow-2` · sheets and modals
`--shadow-3`. Three levels, no ad-hoc shadows (`elevation-consistent`). In dark mode, shadows carry
less weight — separate surfaces with `--color-card` lightness plus a 1 px `--color-border` instead.

### 8.5 Motion

```css
:root {
  --dur-fast: 120ms;   /* tick, press, hover */
  --dur-base: 200ms;   /* card enter, crossfade, stage change */
  --dur-slow: 320ms;   /* sheets, route transitions */
  --ease-out: cubic-bezier(0.22, 1, 0.36, 1);
  --ease-in:  cubic-bezier(0.55, 0, 1, 0.45);
  --spring: 420ms cubic-bezier(0.34, 1.4, 0.64, 1);  /* sheets only */
}
```

| Interaction | Motion |
|---|---|
| Checkbox tick | Box fills `--dur-fast`, check draws 160 ms, label strikethrough 120 ms. Feedback within 100 ms of the tap. |
| Card enter | `translateY(12px) → 0` + opacity, `--dur-base`, `--ease-out`. |
| List children | 40 ms stagger, max 8 items animated then the rest appear instantly (`excessive-motion`). |
| Stage chip change | Crossfade `--dur-base`. |
| Sheet / modal | Slide from the trigger edge with `--spring`; scrim fades `--dur-base` (`modal-motion`). |
| Route change | Forward slides in from the end edge, back from the start edge — **direction flips under RTL** (`navigation-direction`). |
| Voice orb | Continuous transform-only scale driven by amplitude; no layout properties. |
| Exit | ~65 % of the enter duration (`exit-faster-than-enter`). |

Hard rules: animate `transform` and `opacity` only. Every animation is interruptible and never blocks
input. Under `prefers-reduced-motion: reduce`, all of the above become opacity-only crossfades at
100 ms, the orb becomes a static amplitude bar, and the spinner becomes a pulsing dot.

### 8.6 Icons

**Phosphor** (`@phosphor-icons/react`), regular weight (1.5 px stroke), one family throughout. Sizes
from the tokens only. **No emoji as icons, anywhere.**

| Concept | Icon | Concept | Icon |
|---|---|---|---|
| Chat / home | `ChatCircleDots` | Plans | `ListChecks` |
| Voice | `Microphone` | Settings | `UserCircle` |
| Send | `PaperPlaneRight` (mirrors in RTL) | Stop | `Stop` |
| New chat | `PlusCircle` | Overflow | `DotsThree` |
| Trip | `Suitcase` | Outing | `MapTrifold` |
| Study | `BookOpen` | Day plan | `SunHorizon` |
| General | `ListChecks` | Real-time | `Lightning` |
| Place | `MapPin` | Open map | `NavigationArrow` |
| Phone | `Phone` | Website | `ArrowSquareOut` |
| Hours | `Clock` | Warning | `Warning` |
| Saved | `CheckCircle` | Not saved | `CloudSlash` |
| Add | `Plus` | Delete | `Trash` |
| Rename | `PencilSimple` | Copy | `Copy` |
| Location | `Crosshair` | Mood | `Smiley` |

Decorative icons beside visible text get `aria-hidden="true"`. Icon-only controls get an `aria-label`
and a tooltip. Meaningful icons hold ≥ 3:1 contrast against their background (`icon-contrast`).

---

## 9. Bilingual & RTL

### Mechanics

- `next-intl` with `en` and `ar` message catalogues. Locale in a cookie, not the URL — the app is one
  personal surface, not a marketing site with per-locale SEO.
- `<html lang="ar" dir="rtl">` set server-side so there is **no LTR flash**.
- **Logical CSS properties only:** `margin-inline-start`, `padding-inline-end`, `inset-inline-start`,
  `border-start-start-radius`. No `left` / `right` in component CSS. Tailwind: `ps-4` / `pe-4` / `ms-2`
  / `text-start`, never `pl-` / `pr-` / `text-left`.
- Mirror directional icons (send, back, chevrons) with `[dir="rtl"] .icon-directional { transform: scaleX(-1) }`.
  **Do not mirror** logos, the clock, the map pin, or media controls.
- Route transitions reverse direction under RTL.

### Content rules

- Numbers, distances, coordinates and phone numbers render in **Latin digits in both locales** (the
  backend returns them that way, and Lebanese users read Latin digits for phones). Dates and relative
  times localise via `Intl.RelativeTimeFormat`.
- Phone numbers get `dir="ltr"` and `unicode-bidi: isolate` so they do not scramble inside Arabic text.
- URLs, `osm_id` values and request ids: `dir="ltr"`, `--font-mono`, `overflow-wrap: anywhere`
  (`long-token-wrapping`).
- **The user may write Arabic while the UI is English, and vice versa.** Assistant text is rendered
  with `dir="auto"` per bubble so the model's own language wins for that block.
- Do not translate place names, `note` quotes, or source domains — they are data.
- Every string lives in the catalogue; zero hardcoded copy in components. Catalogue keys mirror the
  component tree (`chat.composer.placeholder`).

Test at 375 px in both directions before calling any screen done.

---

## 10. Component inventory

### Primitives (`components/ui/`) — shadcn/ui based

`Button` (primary · secondary · ghost · destructive × sm/md/lg) · `IconButton` · `Input` · `Textarea` ·
`Checkbox` · `Chip` · `Badge` · `Card` · `Sheet` · `Dialog` · `DropdownMenu` · `Toast` · `Skeleton` ·
`Spinner` · `Progress` · `Tooltip` · `Switch` · `Tabs` · `Avatar` · `Separator` · `ScrollArea` ·
`EmptyState` · `ErrorState`

Every interactive primitive ships: hover, focus-visible (2 px `--color-ring`, 2 px offset), active
(0.97 scale), disabled (opacity 0.45 + `cursor: not-allowed` + the real `disabled` attribute), and
loading.

### Feature components

| Component | Props (from the contract) | Notes |
|---|---|---|
| `<ResponseRouter>` | `response: GeneratePlanResponse` | The only `type` / `plan_type` switch in the app |
| `<Thread>` | `messages: Message[]` | Virtualised > 50, scroll anchoring, jump-to-latest |
| `<UserBubble>` | `content: string` | `dir="auto"` |
| `<ReplyBubble>` | `text, streaming?: boolean` | Token append target |
| `<StageChip>` | `status, detail?` | Fixed 32 px height, `aria-live="polite"` |
| `<Composer>` | `onSend(prompt)`, `busy`, `onStop` | Auto-grow, draft autosave, counter |
| `<ContextChips>` | `mood, location, onClear` | Always visible when set |
| `<MoodPicker>` | `value, onChange` | 6 chips in a sheet |
| `<LocationAskCard>` | `reply`, 3 callbacks | Geolocate · type · decline |
| `<PlanCard>` | `plan: PlanOutput`, `planId`, `persisted`, `planType`, `createdAt` | Compact, 5-item collapse |
| `<Checklist>` | `items`, `itemType: ItemType`, `planId`, `editable` | Shared by card + detail. Owns the mutation queue. |
| `<ChecklistRow>` | `item`, `index`, `onToggle/onRename/onDelete` | 44 px, inline edit, row spinner |
| `<AddItemRow>` | `itemType`, `onAdd` | Stays open for rapid entry |
| `<ProgressMeter>` | `done, total, label` | Bar **and** text |
| `<PlacesCard>` | `reply, places: Place[]` | Never shows plan actions |
| `<PlaceRow>` | `place: Place, index` | Handles every optional field + the no-coordinates warning |
| `<PlacesMap>` | `places` | Lazy-loaded, coordinates only |
| `<AnswerCard>` | `answer, sources, createdAt` | Sources always rendered |
| `<SourceList>` | `sources` | Numbered, new tab, `rel="noopener noreferrer"` |
| `<PersistenceNotice>` | `persisted, planId, onRetry` | Amber, inline, not a toast |
| `<PlanListItem>` | `plan: PlanDocument` | Shows the original prompt |
| `<PlanFilters>` | `types, active, onChange` | Only types present |
| `<VoiceOrb>` | `state, amplitude` | Transform-only |
| `<VoiceTranscript>` | `turns, toolStatus` | Tool rows explain silence |
| `<CapabilityBanner>` | `capability` | From `/health` |
| `<ErrorCard>` | `kind, requestId, onRetry` | Copyable request id |
| `<NavShell>` | `children` | Bottom nav ↔ sidebar at 1024 px |

---

## 11. State, data & streaming layer

### 11.1 Identity (and the auth caveat)

The backend has **no auth**; `user_id` is trusted as sent. So:

- `user_id` lives in `localStorage.khalesni.user_id`, normalised client-side (trim + lowercase) to
  match the server exactly.
- It is a **handle, not an account**. The first-run screen and Settings both say so.
- When auth arrives (a JWT replacing `normalise_user_id` on the backend), only
  `lib/identity.ts` changes. Keep every read of the user id going through `useIdentity()` so that
  swap is one file.
- Never put `user_id` in a URL the user might share.

### 11.2 Stores

| Store | Tech | Persisted | Holds |
|---|---|---|---|
| `useIdentity` | Zustand | `localStorage` | `userId` |
| `usePrefs` | Zustand | `localStorage` | `locale`, `theme`, `mood`, `location` |
| `useThread` | Zustand | `sessionStorage` | `messages[]`, `streaming`, `abortController` |
| `useCapabilities` | React Context | – | `/health` snapshot, 60 s TTL |
| Server data | TanStack Query | – | plans list, plan detail |

### 11.3 Query keys and invalidation

```ts
const keys = {
  health:            ["health"] as const,
  plans:  (u: string, limit: number) => ["plans", u, limit] as const,
  plan:   (u: string, id: string)    => ["plan",  u, id]    as const,
};

// After a successful generate with plan_id → invalidate keys.plans(userId, *)
// After any item mutation → setQueryData(keys.plan(u, id), returned PlanDocument)
//                          + invalidate keys.plans(u, *)   (progress counts change)
// After delete plan → remove keys.plan(u, id), invalidate keys.plans(u, *)
```

### 11.4 API client

One typed module, `lib/api/`, with nothing else in the app calling `fetch`:

```
lib/api/
  client.ts      // baseUrl, JSON, timeouts, X-Request-ID capture, ApiError
  plans.ts       // generate, generateStream, list, get, remove
  items.ts       // toggle, rename, add, remove  (queued per plan)
  places.ts      // search (gated on capabilities.places)
  health.ts
  normalise.ts   // GeneratePlanResponse | PlanDocument → internal Plan
  types.ts       // §6.3, mirrors app/models.py
```

Client rules:

- Every response's `X-Request-ID` is stored in a ring buffer of the last 10 (Settings shows the
  latest; error cards show the matching one).
- `ApiError { status, detail, requestId }`; the UI branches on `status`, never on message text.
- Timeouts: generate **90 s**, everything else **15 s**. Each carries an `AbortSignal`.
- Retries: `GET` retries twice with backoff; **no automatic retry on the generate endpoints** — they
  cost money and time, so retry is always a user action.

### 11.5 SSE consumption

Use `fetch` + `ReadableStream`, **not** `EventSource` — the endpoint is a `POST` with a JSON body and
`EventSource` cannot do that.

```ts
const res = await fetch(`${base}/api/generate-plan/stream`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ user_id, prompt, mood, location, ask_location, history }),
  signal,
});
// Parse text/event-stream frames: "event: <name>\ndata: <json>\n\n"
// Keep a carry-over buffer across chunk boundaries — a frame can split mid-JSON.
```

Handling rules:

- Buffer partial frames. A split `data:` line is the classic bug here.
- Unknown event names are ignored, not thrown — the backend may add more.
- `result` is authoritative: discard the accumulated tokens and render from it.
- If the stream ends with **no** `result` and no `error`, treat it as a failure: error card with
  Retry.
- `Stop` aborts the signal and marks the message "Stopped." with a Retry.
- The backend sends `X-Accel-Buffering: no`; if a proxy still buffers, the stage chip will jump
  straight to `writing` — acceptable, but note it if streaming ever looks broken in production.

### 11.6 Voice WebSocket

One module, `lib/voice/`:

```
session.ts    // connect, close-code mapping, event dispatch, no auto-reconnect
capture.ts    // AudioWorklet: 48k → 16k mono PCM16, ~40 ms chunks
playback.ts   // 24 kHz queue with a cursor; flush() for `interrupted`
worklet/mic-processor.js
```

Single session per user is enforced by the backend (1013). Guard client-side too: if a voice session
is open in this tab, the Voice tab shows "Session active" instead of "Start talking".

### 11.7 Optimistic updates — where they are allowed

| Action | Optimistic? | Why |
|---|---|---|
| Toggle `completed` | **Yes** | Instant tick is the whole point. Roll back + toast on failure. |
| Rename item | No | The server returns the canonical document; a row spinner is honest and cheap. |
| Add item | No | Position is decided by the server (it appends). |
| Delete item | Yes, with **Undo** | Indices shift; the returned document is the truth. |
| Delete plan | No | Irreversible; the confirm dialog already covers the wait. |

All item mutations pass through the per-plan queue described in §7.6.

---

## 12. Every state: loading, empty, error

### 12.1 Loading

| Surface | Treatment |
|---|---|
| Plans list | 3 skeleton cards matching the real row height (`content-jumping`) |
| Plan detail | Skeleton title + 5 skeleton rows |
| Generating | Stage chip — **never** a full-screen spinner; the thread stays readable and scrollable |
| Place cards during stream | Rendered as they arrive from the `places` event |
| Item mutation | 16 px spinner in the row, row at 0.6 opacity, row not interactive |
| Voice connecting | Grey pulsing orb + "Connecting…" |
| Map | Fixed-aspect placeholder box, then the tiles (`image-dimension`) |

Anything under ~300 ms shows **no** indicator (`loading-indicators` — avoid flashing). Anything over
1 s gets a skeleton, not a spinner. `aria-busy` on the region throughout.

### 12.2 Empty states

| Where | Copy | Action |
|---|---|---|
| Chat, first visit | "Good evening, nour. What's on your mind?" | 4 starter chips |
| Plans, none yet | "No plans yet. Tell Khalesni what's on your mind and it'll build your first checklist." | **Start a chat** |
| Plans, filter empty | "No {trip} plans yet." | **Clear filter** |
| Plan with 0 tasks | "Every task is gone. Add one to keep this plan alive." | **Add a task** |
| No places found | The backend's own `chat.reply` (it names no venue) | **Try a wider area** |
| Real-time, no sources | "No sources returned." | – |
| Voice, no transcript | "Say something — Khalesni is listening." | – |

### 12.3 Errors

| Trigger | Copy | Actions |
|---|---|---|
| 502 generate | "Khalesni couldn't finish that one. It happens with very long or unusual messages." | **Retry** · **Edit message** · Copy details |
| 504 generate | "That took too long. A shorter message usually works." | **Retry** · **Edit message** |
| 503 on plans | "Your saved plans aren't reachable right now. You can still chat — new plans just won't be stored." | **Retry** |
| 500 | "Something broke on our side." | **Retry** · Copy details |
| Network offline | "You're offline. Khalesni needs a connection to think." | Auto-retry on reconnect |
| 404 plan | "That plan is gone." | **Back to plans** |
| 404 item | "This plan changed — refreshed it for you." | auto-refetch, toast only |
| 422 | Inline on the field | – |
| `persisted: false` | "Not saved. Khalesni wrote this plan but couldn't store it." | **Try saving again** |
| Places unavailable | "Place search is off on this server, so Khalesni won't name specific venues." | – |
| Mic denied | "Microphone access is off. Enable it in your browser settings." | **How** · **Use chat instead** |
| WS 1013 | "Voice is already open in another tab." | **Retry** |
| WS 1008 | "Voice isn't available for this handle." | **Back to chat** |

Every error states a **cause and a way forward** (`error-clarity`, `error-recovery`). Errors live
inline where the work was, not only in a toast. Toasts (3–5 s, `aria-live="polite"`, never stealing
focus) are for confirmations and Undo.

---

## 13. Accessibility specification

Target: **WCAG 2.2 level AA**.

### Contrast

- Body and secondary text ≥ 4.5:1 in both themes. Verified pairs are in §8.2 with their ratios.
- Icons carrying meaning, control borders, focus rings ≥ 3:1.
- Status is never colour alone — dot **plus** label (`color-not-only`).
- The dark palette is verified independently, not inferred from light values.

### Keyboard

| Key | Action |
|---|---|
| `Tab` / `Shift+Tab` | Order matches visual order (start-to-end, mirrored under RTL) |
| `Enter` (composer, desktop) | Send · `Shift+Enter` newline |
| `Space` / `Enter` on a row | Toggle the item |
| `E` on a focused row | Rename · `Escape` cancels |
| `Escape` | Close sheet / dialog / cancel inline edit |
| `Cmd/Ctrl+K` | Focus the composer from anywhere |
| `Cmd/Ctrl+Shift+O` | New chat |
| `/` | Focus search on `/plans` |

- `Escape` closes every overlay and every multi-step flow has a visible Cancel (`escape-routes`).
- Focus is trapped inside dialogs and returns to the trigger on close.
- After a route change, focus moves to the `<main>` landmark (`focus-on-route-change`).
- The sticky composer and bottom nav must **never** cover the focused control — the thread reserves
  bottom padding equal to their combined height, and `scroll-padding-block-end` matches it
  (`focus-not-obscured`).
- Skip link to main content as the first focusable element.

### Screen readers

- Landmarks: `<header>`, `<nav>`, `<main>`, `<footer>`. One `<h1>` per route, no skipped levels.
- The thread is `role="log"` `aria-live="polite"`; the stage chip announces stage changes as complete
  sentences ("Looking for places near Hamra"), not fragments (`contextual-live-badge-updates`).
- Token streaming does **not** announce every token. The bubble is `aria-busy` while streaming and
  announced once on completion.
- Checkboxes are real `<input type="checkbox">` with `<label for>`; progress is
  `role="progressbar"` with `aria-valuenow/min/max` **and** visible text.
- Place cards are `<article>` with `aria-labelledby` on the name. The "not on the map" warning is
  inside the article's accessible description, not decoration.
- Icon-only buttons all carry `aria-label`; decorative icons carry `aria-hidden="true"`.
- Form errors use `role="alert"` and `aria-describedby` on the field (`aria-live-errors`).
- The voice orb is `aria-hidden`; state is announced through a live region in text ("Listening",
  "Khalesni is speaking", "Building your plan").

### Motor and cognitive

- Targets ≥ 44×44 px (≥ 24×24 px absolute minimum on web), ≥ 8 px apart.
- No drag-only interaction anywhere; the map is an enhancement over a keyboard-reachable list
  (`dragging-alternative`).
- No time limits. Nothing auto-rotates.
- `prefers-reduced-motion` honoured throughout (§8.5).
- Layout survives 200 % text zoom and 400 % browser zoom without horizontal scroll.
- Information already given (handle, location, mood) is never asked for twice
  (`redundant-entry`).

---

## 14. Responsive specification

Breakpoints: **375 / 768 / 1024 / 1440**. Mobile-first; every feature works at 375 px first.

| Element | 375 px | 768 px | 1024 px | 1440 px |
|---|---|---|---|---|
| Shell | Bottom nav | Bottom nav | Sidebar 240 px | Sidebar 240 px |
| Content width | 100 % − 32 px | 640 px centred | 760 px | 760 px |
| Gutters | 16 px | 24 px | 32 px | 32 px |
| Plan card padding | 16 px | 20 px | 24 px | 24 px |
| Places | 1 column | 1 column | 2 columns | 2 columns |
| Starter chips | 2 × 2 grid | 4 in a row | 4 in a row | 4 in a row |
| Plan detail | Single column | Single column | Checklist + sticky places rail | Same |
| Map preview | 96 px thumbnail | 96 px | 320 px inline map | 320 px |
| Composer | Full-width sticky | Sticky, 640 px | Sticky, 760 px | Same |
| Voice orb | 160 px | 200 px | 240 px | 240 px |

Rules: `min-h-dvh` not `100vh`; `env(safe-area-inset-bottom)` added to the bottom nav's own padding;
the thread reserves bottom padding for composer + nav (`fixed-element-offset`); no horizontal scroll
at any width — only tables, code blocks and the map may scroll inside their own
`overflow-x: auto` container; landscape phone keeps the composer reachable (nav collapses to icons
above the keyboard).

---

## 15. Performance budget

| Metric | Budget |
|---|---|
| LCP (4G, mid Android) | ≤ 2.5 s |
| CLS | ≤ 0.05 |
| INP | ≤ 200 ms |
| First-load JS (route `/`) | ≤ 180 KB gzipped |
| Time to first `status` event | ≤ 1.5 s after Send |

How we get there:

- Server Components for shells, static copy and the plans list; Client Components only where there is
  state (composer, checklist, voice, map).
- `next/dynamic` for the Leaflet map, the voice module (AudioWorklet + WS) and the mood sheet — none
  are on the critical path (`bundle-splitting`).
- Tree-shake Phosphor by importing individual icons, never the barrel.
- Skeletons sized to real content, `aspect-ratio` on every media box (CLS).
- Virtualise the thread beyond 50 messages and the plans list beyond 50 rows.
- Debounce the draft autosave (300 ms) and the plans search input (200 ms).
- Keep the AudioWorklet off the main thread; the voice orb animates `transform` only, capped at
  60 fps (`main-thread-budget`).
- `next/font` for self-hosted faces, preloading only the body regular weight.

---

## 16. Micro-copy library

Voice: **warm, brief, never cute.** Khalesni is a competent friend, not a mascot. No exclamation marks
in system copy. Never blame the user.

| Key | English | العربية |
|---|---|---|
| `app.tagline` | Tell me the mess. I'll turn it into a checklist. | قول لي الفوضى، وأنا أحوّلها لقائمة. |
| `onboarding.name` | What should I call you? | شو بتحب نسمّيك؟ |
| `onboarding.hint` | Letters, numbers, - and _ | حروف، أرقام، - و _ |
| `onboarding.start` | Start | ابدأ |
| `chat.greeting.morning` | Good morning, {name}. What's on your mind? | صباح الخير، {name}. شو ببالك؟ |
| `chat.greeting.evening` | Good evening, {name}. What's on your mind? | مساء الخير، {name}. شو ببالك؟ |
| `chat.placeholder` | Tell me what's on your mind… | قول لي شو ببالك… |
| `chat.send` | Send | إرسال |
| `chat.stop` | Stop | إيقاف |
| `chat.new` | New chat | محادثة جديدة |
| `chat.jumpLatest` | Jump to latest | انزل لآخر رسالة |
| `chip.planDay` | Plan my day | نظّم يومي |
| `chip.packTrip` | Pack for a trip | جهّز لسفرة |
| `chip.findCafe` | Find me a café | لاقي لي كافيه |
| `chip.studyPlan` | Study schedule | برنامج دراسة |
| `stage.thinking` | Working out what you need… | أفهم طلبك… |
| `stage.remembering` | Checking what you like… | أتذكّر ما تحبّه… |
| `stage.searching` | Looking for places… | أبحث عن أماكن… |
| `stage.checking` | Verifying the details… | أتحقّق من التفاصيل… |
| `stage.writing` | Writing your checklist… | أكتب قائمتك… |
| `stage.slow` | Still working — map searches can be slow. | لسا عم أشتغل، البحث على الخريطة بياخد وقت. |
| `plan.tasks` | Tasks | المهام |
| `plan.readiness.outing` | Before you go | قبل ما تطلع |
| `plan.readiness.general` | Bring / prepare | جهّز معك |
| `plan.places` | Places | أماكن |
| `plan.done` | {done}/{total} done | {done}/{total} خلصت |
| `plan.packed` | {done}/{total} packed | {done}/{total} جهزت |
| `plan.showMore` | Show {n} more | عرض {n} أكثر |
| `plan.addTask` | Add a task | أضف مهمة |
| `plan.addItem` | Add an item | أضف عنصر |
| `plan.open` | Open plan | افتح الخطة |
| `plan.saved` | Saved · {time} | محفوظة · {time} |
| `plan.youAsked` | You asked | أنت طلبت |
| `plan.continue` | Continue this in chat | تابع بالمحادثة |
| `plan.delete` | Delete plan | احذف الخطة |
| `plan.notSaved.title` | Not saved | ما انحفظت |
| `plan.notSaved.body` | Khalesni wrote this plan but couldn't store it. Ticking won't be remembered. | خلّصني كتب الخطة بس ما قدر يخزنها. التأشير ما رح ينحفظ. |
| `plan.notSaved.retry` | Try saving again | جرّب تحفظ مرة تانية |
| `place.openNow` | Open now | فاتح هلق |
| `place.closed` | Closed | مسكّر |
| `place.call` | Call | اتصل |
| `place.map` | Map | خريطة |
| `place.website` | Website | الموقع |
| `place.source` | Source | المصدر |
| `place.phoneSource` | Phone found on {domain} — may be outdated | الرقم من {domain} — يمكن يكون قديم |
| `place.notOnMap` | Not on the map — found on {domain} | ما هو على الخريطة — لقيناه على {domain} |
| `place.widerArea` | Try a wider area | جرّب منطقة أوسع |
| `location.ask` | Which area are you in? | بأي منطقة أنت؟ |
| `location.use` | Use my location | استخدم موقعي |
| `location.type` | Type an area | اكتب المنطقة |
| `location.skip` | Not now | ليس الآن |
| `realtime.badge` | Real-time | لحظي |
| `realtime.sources` | Sources | المصادر |
| `realtime.checked` | Checked {time} | تم التحقق {time} |
| `realtime.noSources` | No sources returned | ما في مصادر |
| `plans.title` | Your plans | خططك |
| `plans.empty` | No plans yet. Tell Khalesni what's on your mind and it'll build your first checklist. | ما في خطط لهلق. قول لخلّصني شو ببالك وبيعمل لك أول قائمة. |
| `plans.startChat` | Start a chat | ابدأ محادثة |
| `plans.hideCompleted` | Hide completed | خبّي المنجزة |
| `plans.deleteConfirm.title` | Delete this plan? | تحذف هذه الخطة؟ |
| `plans.deleteConfirm.body` | "{title}" will be gone for good. | «{title}» رح تنحذف نهائياً. |
| `voice.start` | Start talking | ابدأ الحديث |
| `voice.sub` | Khalesni will listen and reply out loud. | خلّصني رح يسمعك ويجاوبك بصوته. |
| `voice.connecting` | Connecting… | جاري الاتصال… |
| `voice.listening` | Listening… | عم أسمعك… |
| `voice.speaking` | Khalesni is speaking | خلّصني عم يحكي |
| `voice.buildingPlan` | Building your plan… | عم أبني خطتك… |
| `voice.mute` | Mute | اكتم |
| `voice.end` | End | أنهِ |
| `voice.ended` | Session ended · {duration} | انتهت الجلسة · {duration} |
| `voice.busy` | Voice is already open in another tab. Close it and try again. | الصوت مفتوح بتبويب تاني. سكّره وجرّب مرة تانية. |
| `voice.off` | Voice mode isn't switched on for this server. | وضع الصوت غير مفعّل على هذا السيرفر. |
| `voice.micDenied` | Microphone access is off. Enable it in your browser settings. | الميكروفون مقفول. فعّله من إعدادات المتصفح. |
| `error.generate` | Khalesni couldn't finish that one. It happens with very long or unusual messages. | خلّصني ما قدر يخلّص هاي. بيصير مع الرسائل الطويلة أو الغريبة. |
| `error.timeout` | That took too long. A shorter message usually works. | أخذت وقت كثير. رسالة أقصر عادة تنفع. |
| `error.plansDown` | Your saved plans aren't reachable right now. You can still chat — new plans just won't be stored. | خططك المحفوظة ما فيها وصول هلق. فيك تكمّل محادثة بس الخطط الجديدة ما رح تنحفظ. |
| `error.offline` | You're offline. Khalesni needs a connection to think. | ما في إنترنت. خلّصني محتاج اتصال. |
| `error.retry` | Retry | أعد المحاولة |
| `error.edit` | Edit message | عدّل الرسالة |
| `error.copyDetails` | Copy details | انسخ التفاصيل |
| `settings.capabilities` | What Khalesni can do right now | شو يقدر يعمل خلّصني هلق |
| `settings.placesOff` | Khalesni can still plan, but it won't suggest specific venues. | خلّصني بيضل يخطّط، بس ما رح يسمّي أماكن. |
| `settings.switchHandle` | Switch handle | بدّل الاسم |
| `undo` | Undo | رجّع |
| `undo.restoredAtEnd` | Restored at the end of the list | رجع بآخر القائمة |

Arabic strings are Levantine-leaning conversational, matching how the persona actually writes. Have a
native speaker review before launch — **this table is a first draft, not a final translation.**

---

## 17. Tech stack & file structure

### Stack

| Concern | Choice | Why |
|---|---|---|
| Framework | **Next.js 15, App Router, TypeScript strict** | Backend CORS already expects `localhost:3000`; RSC keeps the first load small |
| Styling | **Tailwind CSS v4** with the §8 tokens as CSS variables | Logical-property utilities make RTL a config concern, not a rewrite |
| Components | **shadcn/ui** (Radix primitives) | Accessible dialogs/menus/checkboxes out of the box; we own the code |
| Icons | **Phosphor** (`@phosphor-icons/react`) | One consistent family, tree-shakeable |
| Server state | **TanStack Query v5** | Cache, invalidation, optimistic mutations |
| Client state | **Zustand** | Tiny, no boilerplate, easy persistence |
| i18n | **next-intl** | Server-side `dir`/`lang`, typed catalogues |
| Animation | **Framer Motion** (layout/presence only) + CSS transitions | Enough for §8.5 without a timeline library |
| Map (optional) | **Leaflet** + OSM tiles, lazy | Free, matches the backend's OSM data |
| Validation | **Zod** | Parse every response at the boundary; contract drift fails loudly |
| Testing | Vitest + Testing Library · Playwright · axe-core | Unit, flows, automated a11y |

No charting library — v1 has no charts.

### Structure

```
khalesni_UI/
├── UI_Plan.md
├── .env.local.example        # NEXT_PUBLIC_API_BASE, NEXT_PUBLIC_STREAMING, NEXT_PUBLIC_MAP
├── app/
│   ├── layout.tsx            # html lang/dir, fonts, providers
│   ├── page.tsx              # Chat
│   ├── plans/page.tsx
│   ├── plans/[planId]/page.tsx
│   ├── voice/page.tsx
│   ├── settings/page.tsx
│   ├── onboarding/page.tsx
│   └── globals.css           # tokens from §8
├── components/
│   ├── ui/                   # primitives (§10)
│   ├── chat/                 # Thread, Composer, StageChip, ContextChips, ResponseRouter
│   ├── plan/                 # PlanCard, Checklist, ChecklistRow, ProgressMeter, PersistenceNotice
│   ├── places/               # PlacesCard, PlaceRow, PlacesMap
│   ├── realtime/             # AnswerCard, SourceList
│   ├── voice/                # VoiceOrb, VoiceTranscript, VoiceControls
│   └── shell/                # NavShell, BottomNav, Sidebar, CapabilityBanner
├── lib/
│   ├── api/                  # §11.4
│   ├── voice/                # §11.6 (+ public/worklet/mic-processor.js)
│   ├── stores/               # identity, prefs, thread
│   ├── hooks/                # useGeneratePlan, usePlans, useItemMutations, useCapabilities
│   └── utils/                # time, osm (hours parsing, domain extraction), rtl, cn
├── messages/{en,ar}.json
└── tests/{unit,e2e}/
```

---

## 18. Build phases

Each phase is independently demoable. Nothing is "done" until its acceptance criteria pass at 375 px,
in both light and dark, in both languages.

### Phase 0 — Foundations (½ day)

Next.js + TS strict + Tailwind v4 · tokens from §8 in `globals.css` · fonts · theme switch
(system/light/dark) · `next-intl` with both catalogues and server-side `dir` · `NavShell` with bottom
nav ↔ sidebar · typed API client skeleton with `X-Request-ID` capture · Zod types from §6.3.

**Accept:** every route renders an empty shell; the theme and language toggles work with no flash;
`GET /health` renders in Settings.

### Phase 1 — Identity + chat + plans, non-streaming (2 days)

Onboarding · `useIdentity` · Composer with limits and draft autosave · Thread · `POST /api/generate-plan`
· `ResponseRouter` · `PlanCard` read-only · `AnswerCard` · `ReplyBubble` · `history` replay · error
cards for 502/504/500/offline.

**Accept:** "I have energy but no plan today" produces a checklist card; "weather in Beirut tomorrow"
produces an answer with sources; "hey" produces a short reply; a follow-up referring to the previous
turn is understood; a 502 shows a Retry card with a copyable request id.

### Phase 2 — The checklist becomes real (2 days)

`Checklist` + `ChecklistRow` with tick / rename / add / delete · the per-plan mutation queue ·
optimistic toggle · Undo on item delete · `ProgressMeter` · `PersistenceNotice` · Plans library with
filters, search and delete confirmation · Plan detail with the "You asked" block.

**Accept:** tick an item → reload → still ticked; delete an item then delete another → indices stay
correct (verified against the returned document); `persisted: false` shows the amber notice and
blocks `PATCH` attempts; deleting a plan asks first and cannot be undone.

### Phase 3 — Places and location (2 days)

`PlacesCard` · `PlaceRow` with every optional field, `phone_source` footnote and the
no-coordinates warning · `LocationAskCard` with all three paths · location chip persistence ·
capability gating on `places` · optional Leaflet map behind the flag.

**Accept:** "I'm hungry, somewhere Italian" with no known location asks for one, then returns places;
a web-sourced phone always shows its source and the outdated caveat; a place with `source` but no
`latitude` shows the warning and no map; "Not now" returns a venue-free plan.

### Phase 4 — Streaming (1 day)

`POST /api/generate-plan/stream` · SSE parser with a carry-over buffer · `StageChip` with all five
stages plus `detail` · token append · progressive place rendering · Stop · the 20 s and 45 s
reassurances · non-streaming fallback flag.

**Accept:** stage chip advances through the real stages with no layout shift; place cards appear
before the final result; Stop aborts and leaves a retryable message; with `NEXT_PUBLIC_STREAMING=off`
everything still works.

### Phase 5 — Voice (2–3 days)

`lib/voice` (session, capture worklet, playback queue) · `VoiceOrb` · transcript with tool rows ·
`plan_generated` inline card · `interrupted` flush · close-code mapping · session summary · disabled
state when `voice_enabled` is false.

**Accept:** speaking produces a transcript and audible reply; barge-in stops playback immediately;
`create_plan` shows "Building your plan…" so the silence is explained; the generated plan appears and
is saved; a second tab gets the 1013 message; ending the session releases the mic (verified by the
browser indicator turning off).

### Phase 6 — Polish and hardening (2 days)

Full a11y pass (axe + manual keyboard + screen reader) · reduced-motion pass · 200 % text zoom ·
RTL sweep of every screen · skeletons and empty states everywhere · performance budget check ·
Playwright flows for J1–J6 · Arabic copy review by a native speaker.

**Accept:** the §19 checklist passes end to end.

---

## 19. QA checklist before shipping

### Contract

- [ ] `GeneratePlanResponse` (nested `plan`) and `PlanDocument` (flat) both normalise correctly
- [ ] Every `Place` optional field renders or is cleanly absent — no "null", no empty rows
- [ ] `phone_source` always renders with the "may be outdated" caveat
- [ ] A place with `source` and no `latitude` never reaches the map
- [ ] `persisted: false` / `plan_id: null` block item mutations and show the notice
- [ ] Item indices always come from the returned document, never local state
- [ ] `user_id` is lowercased client-side before every request
- [ ] `history` is ≤ 10 turns, each `content` ≤ 2000 chars, current prompt excluded
- [ ] `X-Request-ID` captured on every response and shown on every error card
- [ ] Unknown SSE events and unknown `status` values degrade gracefully
- [ ] SSE frames split across chunk boundaries parse correctly

### Accessibility

- [ ] axe-core: zero violations on all six routes, both themes
- [ ] Full keyboard walkthrough of J1–J6 with no mouse
- [ ] Focus never hidden behind the composer or bottom nav
- [ ] Screen reader announces stage changes once, as full sentences
- [ ] All contrast pairs verified in dark mode independently
- [ ] 200 % text zoom and 400 % browser zoom: no clipping, no horizontal scroll
- [ ] `prefers-reduced-motion`: no transforms, no orb animation, no spinners
- [ ] Every icon-only control has an accessible name

### Bilingual

- [ ] Arabic RTL: every screen mirrored, no `left`/`right` leaks
- [ ] Send icon and route transitions mirror; logo, clock and map pin do not
- [ ] Phone numbers, URLs and coordinates stay LTR inside Arabic text
- [ ] Mixed-language conversation renders each bubble in its own direction
- [ ] No hardcoded strings (grep for quoted user-facing text in components)

### Responsive and performance

- [ ] 375 / 768 / 1024 / 1440 all clean; landscape phone usable
- [ ] No horizontal scroll anywhere outside an explicit scroll container
- [ ] CLS ≤ 0.05 during a full streaming generation
- [ ] First-load JS on `/` ≤ 180 KB gzipped
- [ ] Map, voice and mood sheet are not in the initial bundle

### Degradation

- [ ] Backend down → honest message, app still renders
- [ ] `mongo_ready: false` → chat works, plans surface explains itself
- [ ] `places: false` → no map UI, explained in Settings
- [ ] `rag_ready: false` → "won't remember preferences yet" notice
- [ ] `voice_enabled: false` → Voice tab disabled with a reason, not hidden
- [ ] Offline → clear state, auto-recovers on reconnect

---

## 20. Open questions for the team

1. **Handle vs. auth.** v1 ships a `localStorage` handle with a plain warning. Is that acceptable for
   the demo, or should Phase 1 include a minimal login? The backend has no auth yet and
   `normalise_user_id` is the documented swap point.
2. **Real-time answer style.** `../khalesni/CLAUDE.md` open item #5 asks whether real-time answers are
   raw Exa or LLM-rephrased with mood and memory. `<AnswerCard>` is built for **short prose plus
   sources**; a long raw Exa dump will need a `line-clamp` + "Show more". Confirm which is coming.
3. **Map: static previews or Leaflet?** Static thumbnails ship faster and cost nothing. Leaflet is
   nicer for comparing several places. The plan builds static first with Leaflet behind
   `NEXT_PUBLIC_MAP=leaflet` — confirm that is the right default.
4. **`MAP_SEARCH_ENABLED` is off by default** (public Overpass servers are overloaded), so
   `GET /api/places` usually 503s. Should `/plans`-adjacent browse-by-category UI exist at all in v1,
   or is discovery purely conversational?
5. **Voice mode in v1?** It is the most expensive phase (2–3 days) and needs `GEMINI_API_KEY` plus
   `VOICE_ENABLED=true`. Phases 0–4 are a complete product without it. Ship voice in v1 or v1.1?
6. **Arabic copy owner.** §16 is a first draft written for review. Who signs off, and is Levantine
   colloquial right, or should it be Modern Standard Arabic?
7. **Deployment origin.** `CORS_ORIGINS` currently allows only `http://localhost:3000`. The deployed
   frontend origin must be added to the backend's env before any staging demo.
