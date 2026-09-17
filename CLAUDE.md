# Khalesni — Frontend

Next.js UI for the Khalesni AI planning assistant. **This folder is empty except for the spec.**
Your job is to scaffold the app and build it out phase by phase.

- **Spec / source of truth:** [`UI_Plan.md`](./UI_Plan.md) — 20 sections, screen-by-screen.
- **Backend:** `../khalesni` (FastAPI, already built and running locally). Read its `README.md` for
  the API contract and `CLAUDE.md` for its rules. **Never edit the backend from this folder.**
- **Team:** Nour → backend · this repo → frontend.

> **Stack note:** this is **Next.js** (React), not NestJS. The two get confused because of the name;
> the backend is Python/FastAPI and is not being replaced. `UI_Plan.md` §17 locks the stack.

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
| 1 | Identity + chat + plans, non-streaming: onboarding, Composer, Thread, ResponseRouter, PlanCard (read-only), AnswerCard, history replay, error cards | 2 d | ☐ not started |
| 2 | Checklist becomes real: tick/rename/add/delete, mutation queue, optimistic toggle, Undo, ProgressMeter, PersistenceNotice, Plans library, Plan detail | 2 d | ☐ not started |
| 3 | Places + location: PlacesCard, PlaceRow (all optional fields, `phone_source`, no-coords warning), LocationAskCard, capability gating, optional Leaflet | 2 d | ☐ not started |
| 4 | Streaming: SSE parser with carry-over buffer, StageChip (5 stages + `detail`), token append, progressive places, Stop, 20 s/45 s reassurance, fallback flag | 1 d | ☐ not started |
| 5 | Voice: session/capture/playback, VoiceOrb, transcript + tool rows, `plan_generated`, `interrupted` flush, close codes, summary, disabled state | 2–3 d | ☐ not started |
| 6 | Polish: a11y pass (axe + keyboard + SR), reduced motion, 200 % zoom, RTL sweep, skeletons, perf budget, Playwright J1–J6, Arabic copy review | 2 d | ☐ not started |

Phases 0–4 are a complete, shippable product. Voice (5) is the most expensive phase and needs
`GEMINI_API_KEY` + `VOICE_ENABLED=true` on the backend — confirm with Nour whether it is in v1 before
starting it.

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

Spacing tokens: Tailwind's built-in steps 1–4 match §8.4 exactly, but 5–8 diverge (Tailwind 5 = 20px,
§8.4 wants 24px). The spec scale is kept as `--space-1..8` and used as `gap-(--space-5)`; plain
`gap-5` is Tailwind's scale and means something else. Prefer the explicit token form.

Verified at 375 px in light and dark, English and Arabic: all six routes render, the theme and
language toggles change `data-theme`/`lang`/`dir` with the value already correct in the first
server-rendered byte, `/health` drives the Settings capability list, and the Voice tab renders
disabled-with-a-reason when `voice_enabled` is false. `npm test` (30), `npm run typecheck`,
`npm run lint` and `npm run build` are all clean.

The real backend was not running for this (no `myvenv` in `../khalesni` on this machine), so the
capability list was checked against a stub serving the documented §6.5 shape. **Re-check Settings
against the live backend before starting Phase 1.**

---

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

Ask rather than guess; these change scope:

1. Handle-in-`localStorage` vs. real auth for v1 (backend has no auth; `normalise_user_id` is the
   documented swap point).
2. Real-time answers: raw Exa or LLM-rephrased? `AnswerCard` is built for short prose + sources; a
   long raw dump needs `line-clamp` + "Show more".
3. Static map thumbnails (default) vs. Leaflet.
4. Any browse-by-category places UI at all, given trap 6.
5. Voice in v1 or v1.1?
6. Arabic copy owner and register (§16 is a reviewable first draft — Levantine colloquial vs. MSA).
7. Deployed frontend origin must be added to the backend's `CORS_ORIGINS` before any staging demo.
