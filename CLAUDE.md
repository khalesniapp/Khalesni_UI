# Khalesni — Frontend

Next.js UI for the Khalesni AI planning assistant. The app is built out through Phase 5; **Phase 6 is
the remaining work.** Build it out phase by phase, in order.

- **Spec / source of truth:** [`UI_Plan.md`](./UI_Plan.md) — 20 sections, screen-by-screen.
- **Backend:** `../khalesni` (FastAPI, already built and running locally). Read its `README.md` for
  the API contract and `CLAUDE.md` for its rules. **Never edit the backend from this folder.**
- **Team:** Nour → backend · this repo → frontend.

> **Stack note:** this is **Next.js** (React), not NestJS. The two get confused because of the name;
> the backend is Python/FastAPI and is not being replaced. `UI_Plan.md` §17 locks the stack.

---

## Where things stand

Phases 0–5 are built and working against the live backend; **Phase 6 (polish, a11y, e2e, Arabic
review) has not been started.** Step 0 below is historical — the app is scaffolded, so do not re-run
`create-next-app`.

```bash
npm install                  # node_modules is not committed
npm run dev                  # localhost:3000
npm test                     # 111 unit tests
npm run typecheck && npm run lint && npm run build
```

Backend, in a second terminal (from `../khalesni`, no `--reload`):

```bash
myvenv\Scripts\activate
python -m uvicorn app.main:app
pytest -q                    # 135 tests
```

Jump to [Progress](#progress) for what is left, and to the Phase notes for the traps that cost real
time. Some fixes were made in `../khalesni` with the owner's explicit permission — see
[Backend changes made from here](#backend-changes-made-from-here-nour-should-review).

---

## Start here (first session, in order)

1. Read `UI_Plan.md` §5 (interaction model), §6 (API contract), §8 (design tokens), §17 (stack),
   §18 (phases). Skim the rest; return to a screen's section when you build that screen.
2. Run **Step 0** below to scaffold.
3. Work **Phase 0 → 6** in order (§18). One phase per session is a good size.
4. Update the [Progress](#progress) table in this file when a phase's acceptance criteria pass.

Do not skip ahead to a later phase because it looks easy. Phase N assumes N−1 exists.

---

## Step 0 — Scaffold (run once)

`UI_Plan.md` and `CLAUDE.md` do not collide with `create-next-app`, so scaffolding in place is fine.

```bash
# Node 22.11 / npm 10.9 confirmed on this machine
npx create-next-app@latest . --typescript --tailwind --app --eslint --no-src-dir --import-alias "@/*" --use-npm

npx shadcn@latest init            # style: default, base color: slate, CSS variables: yes
npm i @tanstack/react-query zustand next-intl zod @phosphor-icons/react framer-motion
npm i -D vitest @testing-library/react @testing-library/jest-dom jsdom @axe-core/playwright @playwright/test
```

Then, before writing any feature code:

- **Check which Tailwind major got installed** (`npm ls tailwindcss`). v4 is CSS-first
  (`@import "tailwindcss"` + `@theme` in `globals.css`, no `tailwind.config.js`); v3 needs the config
  file. Follow the version you actually have — do not mix the two setups.
- Put the §8 tokens into `app/globals.css` exactly as written (colours, type, spacing, radius,
  shadow, motion, z-index). They are already contrast-checked; see the two deliberate adjustments in
  §8.2 and keep them.
- Create the folder skeleton from §17 so later phases have somewhere to land.
- Add `.env.local` from the table below.
- `git init` — this folder is not a repo yet.

---

## Stack (locked — do not substitute)

| Concern | Choice |
|---|---|
| Framework | Next.js 15, App Router, TypeScript **strict** |
| Styling | Tailwind + the §8 tokens as CSS variables |
| Components | shadcn/ui (Radix) — we own the code in `components/ui/` |
| Icons | Phosphor (`@phosphor-icons/react`), regular weight, **individual imports only** |
| Server state | TanStack Query v5 |
| Client state | Zustand (`localStorage` for identity/prefs, `sessionStorage` for the thread) |
| i18n | next-intl, cookie-based locale, server-side `lang`/`dir` |
| Animation | Framer Motion (layout/presence) + CSS transitions |
| Validation | Zod at the API boundary |
| Map (optional, Phase 3) | Leaflet + OSM tiles, lazy, behind `NEXT_PUBLIC_MAP=leaflet` |

No charting library. No component library other than shadcn/ui. No emoji as icons, anywhere.

---

## Environment

```bash
# .env.local
NEXT_PUBLIC_API_BASE=http://localhost:8000
NEXT_PUBLIC_STREAMING=on          # off = fall back to POST /api/generate-plan
NEXT_PUBLIC_MAP=static            # static | leaflet
```

**The frontend must run on port 3000.** The backend's `CORS_ORIGINS` defaults to
`["http://localhost:3000"]`; any other port fails CORS silently-looking (browser console only).

---

## Commands

```bash
npm run dev                  # localhost:3000
npm run build && npm start   # verify the production bundle before calling a phase done
npm run lint
npx tsc --noEmit             # strict mode must stay clean
npx vitest                   # unit
npx playwright test          # e2e (Phase 6)
```

Backend, in a second terminal (from `../khalesni`):

```bash
myvenv\Scripts\activate
python -m uvicorn app.main:app     # NO --reload — the MCP subprocess needs it off
```

Check `GET http://localhost:8000/health` before debugging a frontend symptom. Half of "the UI is
broken" is a backend capability that is off.

---

## Backend contract cheat-sheet

Full detail in `UI_Plan.md` §6 and `../khalesni/README.md`. The essentials:

| Method | Path | Returns |
|---|---|---|
| POST | `/api/generate-plan` | `GeneratePlanResponse` |
| POST | `/api/generate-plan/stream` | SSE: `status` · `token` · `places` · `result` · `error` |
| GET | `/api/plans/{user_id}?limit=20` | `PlanDocument[]`, newest first |
| GET / DELETE | `/api/plans/{user_id}/{plan_id}` | `PlanDocument` / `204` |
| PATCH / POST | `/api/plans/{plan_id}/items` | updated `PlanDocument` |
| DELETE | `/api/plans/{plan_id}/items/{item_type}/{index}?user_id=` | updated `PlanDocument` |
| GET | `/api/places?near=&category=` | `Place[]` (usually `503` — see trap 6) |
| GET | `/health` | capability flags |
| WS | `/api/voice/ws?user_id=` | voice session |

Four response shapes, routed in **one** place (`components/chat/ResponseRouter.tsx`):
`type: "plan"` → PlanCard · `"realtime"` → AnswerCard · `"chat"` + `needs:"location"` →
LocationAskCard · `"chat"` + `places[]` → PlacesCard · else ReplyBubble.

### The six traps (these cause real bugs — read before Phase 1)

1. **Two different plan shapes.** `GeneratePlanResponse` nests the checklist under `.plan`;
   `PlanDocument` (saved plans) is **flat**. Normalise both into one internal type in
   `lib/api/normalise.ts`. No component may know which one it came from.
2. **Item indices shift.** All three item endpoints return the full updated `PlanDocument`. Always
   replace local state from the response — **never splice locally**. Serialise mutations per
   `plan_id` through a queue, one in flight at a time, or concurrent PATCHes corrupt the plan.
3. **`persisted: false` / `plan_id: null`** means Mongo failed but the plan is still valid. Show the
   amber notice from §7.3, keep ticks local, and **do not attempt `PATCH`** (there is no id).
4. **Place honesty is contractual.** If `phone_source` is set you must show "Phone found on
   {domain} — may be outdated" with the link. A place with `source` but `latitude: null` is **not on
   the map** — show the warning row, no map, no distance.
5. **The API is stateless.** The frontend owns the transcript and must send `history` (last 10 turns,
   `{role, content}`, oldest first, current prompt excluded). Skip it and "the first one" / "what
   about sushi?" / "what's their number?" all break.
6. **Capabilities are off by default.** `MAP_SEARCH_ENABLED` is off (public Overpass is overloaded)
   so `GET /api/places` usually `503`s; `VOICE_ENABLED` is off without a Gemini key. Gate every
   dependent surface on `GET /health`, never on a failed click.

`user_id` is `^[a-z0-9_\-]{1,128}$`, trimmed and lowercased server-side — lowercase it client-side
too, so "Nour" and "nour" are visibly the same person.

---

## Conventions (non-negotiable)

- **No `fetch` outside `lib/api/`.** One typed client; it captures `X-Request-ID` on every response
  (ring buffer of 10) and throws `ApiError { status, detail, requestId }`. Branch on `status`, never
  on message text.
- **No automatic retry on the generate endpoints.** They cost time and money; retry is a user action.
  `GET`s may retry twice with backoff. Timeouts: generate 90 s, everything else 15 s.
- **Zod-parse every response** at the boundary. Contract drift must fail loudly in dev, not render
  `undefined` in the UI.
- **RTL from day one.** Logical properties only — `ps-`/`pe-`/`ms-`/`me-`/`text-start`, never
  `pl-`/`pr-`/`text-left`, and no `left`/`right` in CSS. Arabic is a first-class locale, not a
  late translation pass.
- **Every user-facing string lives in `messages/{en,ar}.json`.** Zero hardcoded copy in components.
  §16 has ~90 keys already drafted in both languages.
- **Accessibility is part of "done", not Phase 6.** Real `<input type="checkbox">` with labels,
  44 px targets, visible focus rings, `aria-label` on icon-only buttons, `aria-hidden` on decorative
  icons, `prefers-reduced-motion` respected.
- **Animate `transform` and `opacity` only.** Fixed-height stage chip; skeletons sized to real
  content. CLS budget is 0.05 during a full streaming generation.
- **Server Components by default**; `"use client"` only where there is state (composer, checklist,
  voice, map).
- Import Phosphor icons individually (`import { MapPin } from "@phosphor-icons/react/dist/ssr/MapPin"`),
  never the barrel — it wrecks the bundle.
- Never put `user_id` in a shareable URL.

---

## Progress

Update this table as phases land. A phase is done only when its §18 acceptance criteria pass
**at 375 px, in light and dark, in English and Arabic**, with `tsc --noEmit` and `npm run build`
clean.

| Phase | Scope (§18) | Est. | Status |
|---|---|---|---|
| 0 | Foundations: scaffold, tokens, fonts, theme, i18n + `dir`, NavShell, API client skeleton, Zod types | ½ d | ☑ done — see [Phase 0 notes](#phase-0-notes) |
| 1 | Identity + chat + plans, non-streaming: onboarding, Composer, Thread, ResponseRouter, PlanCard (read-only), AnswerCard, history replay, error cards | 2 d | ☑ done — verified against the live backend |
| 2 | Checklist becomes real: tick/rename/add/delete, mutation queue, optimistic toggle, Undo, ProgressMeter, PersistenceNotice, Plans library, Plan detail | 2 d | ☑ done — tick verified persisting through a reload |
| 3 | Places + location: PlacesCard, PlaceRow (all optional fields, `phone_source`, no-coords warning), LocationAskCard, capability gating, optional Leaflet | 2 d | ☑ done — see [Phase 3 notes](#phase-3-notes) |
| 4 | Streaming: SSE parser with carry-over buffer, StageChip (5 stages + `detail`), token append, progressive places, Stop, 20 s/45 s reassurance, fallback flag | 1 d | ☑ done — parser unit-tested for split frames |
| 5 | Voice: session/capture/playback, VoiceOrb, transcript + tool rows, `plan_generated`, `interrupted` flush, close codes, summary, disabled state | 2–3 d | ☑ done — spoken turns verified live; three gaps listed in [Phase 5 notes](#phase-5-notes) |
| 6 | Polish: a11y pass (axe + keyboard + SR), reduced motion, 200 % zoom, RTL sweep, skeletons, perf budget, Playwright J1–J6, Arabic copy review | 2 d | ☐ not started |

**Phases 0–5 are built and exercised against the live backend.** Real spoken conversations have run
end to end: mic → 16 kHz PCM → Gemini → 24 kHz playback, transcripts, a tool call, a plan saved and
opened from the library. Three parts of Phase 5 have still never been triggered — they are listed in
the Phase 5 notes.

**Phase 6 has not been started.** That is the remaining work, and none of it is optional before a
release:

- axe pass, manual keyboard pass, screen-reader pass
- `prefers-reduced-motion` and 200 % text zoom
- an RTL sweep of every screen (the shell and Settings were checked in Arabic; the chat, plans, places
  and voice screens were not)
- skeletons and empty states audited on every surface
- the §15 performance budget measured rather than assumed (CLS 0.05 during a streaming generation)
- Playwright flows J1–J6 — `tests/e2e/` does not exist yet and `npx playwright install` has never run
- **Arabic copy review by a native speaker.** §16 is a first draft and everything added since (roughly
  60 further keys, all of Phase 5's voice copy) is my own drafting. I cannot judge it; treat the whole
  catalogue as unreviewed.

### Phase 0 notes

Four things differ from the instructions above. Each was forced by what is actually installable
today, not a preference:

1. **Next 16.3.5, not 15.** `create-next-app@latest` installs 16; the spec was written when 15 was
   current. Same framework and App Router, so §17 still holds. Consequences already handled:
   `cookies()`/`params` are async-only, `next lint` and the `eslint` key in `next.config.ts` are
   gone (lint is its own script), and `middleware` is renamed `proxy` — which we avoid entirely by
   keeping the locale in a cookie. Next ships its own agent rules in `AGENTS.md`; read
   `node_modules/next/dist/docs/` before using an API that looks different from Next 15.
2. **Fonts are self-hosted**, in `app/fonts/` via `next/font/local`, not `next/font/google`. The
   Google fetch runs at build time and timed out repeatedly here, which broke both `next dev` and
   `next build` for reasons unrelated to the code. `scripts/fetch-fonts.py` regenerates the files.
   Open Sans and both Noto families are variable fonts (one file each); Poppins is three statics.
3. **The repo already existed** (cloned from GitHub), so `git init` in Step 0 was skipped.
4. **`@types/node` is on ^22, not ^20** — vitest 5 requires it, and this machine runs Node 22.
5. **Tests run through `scripts/run-vitest.mjs`, not `vitest` directly.** jsdom 29 `require()`s an
   ESM-only package, which Node only allows unflagged from 22.12; this machine is on 22.11, so every
   test file failed to start with `ERR_REQUIRE_ESM`. The launcher sets
   `NODE_OPTIONS=--experimental-require-module` (it has to reach the pool workers, so `execArgv` in the
   vitest config is not enough). Delete it once the Node floor is 22.12+.
6. **`npm ci` can miss the rolldown native binding** (the long-standing npm optional-dependency bug).
   Symptom: `vitest` exits with "Cannot find native binding". Fix:
   `npm i --no-save @rolldown/binding-win32-x64-msvc@<rolldown version>`.

Spacing tokens: Tailwind's built-in steps 1–4 match §8.4 exactly, but 5–8 diverge (Tailwind 5 = 20px,
§8.4 wants 24px). The spec scale is kept as `--space-1..8` and used as `gap-(--space-5)`; plain
`gap-5` is Tailwind's scale and means something else. Prefer the explicit token form.

Verified at 375 px in light and dark, English and Arabic: all six routes render, the theme and
language toggles change `data-theme`/`lang`/`dir` with the value already correct in the first
server-rendered byte, `/health` drives the Settings capability list, and the Voice tab renders
disabled-with-a-reason when `voice_enabled` is false. `npm test` (30), `npm run typecheck`,
`npm run lint` and `npm run build` are all clean.

The real backend was not running for this (no `myvenv` in `../khalesni` on this machine), so the
capability list was checked against a stub serving the documented §6.5 shape. ~~Re-check Settings
against the live backend before starting Phase 1.~~ **Done:** checked against the live backend, which
reports `mongo_ready: true`, `places: true`, `voice_enabled: true` and `rag_ready: false` (the Pinecone
project is at its serverless-index quota). The degraded Memory row renders with its consequence line,
so the amber path is exercised by a real failure rather than a stub.

---

### Phase 3 notes

`places` is **on** for this backend (`/health` reports `places: true`), so trap 6 does not bite here —
`GET /api/places` works and venue results come back real. Do not take that as permanent: the trap is
about the default, and a different deployment will still 503. Every places surface stays gated on the
capability.

The static map thumbnail (`NEXT_PUBLIC_MAP=static`, the default) is one real OpenStreetMap raster
tile per place, computed in `lib/utils/osm.ts`. OSM's tile policy allows incidental use like this but
forbids bulk fetching — if place results ever get heavy, switch to `leaflet` or a self-hosted tile
server. Leaflet is installed and behind the flag; it is lazily imported so it costs nothing by default.

`openState()` refuses to guess. Only `24/7` and plain `<days> <from>-<to>` rules resolve to Open/Closed;
anything with `PH`, `off`, a month range or a sunset offset returns `unknown` and the raw OSM string is
shown alone. A wrong "Open now" sends someone across town for nothing.

### Phase 5 notes

Built in full against the documented protocol (`{type, data}` frames, confirmed against
`app/voice/bridge.py` and `dev/voice_client.py`, not guessed). `VOICE_ENABLED=true` on this backend,
so the capability gating is exercised and the Voice tab is live.

**Verified live.** Multi-turn spoken conversations have run end to end: the worklet's 16 kHz capture,
the 24 kHz playback cursor, streamed transcripts, `tool_started`, and a `plan_generated` that saved
plan `6aac7369b8a2e3a1e6a6e8c4` and opened from `/plans/{id}`. Eight sessions are in `voice_sessions`.

**Still never triggered**, so treat as unproven:

- `interrupted` / barge-in — `playback.flush()` has never actually run against real audio. It is the
  one piece where a delay is immediately obvious, so test it deliberately: talk over the reply.
- **Close codes 1013 and 1008.** Open voice in a second tab to force 1013; both mappings are
  unit-tested (`tests/unit/voice.test.ts`) but neither has been seen.
- The session-end summary screen, and Mute.

The event parser and close-code mapping are unit-tested; `tests/unit/VoiceScreen.test.tsx` drives the
real screen with a mocked session.

**Transcription arrives fragment by fragment.** Gemini Live streams it, and the backend forwards each
`input_transcription`/`output_transcription` piece as its own `transcript` event (the variable in
`app/voice/bridge.py` is named `piece`). One row per event renders a column of single words instead of a
sentence. `lib/voice/transcript.ts` keeps one open paragraph per speaker and appends into it. A paragraph is
broken by a **speaker change** or an inserted row (tool notice, plan card) — deliberately **not** by
`turn_complete`. Gemini's output transcription lags the audio it describes, so the tail of a reply
keeps arriving after the turn is reported complete; breaking there put every trailing fragment on its
own line, which is why the assistant rendered word-by-word while the user looked fine (the user's
transcription arrives as one block before its turn boundary). This matches `_add_transcript` in
`app/voice/bridge.py`, which coalesces the persisted transcript on role alone. Fragments are joined with **no separator**; they carry their own
leading spaces. Covered by `tests/unit/transcript.test.ts`.

Bugs found and fixed while getting this working, all worth knowing about:

1. **Permission and Connecting are separate phases**, as §7.7's lifecycle table says. Collapsing them
   meant an unanswered mic prompt showed "Connecting…" forever, since the 10 s timeout only starts once
   the socket exists. The screen now says "Waiting for microphone access…" until the prompt is answered.
2. **An abandoned session leaked the microphone.** `getUserMedia` resolves whenever the prompt is
   answered, which can be long after the screen is gone; the session then landed in a ref nobody read
   and nothing ever closed it. `abandonedRef` now ends such a session the moment it resolves.

Audio is not sent before `ready` — the backend's own reference client gates on that, and earlier chunks
are discarded, which would silently eat the start of the first sentence.

#### Backend changes made from here (Nour should review)

The "never edit the backend from this folder" rule was **explicitly waived by the repo owner** for these,
after a live session where Gemini apologised for a failed tool and then told the user their checklist was
on screen when nothing had been built. Three files in `../khalesni`:

- `app/voice/tools.py` — `_get_my_preferences` now degrades to `"No saved preferences."` when
  `rag.rag_ready()` is false or the lookup throws, instead of raising. RAG is optional and the text graph
  already treats it as non-fatal; this tool was the one place that hard-failed, and one tool error was
  enough to make the model abandon `create_plan` entirely.
- `app/prompts/voice_prompt.py` — the model may only say the checklist is on screen after `create_plan`
  has actually returned, must ignore a `get_my_preferences` failure rather than apologising for it, and
  apologises only when `create_plan` itself fails.
- `tests/test_voice_bridge.py` — three regression tests. The two degrade cases were confirmed to fail
  against the pre-fix code and pass after; the third guards the working path.

Then, to stop the model going silent during a long `create_plan` (the CEO-Agent behaviour — it speaks a
short "one moment, let me check" and keeps the user company while the tool runs):

- `app/voice/tools.py` — `create_plan` is declared `"behavior": "NON_BLOCKING"`. It drives the whole
  graph and routinely takes 10–30 s; blocking meant Gemini went quiet for the duration, which sounds
  like a dropped call. Left off `get_my_preferences` on purpose — a single vector query returns fast
  and filler before it just sounds hesitant.
- `app/voice/bridge.py` — the tool response now carries
  `scheduling=FunctionResponseScheduling.INTERRUPT`, so the answer is spoken the moment it lands
  rather than waiting for an idle gap. This is the necessary pair to NON_BLOCKING; the tool handler
  already ran concurrently (`asyncio.create_task`), so that part needed no change.
- `app/prompts/voice_prompt.py` — tool calls are silent actions, never spoken by name; a short varied
  acknowledgement goes out immediately before the call; the model keeps talking while it waits; and it
  may never state a place, number or time it did not receive from a tool.

Then, after a live weather session in which the model narrated looking up a forecast for three minutes
without ever calling a tool (confirmed: zero graph invocations in the log for that session):

- `app/voice/tools.py` — `create_plan`'s description now advertises that it also answers real-world
  questions (weather, opening hours, prices, news), not just "build and save a checklist". The model
  selects on the description, and a checklist-builder reads as the wrong tool for "what's the weather
  tomorrow?" — so it answered from nowhere. The graph already routes weather/time/news to Exa and the
  handler already returns `{"answer": ...}` for a realtime response; only the advertisement was missing.
- `app/prompts/voice_prompt.py` — **regression I introduced**: "keep the user company while it runs:
  if it has not come back yet, say you are still working on it" taught the model to *perform* working.
  Now: "Saying you are checking is NOT checking" — it may only claim to be looking something up after
  an actual call in that turn, and progress narration is allowed only while a real call is in flight.

Backend suite after all of it: **135 passed**.

Worth knowing for the next session: `tests/unit/VoiceScreen.test.tsx` mounts the real screen with a
mocked session and feeds it transcript fragments. The pure reducer passing while the screen still
rendered one word per row is what let the fragmentation bug survive two fixes — test the component,
not just the reducer.

**Still outstanding and not ours:** Pinecone is at its serverless-index quota (403 at startup), so
`rag_ready` stays `false` and the Memory capability stays Unavailable. Free an index, use a namespace, or
repoint `PINECONE_INDEX`.

**Also worth a look:** `_get_my_preferences` never emits `tool_started`, so §7.7's "Checking what you
like…" row can never appear, and a failed tool emits no `error` event to the browser at all — the user
only hears about it. The frontend renders both rows already; the backend does not send them.

## Verifying against the live backend

Smoke prompts, once the backend is running (`user_id: demo-user`):

| Prompt | Expected | Exercises |
|---|---|---|
| "i have energy but no plan today" | `type: plan`, `plan_type: daily_schedule` → PlanCard | Phase 1 |
| "i need to prepare for a trip to Paris" | `type: plan`, `plan_type: trip`, `outing_readiness` populated | Phase 1–2 |
| "what's the weather in Beirut tomorrow?" | `type: realtime` + sources | Phase 1 |
| "hey" | `type: chat`, short reply | Phase 1 |
| "i'm hungry, somewhere italian" (no location set) | `type: chat`, `chat.needs: "location"` | Phase 3 |
| …then "hamra" | `chat.places[]` with real OSM places, `location: "Hamra, Beirut"` | Phase 3 |
| "what's their phone number?" (with `history`) | follow-up resolves to the right place | Trap 5 |

If plans don't save, check `mongo_ready` in `/health`. If no places come back, check `places` in
`/health` — that is trap 6, not a UI bug.

---

## Open decisions (from `UI_Plan.md` §20)

Ask rather than guess; these change scope. Five were settled in the course of building — the reasoning
is recorded so they can be reopened deliberately rather than by accident.

**Settled**

1. ~~Handle in `localStorage` vs. real auth~~ → **handle**, exactly as §11.1 describes. Every read goes
   through `useIdentity()`, so a JWT swap stays one file.
2. ~~Raw Exa or LLM-rephrased real-time answers~~ → **handled either way.** `AnswerCard` clamps the
   answer at 10 lines with Show more, which costs nothing when the prose is short and saves the card
   when it is a dump. No decision needed.
3. ~~Static thumbnails vs. Leaflet~~ → **static by default** (one OSM tile per place, no library),
   Leaflet installed and lazily imported behind `NEXT_PUBLIC_MAP=leaflet`.
5. ~~Voice in v1 or v1.1~~ → **v1.** `VOICE_ENABLED=true` on this backend and spoken turns work.

**Still open**

4. Any browse-by-category places UI. Not built. Note that `places` is *on* for this backend, so trap 6
   does not currently bite — but the trap is about the default, and another deployment will still 503.
6. **Arabic copy owner and register** (Levantine colloquial vs. MSA). Now the single largest unreviewed
   surface: §16's first draft plus ~60 keys I added across Phases 1–5. Needs a native speaker.
7. Deployed frontend origin must be added to the backend's `CORS_ORIGINS` before any staging demo.
8. **Pinecone is at its serverless-index quota** (403 at startup), so `rag_ready` is `false` and
   Khalesni cannot remember preferences. Free an index, use a namespace, or repoint `PINECONE_INDEX`.
   Not a UI decision, but it is the one thing degrading the live product right now.
