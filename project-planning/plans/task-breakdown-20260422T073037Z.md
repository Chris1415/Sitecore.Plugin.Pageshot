# Development Execution Plan

---
document_type: task_breakdown
artifact_name: task-breakdown-20260422T073037Z.md
generated_at: 2026-04-22T07:30:37Z
run_manifest: project-planning/workflow/run-20260422T073037Z.json
source_inputs:
  - project-planning/PRD/prd-000.md
  - project-planning/PRD/prd-minimal-000.md
  - project-planning/ADR/adr-0001-use-adrs-as-architecture-backbone.md
  - project-planning/ADR/adr-0002-client-iframe-with-server-proxy.md
  - project-planning/ADR/adr-0003-no-local-https-vercel-previews-as-integration-surface.md
  - project-planning/ADR/adr-0004-nextjs-app-router-node-runtime.md
  - project-planning/ADR/adr-0005-custom-app-single-tenant.md
  - project-planning/ADR/adr-0006-stateless-no-persistence.md
  - project-planning/ui-design/ui-design-20260422T073037Z-v2.md
  - pocs/poc-v2/index.html
consumed_by:
  - QA Specialist (07) enriches this file; Developer (08) implements from this file + prd-minimal only
next_input:
  - project-planning/plans/qa-report.md (optional on minimal track)
---

## 1. Implementation Overview

PageShot is a single-extension Sitecore Marketplace custom app (**Page Builder Context Panel**) that lets a content editor capture a chrome-free screenshot of the page they are editing and copy it to clipboard or download as PNG. The app is deliberately minimal end-to-end: one panel UI, one Next.js route handler proxying the SitecoreAI Agent API `/screenshot` call with OAuth client credentials held server-side, no persistence.

This build is also a **dogfood** of the agentic framework: it exercises the full chain scaffold → Marketplace SDK client → `pages.context` subscription → Agent API OAuth → real-portal custom-app registration in one pass, and logs friction into `.agent/skills/sitecore/marketplace-sdk/CATALOG.md`.

**Planning track:** minimal (PRD + ADRs, no architecture document). This task breakdown + `prd-minimal-000.md` is the sole context Developer (08) will load.

**Visual source of truth:** the Shutterbug direction (v2) — warm cream palette + amber hero shutter + polaroid preview card. The winning POC clickdummy at `products/pageshot/pocs/poc-v2/index.html` overrides the spec on visual tie-breaks per § 7 of the design spec.

**Architecture shape:** client-side iframe UI in a Next.js App Router app + **one** Node-runtime route handler (`/api/screenshot/[pageId]`) that holds `SITECORE_CLIENT_ID` / `SITECORE_CLIENT_SECRET`. No database, no persisted captures, no local HTTPS.

---

## 2. Epics

| Epic | Title | Summary |
|------|-------|---------|
| **E1** | Scaffold & project skeleton | Marketplace Client-Side scaffold, Tailwind + tokens, env-var placeholders, Chrome PNA headers, test/typecheck/lint stack. |
| **E2** | Marketplace SDK integration | `ClientSDK.init` Provider, `pages.context` subscription, Page Context Panel route. |
| **E3** | Server-side OAuth proxy | `/api/screenshot/[pageId]` route handler, token cache (24 h + 60 s margin), Agent API call, error envelope + 401 retry. |
| **E4** | Panel UI — Shutterbug direction | Hero shutter, polaroid preview, action pills, states / transitions / copy / a11y / keyboard map — visual parity with POC v2. |
| **E5** | Cloud Portal custom-app registration | Test custom app + production custom app in Cloud Portal; env-var wiring in Vercel; preview URL rotation doc. |
| **E6** | Dogfood verification & catalog logging | End-to-end smoke test on Vercel preview; append run to Marketplace CATALOG. |

---

## 3. Feature Breakdown

| # | Feature | Epic(s) | User stories | Key FRs/NFRs |
|---|---------|---------|-------------|--------------|
| F1 | Project scaffold & toolchain | E1 | — | NFR-Br-01, NFR-Co-01 |
| F2 | Panel mounts in iframe with live page context | E2, E4 | US-1, US-4 | FR-01, FR-02, FR-12 |
| F3 | Capture → image round-trip | E2, E3 | US-1 | FR-03, FR-05, FR-06, FR-07, FR-13, NFR-P-01, NFR-S-01, NFR-S-02 |
| F4 | Copy image to clipboard | E4 | US-2 | FR-08, NFR-Br-01 |
| F5 | Download image as PNG | E4 | US-3 | FR-09 |
| F6 | Loading + elapsed-time feedback | E4 | US-1, US-5 | FR-10, NFR-P-02 |
| F7 | Error handling and recovery | E3, E4 | US-4, US-5 | FR-07, FR-13 |
| F8 | Accessibility + keyboard map | E4 | US-1–US-5 | NFR-A-01 |
| F9 | Deployment & custom-app registration | E5 | — | NFR-Co-01, NFR-O-01 |
| F10 | Dogfood run + catalog entry | E6 | — | D1, D2, D3 |

---

## 4. Task Breakdown

### Epic E1 — Scaffold & project skeleton

#### T001 — Run the Marketplace Client-Side scaffold
- **Title:** Run `shadcn@latest` Marketplace Client-Side quickstart into `products/pageshot/site`.
- **Description:** From the repo root run the non-interactive scaffold in `scaffold.md § Scaffold 2`. Target the absolute path `C:\Projects\agentic\agentic.hahn-solo\products\pageshot\site`. The scaffold creates a `next-app/` subdirectory under `site/`; treat `products/pageshot/site/next-app/` as the Next.js app root from here on. Do NOT substitute with a Content SDK scaffold, solo-website clone, or `npm init`.
  Exact command (run from the repo root in bash-style shell):
  ```bash
  yes '' | npx --yes shadcn@latest add \
    https://blok.sitecore.com/r/marketplace/next/quickstart-with-client-side-xmc.json \
    --yes --cwd C:/Projects/agentic/agentic.hahn-solo/products/pageshot/site
  ```
- **Expected Output:** `products/pageshot/site/next-app/` populated with Next.js 16 app, `@sitecore-marketplace-sdk/client` + `@sitecore-marketplace-sdk/xmc` in `package.json`, `components/providers/marketplace.tsx`, shadcn/ui + Radix + Nova preset, lockfile present.
- **Depends on:** none

#### T002 — Fix scaffold lint + Badge API nits and wire test stack
- **Title:** Patch scaffold lint errors, Badge API drift, install Vitest/jest-dom, add typecheck/lint/test scripts.
- **Description:** Apply all the "post-scaffold" fixes documented in `scaffold.md § Scaffold 2`:
  1. In `components/providers/marketplace.tsx`: rename `extention` → `extension` and escape `your app's` → `your app&apos;s`.
  2. If any copied shadcn code uses `<Badge variant="destructive">` etc., replace with `colorScheme="danger" | "success" | "neutral"` (Nova preset Badge API).
  3. Install dev deps: `vitest @testing-library/react @testing-library/jest-dom jsdom @vitejs/plugin-react`.
  4. Create `vitest.config.ts` and `vitest.setup.ts` per § 4c-3 block below.
  5. Add `"types": ["vitest/globals", "@testing-library/jest-dom"]` to `tsconfig.json`.
  6. Add npm scripts `test`, `test:watch`, `typecheck`, `lint`, `build`, `dev`.
- **Expected Output:** `npm run typecheck`, `npm run lint`, `npm run build`, and `npm run test` all exit 0 on the patched skeleton.
- **Depends on:** T001

#### T003 — Add Chrome Local Network Access (PNA) headers
- **Title:** Add PNA headers to `next.config.mjs` so HTTP-localhost works from the portal.
- **Description:** Add the four headers described in `scaffold.md § 3a-quater` / `testing-debug.md § 3a-quater`:
  - `Access-Control-Allow-Private-Network: true`
  - `Access-Control-Allow-Origin: *`
  - `Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS`
  - `Access-Control-Allow-Headers: Content-Type, Authorization, Access-Control-Request-Private-Network`
  Do NOT also set `Access-Control-Allow-Credentials: true` — the combo with `*` origin is spec-forbidden.
- **Expected Output:** `next.config.mjs` contains the four PNA headers. `npm run dev` serves them on every path.
- **Depends on:** T002

#### T004 — Configure Tailwind tokens (Shutterbug palette, shadows, keyframes)
- **Title:** Extend `tailwind.config.ts` with the Shutterbug design tokens.
- **Description:** The scaffold ships Tailwind already; only the token extensions from the UI spec / POC need to land:
  - Use Tailwind default `amber`, `stone`, `rose` palettes unchanged (no custom palette entries).
  - Add box-shadows `shutter` and `polaroid` with the exact RGB values from the POC CSS vars (see § 4c-4).
  - Add keyframes `shake` (translateX 0 / -4 / 0) and `bloom` (opacity 0 / 0.9 / 0), plus `animation: shutter-bloom: bloom 200ms ease-out`.
  - Add a module-scope CSS var for `--panel-bg: #fffbeb` (amber-50) and configure panel container breakpoints via Tailwind `@container` queries at `320px`, `360px`, `400px`.
- **Expected Output:** `tailwind.config.ts` compiles; a throwaway test component using `shadow-shutter` and `animate-shutter-bloom` renders without class-not-found warnings.
- **Depends on:** T002

#### T005 — Add font loading (Geist Sans + Geist Mono)
- **Title:** Load Geist Sans and Geist Mono via the `geist` npm package.
- **Description:** The UI spec specifies Geist Sans (UI) + Geist Mono (elapsed counter + ledge + filename). The POC uses Inter + JetBrains Mono as a convenience for static HTML, but the spec (authoritative on fonts) calls for Geist. Install `geist`, wire in `app/layout.tsx` per the package's Next.js App Router instructions, expose CSS variables `--font-sans` and `--font-mono` consumed by Tailwind's `fontFamily`.
- **Expected Output:** Panel components render with Geist Sans (body) and Geist Mono (mono spans — ledge, elapsed counter). No font FOUT in dev.
- **Depends on:** T002

#### T006 — Add env-var placeholders and `.env.local` stub
- **Title:** Create `.env.local` with `SITECORE_CLIENT_ID` / `SITECORE_CLIENT_SECRET` placeholders.
- **Description:** The Developer follows the credential-acquisition protocol (`auth.md § 0`). Ask the user for `client_id` / `client_secret`; if user has none, fall back to reading the repo root `.env`; if still empty, leave placeholders blank and report as a missing piece (per § 4c-6 protocol). DO NOT invent values. Also document that both vars are **server-only** (no `NEXT_PUBLIC_` prefix) in `.env.example` and update `.gitignore` to cover `.env.local` (scaffold already does this — verify).
- **Expected Output:** `products/pageshot/site/next-app/.env.local` exists. Contains `SITECORE_CLIENT_ID=<value-or-blank>` and `SITECORE_CLIENT_SECRET=<value-or-blank>`. `.env.example` committed with blank placeholders. Developer reports whether real values were acquired.
- **Depends on:** T002

---

### Epic E2 — Marketplace SDK integration

#### T007a — Write failing tests for MarketplaceProvider + `pages.context` wiring (RED)
- **Title:** Vitest coverage for init signature, `pages.context` subscription (path A), unmount cleanup, and `usePagesContext()` hook — **written before** any implementation work on the Provider.
- **Description:** Using the typed stub pattern from `client.md § 9` (`vi.fn<QueryFn>()`, `vi.fn<DestroyFn>()` — **no naked `vi.fn()` casts**), write `src/components/providers/marketplace.test.tsx`. Covers the behavior specified in § 10 under T007a-TEST-1..4. Tests MUST be failing (RED) at the end of this task — the Provider extension does not yet exist. Commit the failing tests so the RED state is recorded in git history.
- **Expected Output:** `src/components/providers/marketplace.test.tsx` exists with the four test cases from § 10 (T007a-TEST-1 through -4). `npm run test` reports those specific tests as failing. No production code changed.
- **Depends on:** T002, T005

#### T007b — Implement MarketplaceProvider + `pages.context` subscription (GREEN)
- **Title:** Extend the scaffolded MarketplaceProvider to expose live `pages.context` (pageId, siteName, pageName) — implementation passes the T007a tests.
- **Description:** The scaffold ships `components/providers/marketplace.tsx` with a Provider that calls `application.context`. Add a second context `PagesContextContext` that subscribes via **path A (subscribe-via-query)** — `client.query('pages.context', { subscribe: true, onSuccess })` — and stores `{ pageId, siteName, pageName }` extracted from the SDK's `PagesContext` shape (`pageInfo.id`, `siteInfo.name`, `pageInfo.name`). Provide `usePagesContext()` hook returning `{ pageId, siteName, pageName } | null`. Store and call the returned `unsubscribe` on unmount. Do NOT use `client.subscribe('pages.context', …)` — that is path B and will fail typecheck. Implement the minimum code necessary for T007a tests to go GREEN. Refactor after GREEN if needed.
- **Expected Output:** All T007a tests pass (`npm run test` green on marketplace.test.tsx). `usePagesContext()` returns null initially then live values once the SDK delivers the first event; subscription tears down on unmount.
- **Depends on:** T007a

#### T008 — Create `/panel` route (Page Context Panel surface)
- **Title:** Create `app/panel/page.tsx` as a client component that renders the PageShot panel. **Non-code scaffolding — minimal TDD requirement.**
- **Description:** Mark file with `'use client'`. Wrap in `MarketplaceProvider`. Read `usePagesContext()` and `useMarketplaceClient()` (the scaffold provides these). Render a placeholder component called `<PageshotPanel />` for now — actual UI comes in E4. Guard-clause: if `usePagesContext()` returns null, render a minimal "Loading page context…" line (per the UI spec assumption "we do not design a no-context skeleton in v1" — this is only the gap between mount and first event). Keep the route Node-less (client-only).
- **Expected Output:** `app/panel/page.tsx` exists, is a client component, renders `<PageshotPanel />` once `usePagesContext()` has values. Route loads at `http://localhost:3000/panel` without SSR errors (use `dynamic` + `{ ssr: false }` if needed).
- **Depends on:** T007b

#### T009 — (REMOVED) — subsumed by T007a
Coverage originally planned for T009 is now provided by **T007a** (RED) + T007b (GREEN). T009 is intentionally retired to enforce test-first ordering. Do not re-create.

---

### Epic E3 — Server-side OAuth proxy

#### T010a — Write failing tests for Sitecore OAuth token cache (RED)
- **Title:** Vitest coverage for `getSitecoreToken()` + `invalidateSitecoreToken()` — written **before** `lib/sitecore-token.ts` exists.
- **Description:** Create `lib/sitecore-token.test.ts` with mocked `global.fetch`. Scenarios listed in § 10 under T010a-TEST-1..6 (token fetch, cache reuse within TTL, refresh within 60 s of expiry, invalidate wipes cache, non-2xx throws, posts form-encoded body with correct audience). Tests MUST be failing (RED) at end of task — `lib/sitecore-token.ts` does not yet exist. Commit the failing tests.
- **Expected Output:** `lib/sitecore-token.test.ts` exists with the six test cases from § 10. `npm run test` reports those specific tests as failing (module-not-found or assertion failures). No production code changed.
- **Depends on:** T002

#### T010b — Implement shared Sitecore OAuth token cache (GREEN)
- **Title:** Add `lib/sitecore-token.ts` with the cached `getSitecoreToken()` function from `auth.md § 5` — implementation passes T010a tests.
- **Description:** Copy verbatim the module-scope cache + `getSitecoreToken` implementation from § 4c-6 of this breakdown (sourced from `auth.md § 5`). Token endpoint: `POST https://auth.sitecorecloud.io/oauth/token`, body `client_id`/`client_secret`/`grant_type=client_credentials`/`audience=https://api.sitecorecloud.io`. 60 s safety margin on cached expiry. Throws on non-2xx from auth. Export a named function `getSitecoreToken(): Promise<string>`. Also export `invalidateSitecoreToken(): void` which sets the module-level cache to `null` (needed for T011b's 401 retry). Implement the minimum code to make T010a tests pass; refactor after GREEN.
- **Expected Output:** All T010a tests pass. `getSitecoreToken` returns a token string, caches it, and returns the cached value on subsequent calls within the TTL window.
- **Depends on:** T010a

#### T011a — Write failing tests for `/api/screenshot/[pageId]` route handler (RED)
- **Title:** Vitest coverage of the route handler's key paths — written **before** the route exists.
- **Description:** Create `app/api/screenshot/[pageId]/route.test.ts` with mocked `global.fetch`. Scenarios are listed in § 10 under T011a-TEST-1..10. Covers: happy path, 401-once retry, 401-twice, 404, 5xx, fetch rejection, missing env, empty pageId, secret-never-in-response (NFR-S-01), tenant-id logged (not secret) on first successful auth. Tests MUST be failing (RED) at end of task. Commit the failing tests.
- **Expected Output:** `app/api/screenshot/[pageId]/route.test.ts` exists with the ten test cases from § 10. `npm run test` reports those specific tests as failing. No production code for the route created yet.
- **Depends on:** T010b

#### T011b — Implement `/api/screenshot/[pageId]` route handler (GREEN)
- **Title:** Create the Node-runtime route handler that proxies the Agent API screenshot call — implementation passes T011a tests.
- **Description:** Create `app/api/screenshot/[pageId]/route.ts`:
  - `export const runtime = "nodejs"` (ADR-0004 — NOT edge).
  - Export `GET(request, { params })`. Validate `params.pageId` is a non-empty string; otherwise return `{ ok: false, error: { code: 'not_found', message: '…' } }` with HTTP 400.
  - Check `SITECORE_CLIENT_ID` + `SITECORE_CLIENT_SECRET` are present; if missing, return `auth` envelope with HTTP 500 (FR-13).
  - Call `getSitecoreToken()`. Fetch `GET https://edge-platform.sitecorecloud.io/stream/ai-agent-api/api/v1/pages/{pageId}/screenshot` with `Authorization: Bearer <jwt>` and `Accept: application/json`.
  - **401 retry:** on `401`, call `invalidateSitecoreToken()` once, call `getSitecoreToken()` again, retry the Agent API call exactly once. If second attempt also 401, map to `auth` envelope. Do NOT retry more than once (FR-06, `auth.md § 6`).
  - Map Agent API responses to the `ScreenshotResponse` envelope from PRD § 10 / § 4c-6. Success body `{ ok: true, image: <base64> }` (Agent API returns base64 — see PRD FR-05).
  - Log (server-side only) `{ event, pageId, status, latencyMs, error? }` — never log secrets. Include tenant identifier (derived from token claim or env label) on first successful auth per R-6.
  - Return `NextResponse.json(envelope, { status })`.
  - Implement the minimum code to make T011a tests pass; refactor after GREEN.
- **Expected Output:** All T011a tests pass. Manual curl hitting `http://localhost:3000/api/screenshot/test` with credentials returns `{ ok: true, image: "<base64>" }` or a structured error envelope.
- **Depends on:** T011a

#### T012 — (REMOVED) — subsumed by T011a
Coverage originally planned for T012 is now written **before** T011b (as T011a). T012 is retired to enforce test-first ordering. Do not re-create.

---

### Epic E4 — Panel UI — Shutterbug direction

#### T013a — Write failing tests for panel state machine reducer (RED)
- **Title:** Vitest coverage of the `usePanelState` reducer — written **before** the reducer exists.
- **Description:** Create `components/use-panel-state.test.ts` (pure reducer tests — no React render needed). Scenarios in § 10 under T013a-TEST-1..6 cover every transition listed in the PRD § 10 union and FR-11. Tests MUST be failing (RED). Commit the failing tests.
- **Expected Output:** `components/use-panel-state.test.ts` exists with six transition tests. `npm run test` reports failures.
- **Depends on:** T008, T011b

#### T013b — Implement panel state machine + `<PageshotPanel>` root (GREEN)
- **Title:** Create a typed `usePanelState` reducer for the four top-level states and wire into `<PageshotPanel>` — implementation passes T013a tests.
- **Description:** `PanelState` discriminated union from PRD § 10: `idle | capturing | ready | error`. State transitions:
  - `idle` → `capturing` on Capture button click (record `startedAt`).
  - `capturing` → `ready` on `{ ok: true, image }` from `/api/screenshot/[pageId]`.
  - `capturing` → `error` on `{ ok: false, error }` envelope (copy `code` + `message` verbatim).
  - `ready` → `capturing` on Capture click (replaces previous image — FR-11).
  - `error` → `capturing` on Retry click.
  Implement `<PageshotPanel>` client component as the root element of `/panel`. It reads `usePagesContext()` and passes `{ pageId, siteName, pageName }` into the state machine. On capture trigger, issues `fetch('/api/screenshot/' + encodeURIComponent(pageId))` and dispatches accordingly. Implement the minimum code to make T013a tests pass; refactor after GREEN.
- **Expected Output:** All T013a tests pass. `components/PageshotPanel.tsx` + a reducer module. `/panel` compiles and transitions through the four states in the browser against the dev server.
- **Depends on:** T013a

#### T014a — Write failing tests for `<Shutter>` (RED)
- **Title:** Vitest + Testing Library coverage of Shutter button states, keyboard operability, ARIA, reduced-motion — written **before** `components/Shutter.tsx` exists.
- **Description:** Create `components/Shutter.test.tsx`. Scenarios in § 10 under T014a-TEST-1..6 (render per state, `aria-busy` during capturing, keyboard Enter/Space activation, visible focus ring not suppressed, disabled state swallows clicks, reduced-motion collapses scale + bloom). Tests MUST be failing (RED). Commit.
- **Expected Output:** `components/Shutter.test.tsx` exists with six test cases; `npm run test` reports failures.
- **Depends on:** T004, T005, T013b

#### T014b — `<Shutter>` hero button (GREEN)
- **Title:** Implement the 112×112 px amber hero shutter button with all eight visual states — passes T014a tests.
- **Description:** Component `components/Shutter.tsx`. Props `{ state: 'idle' | 'capturing' | 'capturing-slow' | 'disabled'; elapsedSeconds?: number; onPress: () => void }`. Match POC v2 CSS exactly:
  - **Default:** `bg-amber-500`, 112 px circle, 4 px `amber-200` ring (`0 0 0 4px var(--amber-200)` via `shadow-shutter`), white camera glyph (Lucide `Camera` at 28 px).
  - **Hover:** `amber-600` bg, ring expands to `amber-300`.
  - **Focus-visible:** amber-400 ring, 2 px offset from `amber-50`. Never suppress.
  - **Pressed:** `active:scale-[0.92]` with the POC's `shutter-press` keyframe — 120 ms scale 1 → 0.92 → 1.02 → 1 via `cubic-bezier(0.34, 1.56, 0.64, 1)`.
  - **Capturing:** replace camera icon with spinning aperture (`animate-spin` 1.6 s linear). Set `aria-busy="true"`, `aria-label="Capturing screenshot"`.
  - **Capturing-slow:** visually identical to capturing; the elapsed counter sits in the label slot (handled by `<ShutterLabel>` — T015).
  - **Disabled:** `bg-amber-200`, no ring, no shadow.
  - **Reduced motion:** under `@media (prefers-reduced-motion: reduce)`, drop the scale/spring and the bloom; keep a short 80 ms opacity dip for press.
  Capture bloom: add a sibling `<div>` overlaying the panel that runs the `animate-shutter-bloom` keyframe for 200 ms on click (only when not reduced-motion).
  Implement the minimum code to make T014a tests pass; refactor after GREEN.
- **Expected Output:** All T014a tests pass. `<Shutter>` renders each state faithfully to POC v2. Tab/Enter/Space activate. `prefers-reduced-motion` verified.
- **Depends on:** T014a

#### T015 — `<ShutterLabel>` with elapsed-time counter
- **Title:** Label + mono elapsed-time pill under the shutter. Tested inside T014b + T016b suites; no separate test task.
- **Description:** Component `components/ShutterLabel.tsx`. Props `{ state, elapsedSeconds? }`. Renders the main label ("Capture" | "Capturing…") in Geist Sans 500 13 px (14 px at `@container md`). In `capturing-slow`, adds a secondary mono line `"Still catching… {n} s"` in Geist Mono 11/12 px, `text-amber-700`. The parent panel's `LiveRegion` (T023b) announces the elapsed count polite-ly every second past 5 s.
- **Expected Output:** Rendering matches POC v2 label zone. The sub-line only appears when `state === 'capturing-slow'`.
- **Depends on:** T014b

#### T016a — Write failing tests for elapsed-time controller (RED)
- **Title:** Vitest coverage for the 5-second threshold and timer cleanup — written **before** the hook exists.
- **Description:** Use `vi.useFakeTimers()`. Scenarios in § 10 under T016a-TEST-1..4: counter does NOT appear at 4 s; counter appears exactly at 5 s; increments each second past 5 s; interval is cleared on any transition out of `capturing` (no leak). Tests MUST be failing (RED). Commit.
- **Expected Output:** `components/use-elapsed.test.ts` (or integrated into `PageshotPanel.test.tsx`) exists with the four test cases. `npm run test` reports failures.
- **Depends on:** T013b, T015

#### T016b — Elapsed-time controller (GREEN)
- **Title:** Wire the elapsed-seconds hook that flips `capturing` → `capturing-slow` at 5 s — passes T016a tests.
- **Description:** In `<PageshotPanel>`, when state is `capturing`, start a `setInterval` ticking every 1 s. If `Date.now() - startedAt >= 5000`, dispatch a state-preserving update to show the elapsed seconds (label changes to `capturing-slow` visually; the `PanelState` kind is still `capturing` logically — add a derived `elapsedSeconds?: number` next to `startedAt`). Clear the interval on any transition out of `capturing`. Announce "Still capturing, N seconds" to the LiveRegion each second past 5. Implement the minimum to pass T016a; refactor after GREEN.
- **Expected Output:** All T016a tests pass. After 5 s of capturing, the mono sub-line appears and updates every second. Announcement fires. No dangling timer.
- **Depends on:** T016a

#### T017a — Write failing tests for `<PolaroidCard>` (RED)
- **Title:** Vitest + Testing Library coverage of Polaroid ready/error variants — written **before** the component exists.
- **Description:** Create `components/PolaroidCard.test.tsx`. Scenarios in § 10 under T017a-TEST-1..5 (ready renders `<img>` with data URL + full alt text incl. siteName/pageName/capturedAt; ledge shows `{site}/{page}` + `HH:mm` local; error renders icon + title + subtitle; error ledge shows FR-12 hint italic; reduced-motion collapses slide-up to opacity only). Tests MUST be failing (RED). Commit.
- **Expected Output:** `components/PolaroidCard.test.tsx` exists with five test cases. `npm run test` reports failures.
- **Depends on:** T004, T005, T013b

#### T017b — `<PolaroidCard>` (ready + error variants) (GREEN)
- **Title:** The framed preview card for both successful captures and error states — passes T017a tests.
- **Description:** Component `components/PolaroidCard.tsx`. Discriminated prop union:
  - `{ kind: 'ready'; imageBase64: string; siteName: string; pageName: string; capturedAt: Date }`
  - `{ kind: 'error'; code: 'auth'|'not_found'|'upstream_unavailable'|'network'|'unknown'; title: string; subtitle: string }`
  **Ready:** white surface, `rounded-3xl`, `p-2` (or `p-3` at `@container md`), `border border-stone-200/60`, `shadow-polaroid`. Image slot `aspect-[4/3] rounded-2xl overflow-hidden bg-stone-100`; render `<img src={'data:image/png;base64,' + imageBase64} alt="Screenshot of page {pageName} on {siteName}, captured {capturedAt}" />` with `object-cover object-top`. Bottom ledge: `px-3 py-2 mt-1 border-t text-[11px] font-mono text-stone-600 flex items-center justify-between gap-2`, left = truncated `{siteName}/{pageName}`, right = `HH:mm` local. At `@container xs` (320 px) drop ledge text to 10 px. Arrival motion: `translate-y-2 opacity-0` → `translate-y-0 opacity-100` over 240 ms; reduced-motion = opacity only.
  **Error:** same frame. Image slot `bg-stone-50`, flex-column with large icon (`AlertCircle` | `WifiOff` 32 px, stroke 1.5, `text-rose-500`), title in `text-sm font-medium text-rose-600`, subtitle in `text-xs text-stone-600 text-center max-w-[28ch]`. Ledge shows the FR-12 hint ("Shows the last saved version of this page.") in `text-[11px] italic text-stone-500` center-aligned.
  Implement the minimum code to make T017a tests pass; refactor after GREEN.
- **Expected Output:** All T017a tests pass. Both variants render per POC v2. `<img alt>` populated. Reduced-motion respected.
- **Depends on:** T017a

#### T018a — Write failing tests for `<ActionPill>` (RED)
- **Title:** Vitest coverage of the three variants and all pill states — written **before** the component exists.
- **Description:** Create `components/ActionPill.test.tsx`. Scenarios in § 10 under T018a-TEST-1..5: variant `copy`/`download`/`retry` renders the right icon + label; disabled state swallows click; success state auto-reverts (1.8 s for copy, 1.4 s for download) via fake timers; denied state locks disabled; keyboard Enter/Space activate. Tests MUST be failing (RED). Commit.
- **Expected Output:** `components/ActionPill.test.tsx` exists with five test cases. `npm run test` reports failures.
- **Depends on:** T004

#### T018b — `<ActionPill>` (Copy, Download, Retry) (GREEN)
- **Title:** Pill-shaped action buttons with success/denied/disabled states — passes T018a tests.
- **Description:** Component `components/ActionPill.tsx` using `cva` for variants. Base: `h-10 rounded-full border border-stone-300 bg-white px-4 text-sm font-medium text-stone-900`. States:
  - Hover: `bg-amber-50 border-amber-300`.
  - Focus-visible: `ring-2 ring-amber-400 ring-offset-2 ring-offset-amber-50`.
  - Pressed: `bg-amber-100`.
  - Success (Copy → "Copied ✓" / Download → "Saved"): `bg-amber-50 border-amber-300 text-amber-700` + `Check` icon prepended. Auto-reverts after 1.8 s (Copy) or 1.4 s (Download).
  - Disabled: `opacity-50 cursor-not-allowed`.
  - Denied (Copy only after clipboard reject): apply the `animate-[shake_80ms_ease-in-out]` keyframe once, then lock to disabled.
  - `retry` variant: `border-amber-400 text-amber-700` + `RefreshCw` icon; replaces Download in error state.
  Implement the minimum code to make T018a tests pass; refactor after GREEN.
- **Expected Output:** All T018a tests pass. Three variants + state matrix match POC v2. Keyboard activation works.
- **Depends on:** T018a

#### T019 — Layout assembly: Header, StatusLine, EmptyPreview, ActionBar
- **Title:** Assemble `<PageshotPanel>` layout matching POC v2 top-to-bottom. Tested via the T025-series integration tests (see § 10 T025-TEST-*); no separate RED task because this is pure composition of already-tested components.
- **Description:** Layout zones in DOM order (which equals visual order — § 5 focus order requirement):
  1. Header: wordmark "PageShot" + aperture-dot SVG (copy the SVG from POC v2 `tpl-screenshot` / `.aperture-dot` block) in Geist Sans 600 13 px, left-aligned, 44 px tall.
  2. StatusLine: `.status-title` 18 px Geist Sans 600; `.status-hint` 13 px Geist Sans 400 stone-600. Status copy by state (verbatim from POC / spec):
     - idle → "Ready when you are." / "Shows the last saved version of this page."
     - capturing (incl. slow) → "Catching it…" / same hint.
     - ready → "Got it." / same hint.
     - error → "Didn't quite catch that." / "We couldn't reach the page this time."
     Note the right curly apostrophe in "Didn't" (use `\u2019`).
  3. Hero: `<Shutter>` + `<ShutterLabel>` centered.
  4. `<EmptyPreview>` (idle only): `rounded-3xl border-2 border-dashed border-stone-300 bg-white/40 py-10 px-4 text-center text-sm text-stone-500`. Content: "Tap Capture to catch this page."
  5. `<PolaroidCard>` (ready / error only).
  6. ActionBar: `<ActionPill variant="copy">` + `<ActionPill variant="download">` (ready) or `<ActionPill variant="retry">` replacing Download (error). Copy is `flex-none min-w-24`, Download/Retry is `flex-1`. At `@container xs` (320 px) stack vertically — Copy on top, Download below — each `w-full`.
  7. `<InlineMessage>` under ActionBar (T022).
  8. `<LiveRegion>` sr-only at root (T023b).
- **Expected Output:** `/panel` renders all zones in the correct order and shows the correct subset per state. Status copy matches exactly.
- **Depends on:** T014b, T015, T017b, T018b, T022b

#### T020a — Write failing tests for Copy-to-clipboard + denied fallback (RED)
- **Title:** Vitest + Testing Library coverage of successful copy path AND permission denial — written **before** the Copy wiring exists.
- **Description:** Create `components/copy-action.test.tsx` (or inside `PageshotPanel.test.tsx`). Scenarios in § 10 under T020a-TEST-1..4: successful copy writes `ClipboardItem` with `image/png` blob and PNG magic bytes; morphs pill to "Copied" then reverts after 1.8 s; permission denial shakes pill, disables Copy, renders InlineMessage with exact wording, keeps Download enabled; `ClipboardItem` undefined altogether disables Copy from the outset. Tests MUST be failing (RED). Commit.
- **Expected Output:** Four test cases present; `npm run test` reports failures.
- **Depends on:** T017b, T018b, T022b

#### T020b — Copy-to-clipboard action + denied fallback (GREEN)
- **Title:** Wire the Copy pill to `navigator.clipboard.write` and handle permission denial — passes T020a tests.
- **Description:** On Copy click in `ready` state: decode the base64 image to a Blob (`Uint8Array.from(atob(base64), c => c.charCodeAt(0))` → `new Blob([bytes], { type: 'image/png' })`). Call `navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])` (FR-08 / AC-2.2). On success, morph pill to "Copied ✓" for 1.8 s, announce via LiveRegion. On reject (DOMException `NotAllowedError` etc.): trigger shake animation on the pill, disable it (denied → locked disabled per spec), render inline message "Clipboard access was blocked. Use Download instead." via `<InlineMessage>`, keep Download enabled (AC-2.4).
  Also surface the fallback when `navigator.clipboard.write` is not defined at all — same inline message, Copy pill stays disabled from the outset for that session.
  Implement the minimum to make T020a tests pass; refactor after GREEN.
- **Expected Output:** All T020a tests pass. Successful copy puts the PNG on the system clipboard. Denial path shows inline message and disables only Copy.
- **Depends on:** T020a

#### T021a — Write failing tests for filename helper + download action (RED)
- **Title:** Vitest coverage of `buildScreenshotFilename` sanitization AND the Download-click pipeline — written **before** `lib/filename.ts` or the Download wiring exists.
- **Description:** Create `lib/filename.test.ts` plus Download-click scenarios in `components/download-action.test.tsx` (or inside `PageshotPanel.test.tsx`). Scenarios in § 10 under T021a-TEST-1..7 (baseline template; unicode → `-`; emoji → `-`; mixed-case → lowercase; 200-char input truncates to ≤ 100 preserving `.png` + timestamp; minute-granularity collision produces identical filename twice; Download click synthesizes `<a download>` with the helper's filename and revokes the object URL). Tests MUST be failing (RED). Commit.
- **Expected Output:** Seven test cases present; `npm run test` reports failures.
- **Depends on:** T017b, T018b

#### T021b — Download action with filename template (GREEN)
- **Title:** Trigger a PNG download with `{siteName}_{pageName}_{YYYYMMDD-HHmm}.png`, kebab/ASCII, 100 chars — passes T021a tests.
- **Description:** On Download click in `ready` state: decode the base64 PNG to a Blob, create `URL.createObjectURL`, synthesize an `<a download>` element, click it, revoke. Filename: add helper `buildScreenshotFilename(siteName, pageName, capturedAt): string` that:
  1. Lowercases.
  2. Replaces non-`[a-z0-9-_]` with `-`.
  3. Collapses runs of `-`.
  4. Concatenates `${site}_${page}_${YYYYMMDD}-${HHmm}.png` using local time (not UTC).
  5. If total length > 100 chars, truncate the `site` and `page` portions proportionally while preserving `.png` and the timestamp suffix — never drop the extension.
  (FR-09, AC-3.2, AC-3.3, AC-3.4.) After trigger, flash pill success state "Saved" for 1.4 s.
  Implement the minimum to make T021a tests pass; refactor after GREEN.
- **Expected Output:** All T021a tests pass. File downloads with the correct filename. Unicode/emoji in site/page names get sanitized to `-`. Long names truncate to ≤ 100 chars preserving the extension.
- **Depends on:** T021a

#### T022a — Write failing tests for `<InlineMessage>` (RED)
- **Title:** Vitest coverage for visible/hidden behavior and a11y role — written **before** the component exists.
- **Description:** Create `components/InlineMessage.test.tsx`. Scenarios in § 10 under T022a-TEST-1..2: when `visible=true` renders `role="status"` + `aria-live="polite"` with children visible; when `visible=false` the node is hidden from the accessibility tree (display:none) and screen readers do not announce. Tests MUST be failing (RED). Commit.
- **Expected Output:** Two test cases present; `npm run test` reports failures.
- **Depends on:** T004

#### T022b — `<InlineMessage>` component (GREEN)
- **Title:** Inline message slot for clipboard-denied and secondary hints — passes T022a tests.
- **Description:** `components/InlineMessage.tsx`. Props `{ visible: boolean; children: ReactNode; tone?: 'info' | 'warn' }`. Role `status`, `aria-live="polite"`. Styling: `mt-2 text-xs text-stone-600 bg-stone-50 border border-stone-200 px-3 py-2 rounded-lg`. Hidden via `data-visible="false"` + `display: none` to avoid layout thrash. Implement the minimum to make T022a tests pass.
- **Expected Output:** All T022a tests pass. Shows/hides deterministically. Screen readers announce content when it appears.
- **Depends on:** T022a

#### T023a — Write failing tests for `<LiveRegion>` announcer (RED)
- **Title:** Vitest coverage for each state-change announcement wording — written **before** the component exists.
- **Description:** Create `components/LiveRegion.test.tsx`. Scenarios in § 10 under T023a-TEST-1..3: `role="status"` + `aria-live="polite"` + `.sr-only`; `announce()` updates the region's text content; each of the seven state-change messages fires with the exact wording. Tests MUST be failing (RED). Commit.
- **Expected Output:** Three test cases present; `npm run test` reports failures.
- **Depends on:** T013b

#### T023b — `<LiveRegion>` accessibility announcer (GREEN)
- **Title:** Single sr-only polite live region at panel root — passes T023a tests.
- **Description:** `components/LiveRegion.tsx`. Renders `<div role="status" aria-live="polite" class="sr-only">{message}</div>`. Export an `announce(msg: string)` helper (via a simple context) used by the state machine to announce the exact seven messages defined in § 4c-4 "Announcement catalogue": "Ready to capture.", "Capturing started.", "Still capturing, N seconds.", "Screenshot ready.", "Copied to clipboard.", "Download started.", "Capture failed: <title>. <subtitle>." Implement the minimum to make T023a tests pass.
- **Expected Output:** All T023a tests pass. Every state change produces an announcement. Region is visually invisible.
- **Depends on:** T023a, T019

#### T024a — Write failing tests for keyboard map + focus management (RED)
- **Title:** Vitest + Testing Library coverage of focus-on-mount, auto-advance to Copy / Retry, Escape-returns-to-Shutter, and Tab order — written **before** the wiring exists.
- **Description:** Scenarios in § 10 under T024a-TEST-1..5: Shutter is `document.activeElement` after first non-null `pages.context`; capturing → ready moves focus to Copy (with `preventScroll`); capturing → error moves focus to Retry; `Escape` from inside any inner focusable returns focus to Shutter; Tab order matches DOM order (Shutter → Copy → Download/Retry). Tests MUST be failing (RED). Commit.
- **Expected Output:** Five test cases present; `npm run test` reports failures.
- **Depends on:** T019

#### T024b — Implement keyboard map + focus management (GREEN)
- **Title:** Implement the focus strategy from UI spec § Flow E (copied into § 4c-4 "Keyboard & focus map") — passes T024a tests.
- **Description:**
  - On panel mount → `shutter.focus()` (after first non-null pages.context).
  - `capturing` → `ready` → move focus to Copy pill (`btnCopy.focus({ preventScroll: true })`).
  - `capturing` → `error` → move focus to Retry pill.
  - `ready` re-capture press → focus stays on Shutter through `capturing` → returns to Copy on `ready`.
  - Global `Escape` handler (on `<PageshotPanel>`) → refocus Shutter.
  - Tab order = DOM order (ensured by T019 layout).
  - `Enter` / `Space` activate focused button (native `<button>` behavior — no custom handling).
  Implement the minimum to make T024a tests pass.
- **Expected Output:** All T024a tests pass. Keyboard walkthrough matches § Flow E exactly.
- **Depends on:** T024a

#### T025 — Integration & regression UI tests (golden-path end-to-end inside jsdom)
- **Title:** `@testing-library/react` integration tests that span the assembled `<PageshotPanel>` — not duplicates of component-level tests but end-to-end flows and regressions not covered individually.
- **Description:** Stubs `MarketplaceProvider` + mocks `global.fetch`. Scenarios in § 10 under T025-TEST-1..6 (golden-path flow end-to-end; `/api/screenshot/[pageId]` client-side offline short-circuit per AC-5.4; 5xx → error card with Retry visible; `prefers-reduced-motion` collapses bloom + slide-up across the whole panel; ARIA live region receives every announcement in order on a full run; unsaved-draft hint remains visible whenever panel is mounted on a valid pageId — FR-12 / AC-4.1). These are **integration** tests — unit coverage of individual components already lives in T014a / T017a / T018a / etc.
- **Expected Output:** `components/PageshotPanel.integration.test.tsx` green. `npm run test` overall green.
- **Depends on:** T013b, T014b, T015, T016b, T017b, T018b, T019, T020b, T021b, T022b, T023b, T024b

---

### Epic E5 — Cloud Portal custom-app registration

#### T026 — Deploy to Vercel (preview branch)
- **Title:** Push branch, get Vercel preview URL, set preview env vars.
- **Description:** In Vercel project "pageshot" (create if missing; project name matches OQ-3 resolution): link repo, select `products/pageshot/site/next-app` as the app root. Set preview-scope env vars `SITECORE_CLIENT_ID` and `SITECORE_CLIENT_SECRET` (server-only, no `NEXT_PUBLIC_` prefix). Push a branch to trigger a preview deploy; capture the preview URL (format `https://pageshot-<branch>-<team>.vercel.app`).
- **Expected Output:** A Vercel preview URL is live on HTTPS and responds 200 on `/panel`. Env vars present in preview scope.
- **Depends on:** T025

#### T027 — Register **test** custom app in Cloud Portal
- **Title:** Create a `PageShot — TEST` custom app in Cloud Portal and install it into the target tenant.
- **Description:** Cloud Portal → App Studio → Create custom app. Name `PageShot — TEST`. Extension point: **Page Builder Context Panel** (`xmc:pages:contextpanel`). Panel URL: `<Vercel preview URL>/panel`. API access: grant the SitecoreAI Agent API scopes required for the `/screenshot` endpoint (minimum set — see `lifecycle.md § 3`). Environment binding: the target XM Cloud environment. Install into the organization. Capture orgId for the runbook (visible in portal URL / settings).
- **Expected Output:** `PageShot — TEST` appears in Cloud Portal app list; installed in the target tenant; iframe loads from the Vercel preview URL.
- **Depends on:** T026

#### T028 — Register **production** custom app + production Vercel env vars
- **Title:** Create a `PageShot` (production) custom app in Cloud Portal pointing at the Vercel production URL.
- **Description:** Push `main` to trigger a production deploy. Set production-scope env vars `SITECORE_CLIENT_ID` / `SITECORE_CLIENT_SECRET` (may differ from preview values if the tenant uses different automation clients). Cloud Portal → create a second custom app called `PageShot`, extension point Page Builder Context Panel, panel URL = Vercel production URL `/panel`, minimized API access scopes. Install into the production target tenant.
- **Expected Output:** Two Cloud Portal custom apps (`PageShot — TEST` + `PageShot`), each installed in its respective environment. Production app loads from the Vercel production URL.
- **Depends on:** T027

---

### Epic E6 — Dogfood verification & catalog logging

#### T029 — End-to-end smoke test on Vercel preview
- **Title:** Open Pages editor on a real page in the target tenant, open PageShot panel, capture, copy, download.
- **Description:** Walk the happy path from PRD § 12 phase 1 step 7:
  1. Open Sitecore Pages editor in the target tenant.
  2. Navigate to an existing, saved page.
  3. Open the PageShot Context Panel.
  4. Click Capture. Verify ≤ 10 s wall-clock to ready state (M1).
  5. Click Copy. Paste into a chat window — verify a PNG image appears.
  6. Click Capture again, then Download. Verify file downloaded with the template-matching filename.
  7. Test 404 path: navigate to a brand-new unsaved page; click Capture; verify the "Save the page first, then try again." error card.
  8. Test clipboard-denied path: revoke clipboard permission for the app origin in Chrome settings, click Copy; verify the inline message + shake.
- **Expected Output:** All seven checks pass. Screenshots of each step captured for the ship report.
- **Depends on:** T028

#### T030 — Append dogfood run entry to Marketplace SDK CATALOG
- **Title:** Log the run + any friction in `.agent/skills/sitecore/marketplace-sdk/CATALOG.md`.
- **Description:** Append a run row to the Marketplace SDK catalog's dogfood-log table with:
  - Date (2026-04-22) and the run label.
  - Resolved `@sitecore-marketplace-sdk/client` + `/xmc` versions (from `products/pageshot/site/next-app/package.json`).
  - Which sections of which skill files were exercised (`setup/scaffold.md § Scaffold 2`, `marketplace-sdk/lifecycle.md § 4a + § 5a`, `marketplace-sdk/client.md § 2 + § 4 + § 6a`, `apis/sitecoreai/auth.md § 5 + § 6`, `apis/sitecoreai/agent-api.md § Pages`).
  - Any friction encountered during the run classified as **skill gap / command gap / external bug / none**, each with a one-line patch-candidate description.
  - If any mid-run edits to skill files were necessary, cite them as a D1 breach and root-cause them.
- **Expected Output:** `CATALOG.md` committed with a new run row. Patch-queue entries (if any) enumerated below the run row.
- **Depends on:** T029

---

## 4b. Important Test Cases (by epic / feature)

This section names the most important behavioral checks narratively. **The exhaustive per-task test specs (scenario + expected outcome + test type + file location) live in § 10.** Each item below cross-links to the test sub-ID in § 10 that owns it.

### E1 — Scaffold & project skeleton (non-code / regression)
- Scaffold from `shadcn@latest add …quickstart-with-client-side-xmc.json` succeeds non-interactively on a clean machine. (E2E — manual, run once during T001; non-code thereafter)
- `npm run typecheck`, `npm run lint`, `npm run build`, `npm run test` all green immediately after T002. (regression — run in CI, not a new test)
- PNA headers present on `GET /` response in dev (§ 10 → T003-TEST-1).
- Tailwind `shadow-shutter`, `shadow-polaroid`, `animate-shutter-bloom` compile and render (§ 10 → T004-TEST-1).

### E2 — Marketplace SDK integration (gated by T007a RED before T007b GREEN)
- `ClientSDK.init` called exactly once with `target: window.parent` and `modules` registered (§ 10 → T007a-TEST-1).
- `pages.context` subscribed via **path A** (query with `subscribe: true`); path B call would fail typecheck — regression guard (§ 10 → T007a-TEST-2).
- Unmount tears down the subscription AND calls `client.destroy()` (§ 10 → T007a-TEST-3).
- `usePagesContext()` returns null pre-event, then correct values post-event (§ 10 → T007a-TEST-4).

### E3 — Server-side OAuth proxy (gated by T010a + T011a RED before GREEN)
- **Golden path:** 200 from Agent API → `{ ok: true, image }` returned; latency logged (§ 10 → T011a-TEST-1).
- **401-once retry:** upstream 401 → token invalidated → second call 200 → `{ ok: true }`. Exactly 2 upstream calls (§ 10 → T011a-TEST-2; guards R-2 and AC-5.1).
- **Double 401:** two 401s → `{ error: { code: 'auth' } }`; no third call (§ 10 → T011a-TEST-3).
- **404** → `not_found` envelope (§ 10 → T011a-TEST-4; AC-4.3 / AC-5.2).
- **5xx / timeout / fetch reject** map to `upstream_unavailable` / `network` respectively (§ 10 → T011a-TEST-5, T011a-TEST-6; AC-5.3 / AC-5.4).
- **Missing env:** blank `SITECORE_CLIENT_ID` → `auth` envelope without hitting auth endpoint (§ 10 → T011a-TEST-7; FR-13, R-6).
- **Bad pageId:** empty string / non-string → HTTP 400 + `not_found` (§ 10 → T011a-TEST-8).
- **Secret never in response / never logged** (§ 10 → T011a-TEST-9; NFR-S-01, NFR-O-01).
- **Tenant identifier logged on first successful auth** (§ 10 → T011a-TEST-10; R-6).
- **Token cache reuse within TTL:** second call within expiry does NOT call `/oauth/token` (§ 10 → T010a-TEST-2).
- **Token cache refresh at 60 s margin:** call after `expiresAt - 60 s` refreshes (§ 10 → T010a-TEST-3).

### E4 — Panel UI — Shutterbug direction (each component gated by its `a` RED task)
- Idle: Shutter focused on mount, Copy/Download disabled, EmptyPreview visible, PolaroidCard absent (§ 10 → T024a-TEST-1, T025-TEST-1).
- Elapsed counter appears at exactly 5 s (not 4, not 6) and updates every second (§ 10 → T016a-TEST-1, T016a-TEST-2, T016a-TEST-3; guards R-1).
- Ready: focus moves to Copy; PolaroidCard `<img alt>` contains siteName + pageName + capturedAt (§ 10 → T017a-TEST-1, T024a-TEST-2).
- Copy success: pill text morphs to "Copied" then reverts after 1.8 s; LiveRegion announces "Copied to clipboard." (§ 10 → T020a-TEST-2, T023a-TEST-3).
- Copy denied: shake + InlineMessage "Clipboard access was blocked. Use Download instead."; Download remains enabled (§ 10 → T020a-TEST-3; guards R-3 / AC-2.4).
- Clipboard API undefined altogether (§ 10 → T020a-TEST-4).
- Filename sanitization — unicode / emoji / non-ASCII replaced with `-`; kebab-case; ≤ 100 chars; `.png` preserved even after truncation; minute-granularity collision (§ 10 → T021a-TEST-1 through T021a-TEST-6; AC-3.3).
- 404 error card — title + subtitle exact copy from § 4c-4; Retry replaces Download; Copy disabled (§ 10 → T017a-TEST-3; guards R-5).
- Unsaved-draft hint always visible on valid pageId (§ 10 → T025-TEST-6; FR-12 / AC-4.1).
- Reduced motion: no spring, no bloom, no slide-up (§ 10 → T014a-TEST-6, T017a-TEST-5, T025-TEST-4).
- Escape returns focus to Shutter (§ 10 → T024a-TEST-4).
- All ARIA live-region announcements in order on a full run (§ 10 → T023a-TEST-3, T025-TEST-5).
- Secret never reaches the browser (§ 10 → T011a-TEST-9; build-time lint + runtime response-shape assertion).

### E5 — Registration (non-code / manual)
- `PageShot — TEST` custom app loads from the Vercel preview URL inside Pages editor iframe without CSP / cookie errors (NFR-Co-01). **Manual** — tracked in T027 checklist; no automated test.
- Both test and prod custom apps have their env vars scoped correctly (preview vars do not leak to production and vice versa — guards R-6). **Manual** — tracked in T028 checklist.

### E6 — Dogfood verification (non-code / manual)
- Happy path under 10 s (M1) on the live tenant — **manual** E2E in T029.
- Zero mid-run edits to skill files (D1 guard) — **manual** catalog check in T030.
- Any friction logged as patch-queue entry in CATALOG (D3 guard) — **manual** catalog check in T030.

---

## 4c. Implementation execution contract (for Developer 08)

### 4c-1. Non-negotiable technical boundaries

- **Secrets are server-side only.** `SITECORE_CLIENT_ID` and `SITECORE_CLIENT_SECRET` live in server-runtime environment only. They are read exclusively inside `app/api/screenshot/[pageId]/route.ts` and `lib/sitecore-token.ts`. The panel (any file under `app/panel/**` or `components/**`) must never reference these vars — **ADR-0002**, FR-04, NFR-S-01.
- **Never prefix these env vars with `NEXT_PUBLIC_`.** That would inline them into the client bundle — ADR-0002.
- **Stateless — no database, no persisted captures.** No Postgres, no KV, no Redis, no Blob, no Vercel Blob. Images live in React state and the user's clipboard / Downloads folder. Token cache is in-memory only — **ADR-0006**, NFR-S-03.
- **No local HTTPS.** Do NOT set up mkcert, do NOT add `--experimental-https` to the dev script. Local dev is HTTP on `:3000` for UI iteration only; iframe testing runs against Vercel preview URLs — **ADR-0003**.
- **Custom app only (single tenant).** Do not prepare submission materials, do not submit to the public Marketplace — **ADR-0005**.
- **SDK-first rule.** Page context (`pageId`, `siteName`, `pageName`) comes from `@sitecore-marketplace-sdk/client`'s `pages.context` subscription. Only the `/screenshot` call falls back to direct Agent API (no SDK wrapper exists for it). Do NOT call Agent API `sites` / `pages` / etc. from this app — it is out of scope and violates the SDK-first rule documented in `.agent/skills/sitecore/index.md`.
- **Route handler runs on Node runtime.** `export const runtime = "nodejs"` — not `edge` — **ADR-0004**.
- **App Router.** No `pages/` directory; only `app/` — **ADR-0004**.
- **401 retry is exactly once.** On a persistent 401 the envelope surfaces `code: 'auth'` with the admin-message copy — **FR-06**, `auth.md § 6`.
- **Never log `client_secret` or the bearer token.** Log tenant id, status, latency only — NFR-O-01.
- **TypeScript strict, no `as any` / `as never` on SDK call sites.** If typecheck errors on a `client.query` key, the cause is a missing module import or wrong key string — fix the root cause per `client.md § 8a`. The one allowed cast is `as unknown as ClientSDK` on the assembled test stub object (`client.md § 9a`).
- **`pages.context` is subscribed via PATH A (query with `subscribe: true`), not `client.subscribe`.** `pages.context` lives in `QueryMap`, not `SubscribeMap`; the verb-based subscribe will fail typecheck — `client.md § 6`.
- **Filename template is lower-kebab-case ASCII ≤ 100 chars, `.png` preserved** — FR-09, AC-3.3.

### 4c-2. ADR one-liners

- **ADR-0001:** ADRs are the architecture backbone for this product; every non-obvious technical choice lands as a new ADR.
- **ADR-0002:** PageShot is a client-side iframe Marketplace app PLUS one Node-runtime route handler that holds the OAuth secret and proxies the Agent API screenshot call; all Sitecore API calls go through this route — direct-from-browser is forbidden.
- **ADR-0003:** Local dev runs on plain HTTP; all iframe / portal testing happens on Vercel preview URLs (HTTPS by default); no local HTTPS certificate setup.
- **ADR-0004:** Next.js 15+ App Router + TypeScript strict + React 19 + Tailwind; route handlers run on the Node runtime; stack upgrades crossing a major version boundary get their own ADR.
- **ADR-0005:** Two custom-app registrations (test + production), no public Marketplace submission in v1.
- **ADR-0006:** No database, no persisted images, no telemetry pipeline; in-memory token cache only; any future persistence requirement lands as a superseding ADR.

### 4c-3. Stack / tooling specifics

**Package manager:** `npm` (the shadcn quickstart uses npm; a `package-lock.json` is committed).

**Scaffold command (Task T001 — Marketplace Client-Side quickstart, from `setup/scaffold.md § Scaffold 2`):**
```bash
yes '' | npx --yes shadcn@latest add \
  https://blok.sitecore.com/r/marketplace/next/quickstart-with-client-side-xmc.json \
  --yes --cwd C:/Projects/agentic/agentic.hahn-solo/products/pageshot/site
```
Output is `products/pageshot/site/next-app/` (scaffold creates the `next-app/` subdirectory — every path below is relative to that).

**Framework versions:** Next.js 16 (App Router, Turbopack dev), React 19, TypeScript strict (`strict: true`, `noUncheckedIndexedAccess: true`), Tailwind CSS v4 (ships with scaffold), shadcn/ui + Radix + Nova preset.

**Marketplace SDK versions (latest at resolve time — record in CATALOG per T030):** `@sitecore-marketplace-sdk/client@latest`, `@sitecore-marketplace-sdk/xmc@latest` (xmc is scaffold default even though PageShot itself does not use XMC queries — leaves the door open; no AI module).

**Fonts:** `geist` npm package (Geist Sans + Geist Mono), via `next/font`-equivalent integration.

**Test runner:** Vitest + @testing-library/react + @testing-library/jest-dom + jsdom + @vitejs/plugin-react. (No Playwright E2E in this plan — the real-portal smoke test in T029 is manual.)

**Vitest config (`vitest.config.ts`):**
```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';
export default defineConfig({
  plugins: [react()],
  test: { environment: 'jsdom', setupFiles: ['./vitest.setup.ts'], globals: true },
  resolve: { alias: { '@': path.resolve(__dirname, '.') } },
});
```
`vitest.setup.ts`:
```ts
import '@testing-library/jest-dom/vitest';
```
`tsconfig.json` must include `"types": ["vitest/globals", "@testing-library/jest-dom"]` or every test file fails typecheck.

**NPM scripts:**
```json
{
  "dev": "next dev --turbopack",
  "build": "next build",
  "start": "next start",
  "lint": "next lint",
  "typecheck": "tsc --noEmit",
  "test": "vitest run",
  "test:watch": "vitest"
}
```
Note the dev script does NOT include `--experimental-https` (ADR-0003).

**Chrome PNA headers (`next.config.mjs`):** add the four headers from `testing-debug.md § 3a-quater`; DO NOT combine `Access-Control-Allow-Origin: *` with `Access-Control-Allow-Credentials: true`.

**Env vars (server-only, NOT `NEXT_PUBLIC_*`):**
```
SITECORE_CLIENT_ID=<from Cloud Portal automation client — ask user per auth.md § 0>
SITECORE_CLIENT_SECRET=<from Cloud Portal automation client — ask user per auth.md § 0>
```

**Tailwind token extensions (add to `tailwind.config.ts`):**
```ts
theme: {
  extend: {
    boxShadow: {
      shutter: "0 10px 30px -8px rgb(245 158 11 / 0.35)",
      'shutter-hover': "0 14px 36px -8px rgb(245 158 11 / 0.55)",
      polaroid: "0 20px 40px -12px rgb(120 53 15 / 0.22), 0 2px 6px -2px rgb(120 53 15 / 0.08)",
    },
    keyframes: {
      shake: { "0%,100%": { transform: "translateX(0)" }, "50%": { transform: "translateX(-4px)" } },
      bloom: { "0%,100%": { opacity: "0" }, "50%": { opacity: "0.9" } },
      'shutter-press': {
        "0%": { transform: "scale(1)" }, "30%": { transform: "scale(0.92)" },
        "65%": { transform: "scale(1.02)" }, "100%": { transform: "scale(1)" },
      },
    },
    animation: {
      'shutter-bloom': "bloom 200ms ease-out",
      'shutter-press': "shutter-press 380ms cubic-bezier(0.34, 1.56, 0.64, 1)",
      shake: "shake 80ms ease-in-out",
    },
  },
},
```
Tailwind's default `amber`, `stone`, `rose` palettes are used unchanged.

**Deploy target:** Vercel project `pageshot`; repo-root for Vercel = `products/pageshot/site/next-app`.

### 4c-4. UI implementation notes

**Design direction name:** **Shutterbug** — warm cream background + amber hero shutter + polaroid preview card.

**Colors (copy exactly from POC v2 CSS vars — these are the Tailwind default `amber` / `stone` / `rose` hex values):**
- `--amber-50: #fffbeb` (panel background), `--amber-100: #fef3c7`, `--amber-200: #fde68a`, `--amber-300: #fcd34d`, `--amber-400: #fbbf24`, `--amber-500: #f59e0b` (hero), `--amber-600: #d97706` (hover), `--amber-700: #b45309` (elapsed text).
- `--stone-50: #fafaf9`, `--stone-100: #f5f5f4` (image slot bg), `--stone-200: #e7e5e4`, `--stone-300: #d6d3d1` (default pill border), `--stone-500: #78716c`, `--stone-600: #57534e` (hint / ledge), `--stone-900: #1c1917` (body text).
- `--rose-500: #f43f5e` (error icon), `--rose-600: #e11d48` (error title — the 4.5:1 contrast choice per spec § 4.5).

**Typography:** Geist Sans (UI, labels, hint, status title), Geist Mono (elapsed counter, polaroid ledge, filename mono). Weight ramp: 400 body / 500 labels / 600 hero titles + wordmark. Sizes: status title 18 px/1.25, hint 13 px/1.45, shutter label 13 px (14 px at `@container md`), ledge 11 px (10 px at `@container xs`), elapsed counter 11–12 px mono.

**Shapes:** `rounded-3xl` (24 px) cards, `rounded-full` shutter + action pills, `rounded-2xl` image slot inside polaroid.

**Hero shutter spec (T014):** 112 × 112 px circular button, `bg-amber-500`, white Lucide `Camera` glyph 28 px stroke-2, 4 px `amber-200` ring (aperture), `shadow-shutter`. Press: 120 ms spring `scale 1 → 0.92 → 1.02 → 1` via `cubic-bezier(0.34, 1.56, 0.64, 1)`. Focus-visible: `amber-400` ring offset 2 px from `amber-50`. Capturing: replace camera with spinning aperture (1.6 s linear). Capture-bloom overlay (radial white → transparent, 200 ms) fires on click (and again on success transition). Both animations are removed under `prefers-reduced-motion: reduce`.

**Polaroid preview card (T017):** white surface, `rounded-3xl`, `p-2` frame padding (`p-3` at `@container md`), `border border-stone-200/60`, `shadow-polaroid`. Image slot `aspect-[4/3] rounded-2xl overflow-hidden bg-stone-100 object-cover object-top`. Bottom ledge `px-3 py-2 mt-1 border-t border-stone-200/60 text-[11px] font-mono text-stone-600` with `{siteName}/{pageName}` left + `HH:mm` right, both truncated. Arrival motion `translate-y-2 opacity-0 → translate-y-0 opacity-100` 240 ms cubic-bezier(0.2, 0.9, 0.2, 1); reduced-motion = opacity only.

**Error card (T017):** same frame; image slot `bg-stone-50` with large icon (`AlertCircle` or `WifiOff` 32 px stroke 1.5, `text-rose-500`), title `text-sm font-medium text-rose-600`, subtitle `text-xs text-stone-600 text-center max-w-[28ch]`. Ledge shows the FR-12 hint in `text-[11px] italic text-stone-500` centered.

**Action pills (T018):** `h-10 rounded-full border border-stone-300 bg-white px-4 text-sm font-medium text-stone-900`. Hover `bg-amber-50 border-amber-300`. Focus-visible `ring-2 ring-amber-400 ring-offset-2 ring-offset-amber-50`. Pressed `bg-amber-100`. Success `bg-amber-50 border-amber-300 text-amber-700` with Check icon; Copy auto-reverts 1.8 s, Download 1.4 s. Disabled `opacity-50 cursor-not-allowed`. Copy `flex-none min-w-24`; Download/Retry `flex-1`. At `@container xs` (320 px) the action bar goes `flex-col` with full-width pills (Copy on top).

**Status line copy (verbatim — T019):**
- idle: title "Ready when you are.", hint "Shows the last saved version of this page."
- capturing / capturing-slow: title "Catching it…", same hint.
- ready: title "Got it.", same hint.
- error: title "Didn't quite catch that." (right curly `\u2019`), hint "We couldn't reach the page this time."

**Error-card per-code copy (T017 + T013):**
- `auth`: title "Authentication failed.", subtitle "Ask your administrator to check the app's credentials." (AC-5.1 / FR-13)
- `not_found`: title "We couldn't find that page.", subtitle "Save the page first, then try again." (AC-4.3 / AC-5.2)
- `upstream_unavailable`: title "Screenshot service is unavailable.", subtitle "Try again in a moment." (AC-5.3)
- `network`: title "You appear to be offline.", subtitle "Check your connection, then try again." (AC-5.4)
- `unknown`: title "Something went wrong.", subtitle "Try again in a moment." (fallback)

**Other copy:**
- Empty-preview placeholder (idle): "Tap Capture to catch this page."
- Clipboard-denied inline message: "Clipboard access was blocked. Use Download instead."
- Copy success label: "Copied" (reverts after 1.8 s). Download success label: "Saved" (reverts after 1.4 s).
- Shutter-label main: "Capture" / "Capturing…". Sub-line (≥ 5 s): "Still catching… {n} s".

**Error icon mapping (for T017a-TEST-3):**
- `network` → Lucide `WifiOff`, 32 px, stroke 1.5, `text-rose-500`
- `auth` / `not_found` / `upstream_unavailable` / `unknown` → Lucide `AlertCircle`, 32 px, stroke 1.5, `text-rose-500`

**Announcement catalogue (exact wording — for T023 and every a11y test):**
- On panel mount with valid pages.context → `"Ready to capture."`
- On `idle → capturing` (shutter press) → `"Capturing started."`
- Every second past 5 s while still capturing → `"Still capturing, N seconds."` (substitute integer `N`)
- On `capturing → ready` → `"Screenshot ready."`
- On successful Copy → `"Copied to clipboard."`
- On Download click → `"Download started."`
- On `capturing → error` → `"Capture failed: {title}. {subtitle}."` where `{title}` and `{subtitle}` come from the per-code copy above (e.g. "Capture failed: We couldn't find that page. Save the page first, then try again.")

**Keyboard & focus map (exact — for T024 and integration tests):**
- On panel mount (once pages.context has values) → focus Shutter.
- Tab order = DOM order (ensured by T019): Shutter → Copy → Download (in ready), or Shutter → Retry (in error). Disabled elements are skipped by native Tab.
- `Enter` or `Space` activates the focused `<button>` (native).
- `Escape` from anywhere inside `<PageshotPanel>` returns focus to Shutter.
- On `capturing → ready`: `copyButton.focus({ preventScroll: true })`.
- On `capturing → error`: `retryButton.focus({ preventScroll: true })`.
- On re-capture press from `ready`: focus stays on Shutter through `capturing`, returns to Copy on `ready`.

**PNG magic bytes (for T020a-TEST-1 assertion):** `\x89 P N G \r \n \x1A \n` — hex `89 50 4E 47 0D 0A 1A 0A`. Any test that asserts the clipboard blob content is a PNG checks the first 8 bytes.

**Filename helper contract (for T021a tests):**
- Signature: `buildScreenshotFilename(siteName: string, pageName: string, capturedAt: Date): string`.
- Steps: (1) concatenate site and page into two slugs each passed through `toLowerCase()`; (2) replace every run of non-`[a-z0-9_-]` bytes with a single `-`; (3) trim leading/trailing `-`; (4) assemble `${siteSlug}_${pageSlug}_${YYYYMMDD}-${HHmm}.png` using **local** time (the user's machine, per AC-3.4 — NOT UTC); (5) if total length > 100, proportionally truncate `siteSlug` and `pageSlug` (preserve at least 1 char each) so the final string is ≤ 100 chars and `.png` + timestamp are never dropped.
- Collision handling at minute granularity is out of scope — identical calls produce identical strings (documented in T021a-TEST-6).

**Accessibility (T023 + T024):**
- WCAG 2.1 AA. Contrast verified in spec § 4.5 — use `text-rose-600` for error titles (5.7:1) NOT `text-rose-500`.
- All interactive elements are `<button>` (no div-as-button).
- Shutter `aria-label="Capture screenshot"`; `aria-busy="true"` + `aria-label="Capturing screenshot"` while capturing.
- Single sr-only `<div role="status" aria-live="polite">` receives all announcements — wording per T023.
- `:focus-visible` never suppressed.
- Keyboard map: Tab order Shutter → Copy → Download (or Retry), Enter/Space activate, Esc returns focus to Shutter. Focus auto-moves to Copy on ready, to Retry on error.
- `prefers-reduced-motion: reduce` — no scale spring, no bloom, no slide-up; opacity-only transitions.
- Polaroid image: `<img alt="Screenshot of page {pageName} on {siteName}, captured {capturedAt}">`.

**Container queries (T004):** use Tailwind v4 `@container` queries on `<PanelRoot>`: `xs` (320 px, stacked pills, `px-4`, ledge 10 px), `sm` (360 px default, `px-5`), `md` (400 px+, `px-6`, looser vertical rhythm, label 14 px).

**Winning POC clickdummy:** `products/pageshot/pocs/poc-v2/index.html` — Developer may open this file directly in a browser during implementation. When spec text and POC diverge visually, the POC wins (per design spec § 7). The POC uses Inter + JetBrains Mono; the spec (authoritative on fonts) specifies Geist Sans + Geist Mono — use Geist per T005.

### 4c-5. File / module structure and naming conventions

Root of the app: `products/pageshot/site/next-app/` (below, all paths are relative to this root).

```
app/
  layout.tsx                              # scaffolded — wraps MarketplaceProvider
  page.tsx                                # scaffolded landing page (untouched or minimal)
  panel/
    page.tsx                              # T008 — the Page Context Panel surface
  api/
    screenshot/
      [pageId]/
        route.ts                          # T011 — Node-runtime proxy
        route.test.ts                     # T012
components/
  providers/
    marketplace.tsx                       # scaffolded; extended in T007
    marketplace.test.tsx                  # T009
  PageshotPanel.tsx                       # T013
  Shutter.tsx                             # T014
  ShutterLabel.tsx                        # T015
  PolaroidCard.tsx                        # T017
  ActionPill.tsx                          # T018
  InlineMessage.tsx                       # T022
  LiveRegion.tsx                          # T023
  PageshotPanel.test.tsx                  # T025
  Shutter.test.tsx                        # T025
  ActionPill.test.tsx                     # T025
lib/
  sitecore-token.ts                       # T010
  sitecore-token.test.ts                  # T010/T012
  filename.ts                             # T021 — buildScreenshotFilename helper
  filename.test.ts                        # T021/T025
next.config.mjs                           # T003 — PNA headers
tailwind.config.ts                        # T004 — tokens
.env.local                                # T006 — gitignored
.env.example                              # T006
```

**Naming:** React components `PascalCase.tsx`. Non-React modules `kebab-case.ts`. Test files co-located, `*.test.ts` / `*.test.tsx`. No `src/` directory (Next 16 quickstart does not use one).

**Client/server boundary:** every file under `components/` and `app/panel/` starts with `'use client'`. Only `app/api/**` and `lib/sitecore-token.ts` touch the Node-only runtime / env vars.

### 4c-6. Integration and API contract notes

**Marketplace SDK — init (from `client.md § 2`):**
```ts
'use client';
import { ClientSDK } from '@sitecore-marketplace-sdk/client';
import { XMC } from '@sitecore-marketplace-sdk/xmc';
const client = await ClientSDK.init({ target: window.parent, modules: [XMC] });
```
The scaffold ships a React Context Provider (`components/providers/marketplace.tsx`) that does this inside `useEffect`. Call `.init()` exactly once per app lifetime; call `client.destroy()` on unmount.

**Marketplace SDK — `pages.context` subscription (PATH A — `client.md § 6a`):**
```ts
const res = await client.query('pages.context', {
  subscribe: true,
  onSuccess: (data) => { /* fires on initial resolve AND every subsequent update */ },
  onError: (err) => console.error('[pageshot][pages.context] error', err),
});
const teardown = res.unsubscribe;  // optional; only present because subscribe:true
useEffect(() => () => teardown?.(), [teardown]);
```
`PagesContext` shape (unwrap once via `.data` — base-map query, not module query):
```ts
interface PagesContext {
  siteInfo?: { id?: string; name?: string; displayName?: string; language?: string; supportedLanguages?: string[]; ... };
  pageInfo?: { id?: string; name?: string; displayName?: string; path?: string; url?: string; ... };
}
```
Extract `pageId = pageInfo?.id`, `siteName = siteInfo?.name`, `pageName = pageInfo?.name`. All are `string | undefined` — guard before use (no `as string` casts). Do NOT use `client.subscribe('pages.context', …)` — wrong path (B); `pages.context` is in `QueryMap`, not `SubscribeMap`; typecheck will fail.

**SitecoreAI OAuth (from `auth.md § 5`):**
```
POST https://auth.sitecorecloud.io/oauth/token
Content-Type: application/x-www-form-urlencoded
Body: client_id={ID}&client_secret={SECRET}&grant_type=client_credentials&audience=https://api.sitecorecloud.io
```
Response `{ access_token, token_type: 'Bearer', expires_in: 86400 }`. Token lifetime 24 h. **60 s safety margin** in cache. Audience is literal — do NOT substitute the Agent API base URL. Token endpoint reference implementation: copy verbatim from `auth.md § 5` into `lib/sitecore-token.ts`.

**Credential-acquisition protocol (from `auth.md § 0`)** — **before first real API call** the Developer asks the user, in one question:
> "PageShot will call the SitecoreAI Agent API. To authenticate I need a `client_id` and `client_secret` from an Automation Client in Cloud Portal. Options: **(a)** paste them now, **(b)** I don't have them — use whatever is in `.env.local` / `.env`, **(c)** leave blank, I'll provide them later."
(a) → write into `products/pageshot/site/next-app/.env.local`; never echo the secret. (b) → read `.env.local` → repo root `.env`; use first non-empty. (c) or (b)-with-nothing → leave blank and **report as missing** in the final summary. Never invent placeholders.

**SitecoreAI Agent API — screenshot (from `agent-api.md § Pages`):**
```
GET https://edge-platform.sitecorecloud.io/stream/ai-agent-api/api/v1/pages/{pageId}/screenshot
Authorization: Bearer <access_token>
Accept: application/json
```
Response body contains a base64-encoded PNG. The route handler repackages into the server-route envelope below.

**Server-route response envelope (from PRD § 10 — exact type):**
```ts
type ScreenshotResponse =
  | { ok: true; image: string }  // base64 PNG, no data-URL prefix
  | { ok: false; error: { code: "auth" | "not_found" | "upstream_unavailable" | "network" | "unknown"; message: string } };
```

**Error code mapping (FR-07 + AC-5.*):**
- Upstream `401` → `invalidateSitecoreToken()` → retry once → if still 401 → `{ code: 'auth' }`.
- Upstream `404` → `{ code: 'not_found' }`.
- Upstream `5xx` or read timeout → `{ code: 'upstream_unavailable' }`.
- `fetch` rejection (network down, DNS) → `{ code: 'network' }`.
- `navigator.onLine === false` on the client → `{ code: 'network' }` produced client-side before issuing fetch (AC-5.4).
- Missing env vars server-side → `{ code: 'auth' }`, HTTP 500, message "Administrator must configure credentials." (FR-13).
- Anything else → `{ code: 'unknown' }`.

**Panel-state type (from PRD § 10):**
```ts
type PanelState =
  | { kind: "idle" }
  | { kind: "capturing"; startedAt: number; elapsedSeconds?: number }
  | { kind: "ready"; imageBase64: string; siteName: string; pageName: string; capturedAt: Date }
  | { kind: "error"; code: "auth"|"not_found"|"upstream_unavailable"|"network"|"unknown"; message: string };
```

**Clipboard write (FR-08):**
```ts
const bytes = Uint8Array.from(atob(image), c => c.charCodeAt(0));
const blob = new Blob([bytes], { type: 'image/png' });
await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
```
On reject (`NotAllowedError` or `TypeError` when `ClipboardItem`/`clipboard.write` undefined): shake Copy pill, disable it, show InlineMessage, keep Download enabled.

**Download filename (FR-09 / AC-3.2–3.4):** `{siteName}_{pageName}_{YYYYMMDD}-{HHmm}.png`. Lowercase, non-`[a-z0-9-_]` → `-`, collapse runs of `-`, local time, truncate overall to ≤ 100 chars preserving `.png`.

### 4c-7. Parity / rebuild pointers

N/A — greenfield. There is no prior PageShot implementation, no legacy asset bundle, no content dump to mirror. `source.analysis_mode` is not `rebuild`.

---

## 5. Dependencies

### Ordering constraints (test-first — QA-enriched)

- T001 must run first — nothing else compiles without the scaffold.
- T002 unblocks every subsequent task; test stack + lint clean is a prerequisite for every `*a` RED task.
- T004 and T005 (Tailwind tokens + fonts) are prerequisites for UI component RED tests and implementations.
- **RED tasks precede GREEN tasks:** T007a → T007b, T010a → T010b, T011a → T011b, T013a → T013b, T014a → T014b, T016a → T016b, T017a → T017b, T018a → T018b, T020a → T020b, T021a → T021b, T022a → T022b, T023a → T023b, T024a → T024b. **Never implement without a failing test committed first.**
- T007b (Provider + `pages.context`) must precede T008 (panel route).
- T010b (token cache) must precede T011a (route-handler tests can only be written once the imports resolve), which precedes T011b.
- T011b must precede T013a (the state-machine tests mock the route envelope shape).
- T014b/T015/T016b form a mini-chain: Shutter → ShutterLabel → ElapsedController (all gated by their `a` tests).
- T017b, T018b, T022b, T023b are independent UI components — their RED tests (T017a/T018a/T022a/T023a) can all run in parallel once T004 is done.
- T019 (layout assembly) consumes T014b, T015, T017b, T018b, T022b, T023b.
- T020b (copy) depends on T017b + T018b + T022b; T021b (download) depends on T017b + T018b.
- T024b (keyboard map) consumes T019 (focus order = DOM order).
- T025 (integration tests) is the last E4 task — depends on every GREEN component + T024b being in place.
- T026 (Vercel preview) depends on T025 — we deploy only green code.
- T027 → T028 → T029 → T030 are strictly sequential in E5/E6.
- **T009 and T012 are REMOVED** — their coverage is in T007a and T011a respectively; do not resurrect.

### Execution order (all Task IDs in valid dependency order)

```
T001, T002, T003, T004, T005, T006,
T007a, T007b, T008,
T010a, T010b, T011a, T011b,
T013a, T013b,
T014a, T014b, T015,
T016a, T016b,
T017a, T017b,
T018a, T018b,
T022a, T022b,
T019,
T023a, T023b,
T020a, T020b,
T021a, T021b,
T024a, T024b,
T025,
T026, T027, T028, T029, T030
```

### Parallel groups

```
Group 1 (sequential — scaffold foundation):   T001 → T002
Group 2 (parallel — all depend on T002):      T003, T004, T005, T006, T007a, T010a
Group 3 (sequential — SDK wiring):            T007a → T007b → T008 (T008 also depends on T005)
Group 4 (sequential — token cache):           T010a → T010b
Group 5 (sequential — route handler):         T011a (depends on T010b) → T011b
Group 6 (sequential — state machine):         T013a (depends on T008 + T011b) → T013b
Group 7 (parallel — depends on T013b + tokens + relevant a-tests):
  - Shutter chain:        T014a → T014b → T015 → T016a → T016b
  - Polaroid:             T017a → T017b
  - ActionPill:           T018a → T018b     (depends on T004 only — can run earlier)
  - InlineMessage:        T022a → T022b     (depends on T004 only — can run earlier)
Group 8 (sequential — layout join):           T019 (depends on T014b, T015, T017b, T018b, T022b)
Group 9 (sequential — LiveRegion):            T023a → T023b (T023b also depends on T019)
Group 10 (parallel — consumes T017b + T018b + InlineMessage):
  - Copy chain:           T020a → T020b
  - Download chain:       T021a → T021b
Group 11 (sequential — keyboard + integration):   T024a → T024b → T025
Group 12 (sequential — deploy + register):    T026 → T027 → T028 → T029 → T030
```

The Team Lead may spawn a second Developer to parallelize the RED tasks whose dependencies are satisfied (e.g. T018a and T022a can start as soon as T004 is green, concurrent with T013a/T014a work). Under no circumstances may a GREEN task begin before its RED task is committed and failing.

---

## 6. Suggested Milestones

- **M1 — Scaffold + skeletons (end of T008):** Marketplace Client-Side scaffold green, PNA headers in place, Tailwind/fonts wired, `.env.local` handled, `MarketplaceProvider` + `pages.context` subscription tested (T007a/b green), `/panel` route renders.
- **M2 — Capture round-trip works (end of T013b):** `/api/screenshot/[pageId]` handler returns base64 image or typed error envelope (T011a/b green); panel state machine transitions idle → capturing → ready/error end-to-end with a real (or mocked) upstream (T013a/b green).
- **M3 — Shutterbug UI complete (end of T025):** All visual components match POC v2; copy/download/retry/clipboard-denied all work; keyboard map + a11y complete; all RED tests turned GREEN and the integration tests (T025) green.
- **M4 — Deployed, registered, dogfood logged (end of T030):** Vercel preview + production deployed; test + production custom apps registered in Cloud Portal; happy path + error paths smoke-tested in the real editor; run + any friction logged to the Marketplace CATALOG.

---

## 7. Risk Areas

- **R-1 — Agent API latency > 10 s** (PRD R-1). Mitigated by the elapsed-time counter (T016b) that visibly ticks past 5 s. Tests T016a + T025 guard the UX.
- **R-2 — OAuth client-credentials setup fails** (wrong scopes, wrong audience, role issue — PRD R-2). Mitigated by the credential-acquisition protocol at T006 and the `auth` error envelope (FR-13 / T011b). The first 401 after Vercel deploy is the likely stumble.
- **R-3 — Clipboard write denied** (PRD R-3). Fully covered by T020a's denial tests + T025 integration test.
- **R-5 — Unsaved-draft confusion** (PRD R-5). Mitigated by the always-visible FR-12 hint (T019) and the 404 error message (T017b). Regression-guarded by T025-TEST-6.
- **R-6 — Vercel env-var misconfig** (PRD R-6). Mitigated by having two distinct custom apps (test + production) in separate scopes (T027/T028) and by logging the tenant identifier (not the secret) on first successful auth (T011b, asserted in T011a-TEST-10).
- **R-7 — Dogfood first-run surfaces skill gaps** (PRD R-7 — **high likelihood, expected**). That is the purpose of T030 — any friction becomes a patch-queue entry, not a blocker.
- **New at task level:** Chrome Local Network Access enforcement — if T003 is missed, the iframe from the portal will silently fail to load `localhost:3000`. Already covered by T003 + E4 local iteration.
- **New at task level:** Geist font vs. POC's Inter font — visual tie-breaks must not be done with Inter; T005 replaces it with Geist before T019.

---

## 8. Suggested Team Structure

**Primary path: one Developer agent.** This is a small app (~30 tasks, one route handler, ~8 React components) and sequential state between scaffold → SDK wiring → state machine is unavoidable. A single Developer stays in context and delivers M1 → M4 in order.

**Where parallelism helps (Team Lead may spawn a second Developer):**
- **Group 2** (T003/T004/T005/T006/T010) — five independent foundation tasks. A second Developer can own Tailwind tokens + fonts (T004/T005) while the first handles PNA headers + env + token cache (T003/T006/T010).
- **Group 7** — Shutter chain (T014a/b → T015 → T016a/b) and Polaroid/Pill/InlineMessage (T017a/b, T018a/b, T022a/b) are visually independent. Two Developers can parallelize.
- **RED tasks in parallel** — the `*a` test-writing tasks can often run in parallel across components because they only touch test files. A second Developer can burn through RED tasks while the first is completing GREEN on another component.

**Hand-offs:** T025 (integration tests) naturally gates Vercel deploy (T026); T029 (smoke test) naturally gates the catalog log (T030). No multi-person hand-off risk.

---

## 9. TDD and quality contract

### 9.1 Mandate — RED → GREEN → REFACTOR

Every code-producing task in this plan follows **Test-Driven Development**:

1. **RED.** Before any production code exists for a behavior, a failing test for that behavior must be written, committed, and visible in `npm run test` output as failing. The RED state is recorded in git history — tests and implementation land in separate commits.
2. **GREEN.** Implementation writes the minimum code needed to make the RED tests pass. No additional behavior, no speculative generalization.
3. **REFACTOR.** Once GREEN, code may be restructured for clarity — but the test suite must remain green at every step.

**Non-negotiable rule:** No production code may be merged for a behavior before a failing test for that behavior is committed. This rule is encoded in the `*a` / `*b` task split in § 4: every `*a` task is a RED commit; every `*b` task is the GREEN commit that makes `*a` pass. The Developer may **not** begin a `*b` task before the matching `*a` is complete.

The Team Lead / agent orchestrator must enforce this by verifying the `*a` task's status before dispatching `*b`. If the Developer finds additional behavior during GREEN that needs a test, they add it as a new RED commit first, then extend GREEN.

### 9.2 Test layers in PageShot

| Layer | What it covers | Tools | Where tests live |
|---|---|---|---|
| **Unit** | Pure functions: token-cache logic, filename sanitization, state-machine reducer transitions, error-code mapping | Vitest (Node env or jsdom) | `lib/**/*.test.ts`, `components/use-panel-state.test.ts` |
| **Integration (route handler)** | `/api/screenshot/[pageId]` behavior — auth, 401 retry, error envelope, NFR-S-01 secret containment — mocking at the `fetch` boundary | Vitest + mocked `global.fetch` | `app/api/screenshot/[pageId]/route.test.ts` |
| **UI / component** | Panel states (idle / capturing / ready / error), button enable/disable, ARIA live announcements, keyboard operability, focus management, reduced-motion | Vitest + `@testing-library/react` + `@testing-library/jest-dom` + jsdom + `vi.useFakeTimers()` | `components/**/*.test.tsx`, `components/PageshotPanel.integration.test.tsx` |
| **E2E (Playwright)** | **Optional for v1 — OUT of scope.** No Playwright in this plan. The single happy-path browser smoke-test (panel loads → click shutter → mock server returns base64 → preview renders → Copy + Download fire) is covered by the manual real-portal run in T029. If a future run wants automation, a Playwright spec at `e2e/screenshot.spec.ts` is the suggested shape — track as a nice-to-have, not a blocker. |

### 9.3 Tasks that are exempt from TDD (explicit non-code list)

The following tasks are **non-code / scaffold-only / config-only / manual** — they do not produce behavior that can fail a unit test, and they are not split into `*a` / `*b`:

| Task | Nature | Why exempt |
|---|---|---|
| T001 | Scaffold invocation | Runs a codegen tool; produces files, no behavior of our own |
| T002 | Lint + test-stack install + npm scripts | Config patch; green `npm run build/lint/typecheck/test` is the verification |
| T003 | `next.config.mjs` headers | Config; verified by a lightweight assertion test (T003-TEST-1) |
| T004 | `tailwind.config.ts` token extension | Config; verified by a compile check (T004-TEST-1) |
| T005 | Font wiring | Config; visual smoke only |
| T006 | `.env.local` stub + credential-acquisition protocol | Operational protocol; no code under test |
| T008 | `/panel` route file that mounts `<PageshotPanel>` | Pure composition; tested transitively through T013a/b + T025 |
| T015 | `<ShutterLabel>` component | Tested inside T014 and T016 suites |
| T019 | Layout assembly | Tested transitively through T025 integration tests |
| T026–T030 | Deploy / register / smoke / catalog | Manual; tracked by checklists, not by Vitest |

Every other task has a paired `*a` (RED) task whose test specs are listed in § 10.

### 9.4 Coverage contract

- **Every PRD § 6 acceptance criterion** (AC-1.1 through AC-5.5) has at least one automated test in § 10 — coverage statement is at the bottom of § 10.
- **Every PRD § 7 functional requirement** (FR-01 through FR-13) has at least one automated test in § 10.
- **Every NFR that can be verified in code** (NFR-P-02 click feedback, NFR-S-01 secret containment, NFR-S-02 token cache, NFR-A-01 accessibility, NFR-Br-01 clipboard fallback) is covered. NFR-P-01 wall-clock and NFR-Co-01 iframe compatibility are **manual** (T029 smoke).
- **"Meaningful tests only."** No `expect(true).toBe(true)`-class placeholders. Every test in § 10 asserts behavior tied to an AC, FR, NFR, ADR boundary, or an explicit § 4c-1 rule. Tests that do not assert behavior are not allowed.

### 9.5 Test fixtures

Fixtures the Developer will need are listed in § 11. Use those stable names — tests reference them by path, not by inline literals, so that adding a new scenario (e.g. "401-then-403") is a fixture change not a test change.

---

## 10. Per-task test specifications

All scenarios below are **behavioral** — each one asserts an observable, externally-verifiable property derived from a PRD AC, FR, NFR, ADR boundary, or § 4c-1 rule. File locations are relative to `products/pageshot/site/next-app/`. Test IDs follow the pattern `{TaskID}-TEST-{n}` so a single scenario can be re-run, referenced from a task description, or reopened as a regression in the ship report.

---

### § 10 — E1 Scaffold & project skeleton

#### T003-TEST-1 — PNA headers present in dev
- **Scenario:** A GET request to any path in dev mode returns all four Chrome PNA headers.
- **Expected:** Response headers include `Access-Control-Allow-Private-Network: true`, `Access-Control-Allow-Origin: *`, `Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS`, `Access-Control-Allow-Headers: Content-Type, Authorization, Access-Control-Request-Private-Network`. `Access-Control-Allow-Credentials` is NOT set to `true`.
- **Test type:** integration (Vitest + Next route fetch, or a smoke test of the `next.config.mjs` `headers()` output)
- **File:** `next.config.test.ts` (or inline smoke in `app/panel/panel.smoke.test.ts`)

#### T004-TEST-1 — Tailwind tokens compile
- **Scenario:** A test component that uses `shadow-shutter`, `shadow-polaroid`, `animate-shutter-bloom`, `animate-shutter-press`, `animate-shake` renders without missing-class warnings and produces non-empty computed CSS values.
- **Expected:** `getComputedStyle(el).boxShadow !== 'none'` for shadow utilities; `animation-name` non-empty for animation utilities.
- **Test type:** UI (Vitest + jsdom + Testing Library)
- **File:** `app/panel/panel.smoke.test.tsx` (or `tailwind.tokens.test.tsx`)

---

### § 10 — E2 Marketplace SDK integration

#### T007a-TEST-1 — `ClientSDK.init` called once with correct arguments
- **Scenario:** Mount `MarketplaceProvider`. Inspect the stubbed `ClientSDK.init`.
- **Expected:** `init` called exactly once with `{ target: window.parent, modules: [XMC] }`. Remounting under `StrictMode` still produces exactly one init (idempotent).
- **Test type:** unit
- **File:** `components/providers/marketplace.test.tsx`

#### T007a-TEST-2 — `pages.context` subscribed via PATH A
- **Scenario:** After init resolves, `client.query('pages.context', { subscribe: true, onSuccess })` is invoked. `client.subscribe('pages.context', …)` is NOT invoked (typecheck regression guard).
- **Expected:** Single call to `client.query` with the correct key and `subscribe: true` option; `onSuccess` and `onError` callbacks present.
- **Test type:** unit
- **File:** `components/providers/marketplace.test.tsx`

#### T007a-TEST-3 — Unmount tears down subscription AND calls `client.destroy()`
- **Scenario:** Unmount the Provider.
- **Expected:** The `unsubscribe` returned by `client.query` is invoked exactly once; `client.destroy()` is invoked exactly once. No leaked listeners.
- **Test type:** unit
- **File:** `components/providers/marketplace.test.tsx`

#### T007a-TEST-4 — `usePagesContext()` returns null, then live values
- **Scenario:** Before `onSuccess` fires, `usePagesContext()` returns `null`. After `onSuccess` fires with a canned `PagesContext` shape `{ pageInfo: { id: 'p1', name: 'Home' }, siteInfo: { name: 'acme' } }`, `usePagesContext()` returns `{ pageId: 'p1', siteName: 'acme', pageName: 'Home' }`.
- **Expected:** Hook return transitions null → populated object matching the extracted fields.
- **Test type:** unit
- **File:** `components/providers/marketplace.test.tsx`

---

### § 10 — E3 Server-side OAuth proxy

#### T010a-TEST-1 — Token fetch POSTs the correct form-encoded body
- **Scenario:** First call to `getSitecoreToken()` with mocked `fetch`.
- **Expected:** Exactly one `fetch` to `https://auth.sitecorecloud.io/oauth/token` with method POST, `Content-Type: application/x-www-form-urlencoded`, and body containing `client_id={id}&client_secret={secret}&grant_type=client_credentials&audience=https://api.sitecorecloud.io`. Returned string equals `mockResponse.access_token`.
- **Test type:** unit
- **File:** `lib/sitecore-token.test.ts`

#### T010a-TEST-2 — Token cache reuse within TTL
- **Scenario:** Call `getSitecoreToken()` twice in rapid succession when the first response has `expires_in: 86400`.
- **Expected:** Exactly ONE POST to `/oauth/token`. Both calls return the same token string. (NFR-S-02 safety margin respected.)
- **Test type:** unit
- **File:** `lib/sitecore-token.test.ts`

#### T010a-TEST-3 — Token refresh at 60 s margin
- **Scenario:** Seed the cache with an expiry 59 seconds in the future (i.e. within the 60 s safety margin). Call `getSitecoreToken()`.
- **Expected:** A fresh POST to `/oauth/token` is issued. The old token is discarded.
- **Test type:** unit (uses `vi.useFakeTimers()` or explicit `Date.now()` mock)
- **File:** `lib/sitecore-token.test.ts`

#### T010a-TEST-4 — `invalidateSitecoreToken()` wipes the cache
- **Scenario:** Get a token, call `invalidateSitecoreToken()`, then call `getSitecoreToken()` again.
- **Expected:** A fresh POST to `/oauth/token` is issued on the second call despite being within TTL.
- **Test type:** unit
- **File:** `lib/sitecore-token.test.ts`

#### T010a-TEST-5 — Non-2xx from auth endpoint throws
- **Scenario:** Mock `fetch` to return HTTP 400 with an OAuth error body.
- **Expected:** `getSitecoreToken()` rejects. The error message does NOT include the request body (no `client_secret` in the thrown error).
- **Test type:** unit
- **File:** `lib/sitecore-token.test.ts`

#### T010a-TEST-6 — Concurrent callers share one in-flight request
- **Scenario:** Call `getSitecoreToken()` three times synchronously before the first resolves.
- **Expected:** Exactly ONE `fetch` to `/oauth/token` (stampede protection — per `auth.md § 5` pattern). All three callers receive the same token.
- **Test type:** unit
- **File:** `lib/sitecore-token.test.ts`

#### T011a-TEST-1 — Happy path: 200 upstream → `{ ok: true, image }`
- **Scenario:** Upstream Agent API returns HTTP 200 with `{ image: '<base64>' }`.
- **Expected:** Route returns HTTP 200 with body `{ ok: true, image: '<base64>' }`. Exactly one upstream call. Server log contains a structured entry with `{ event: 'screenshot.ok', pageId, status: 200, latencyMs }`.
- **Test type:** integration (route handler)
- **File:** `app/api/screenshot/[pageId]/route.test.ts`

#### T011a-TEST-2 — 401-once retry succeeds
- **Scenario:** First upstream call returns 401. `invalidateSitecoreToken` is invoked. Second upstream call returns 200.
- **Expected:** Final response `{ ok: true, image: … }` with HTTP 200. Exactly 2 upstream calls (no infinite loop). `invalidateSitecoreToken` called exactly once. (FR-06, AC-5.1 happy subtree.)
- **Test type:** integration
- **File:** `app/api/screenshot/[pageId]/route.test.ts`

#### T011a-TEST-3 — Double 401: envelope `{ code: 'auth' }`, exactly 2 upstream calls
- **Scenario:** Both upstream calls return 401.
- **Expected:** Response body `{ ok: false, error: { code: 'auth', message: <admin-message> } }`. Message wording matches § 4c-4 `auth` subtitle. Exactly 2 upstream calls (no third try).
- **Test type:** integration
- **File:** `app/api/screenshot/[pageId]/route.test.ts`

#### T011a-TEST-4 — 404 upstream → `{ code: 'not_found' }`
- **Scenario:** Upstream returns HTTP 404.
- **Expected:** Response body `{ ok: false, error: { code: 'not_found', message: <save-first-message> } }`. Message wording matches § 4c-4 `not_found` subtitle (AC-4.3 / AC-5.2).
- **Test type:** integration
- **File:** `app/api/screenshot/[pageId]/route.test.ts`

#### T011a-TEST-5 — 5xx upstream → `{ code: 'upstream_unavailable' }`
- **Scenario:** Upstream returns HTTP 502 (and 503 and 500 in a table-driven variant).
- **Expected:** Response body `{ ok: false, error: { code: 'upstream_unavailable', message: <try-again-message> } }` (AC-5.3).
- **Test type:** integration
- **File:** `app/api/screenshot/[pageId]/route.test.ts`

#### T011a-TEST-6 — fetch rejection → `{ code: 'network' }`
- **Scenario:** Mocked `fetch` throws `TypeError('Failed to fetch')`.
- **Expected:** Response body `{ ok: false, error: { code: 'network', … } }` (AC-5.4 server-side arm).
- **Test type:** integration
- **File:** `app/api/screenshot/[pageId]/route.test.ts`

#### T011a-TEST-7 — Missing env vars → `{ code: 'auth' }` without hitting auth endpoint
- **Scenario:** `SITECORE_CLIENT_ID` is blank at route invocation.
- **Expected:** Response body `{ ok: false, error: { code: 'auth', message: 'Administrator must configure credentials.' } }` with HTTP 500. `fetch` is NOT called (no request to `/oauth/token` or the Agent API). (FR-13 / R-6.)
- **Test type:** integration
- **File:** `app/api/screenshot/[pageId]/route.test.ts`

#### T011a-TEST-8 — Empty / malformed pageId → HTTP 400 + `not_found`
- **Scenario:** Call route with `params.pageId = ''` (and a second case with `'   '`).
- **Expected:** Response HTTP 400, body `{ ok: false, error: { code: 'not_found', … } }`. No upstream call.
- **Test type:** integration
- **File:** `app/api/screenshot/[pageId]/route.test.ts`

#### T011a-TEST-9 — NFR-S-01 secret never appears in route response
- **Scenario:** Given any of the above scenarios, serialize the response body to a string.
- **Expected:** The serialized body does NOT contain the substring `client_secret`, does NOT contain the literal value of `SITECORE_CLIENT_SECRET` (set via test env), and does NOT contain any access token. Applies to both success and error paths.
- **Test type:** integration (assert across all scenarios, table-driven)
- **File:** `app/api/screenshot/[pageId]/route.test.ts` (+ optional ESLint rule `no-restricted-syntax` preventing client-side import of `process.env.SITECORE_CLIENT_SECRET` — build-time guard)

#### T011a-TEST-10 — Tenant identifier logged on first success, never the secret
- **Scenario:** Golden path + observe `console.log` / structured logger calls.
- **Expected:** Log entries contain `{ event, pageId, status, latencyMs }` and, once per process, a `{ event: 'auth.tenantId', tenantId }` entry. NO log entry contains the substring `client_secret` or the secret's literal value or the bearer token. (NFR-O-01 / R-6.)
- **Test type:** integration
- **File:** `app/api/screenshot/[pageId]/route.test.ts`

---

### § 10 — E4 Panel UI — Shutterbug direction

#### T013a-TEST-1 — idle → capturing records `startedAt`
- **Scenario:** Reducer `(state={kind:'idle'}, {type:'capture', startedAt:123}) => next`.
- **Expected:** `next = { kind: 'capturing', startedAt: 123 }`.
- **Test type:** unit
- **File:** `components/use-panel-state.test.ts`

#### T013a-TEST-2 — capturing → ready with image payload
- **Scenario:** `(capturingState, { type: 'resolved', image, siteName, pageName, capturedAt })`.
- **Expected:** `{ kind: 'ready', imageBase64, siteName, pageName, capturedAt }`. `startedAt` removed.
- **Test type:** unit
- **File:** `components/use-panel-state.test.ts`

#### T013a-TEST-3 — capturing → error copies `code` + `message` verbatim
- **Scenario:** `(capturingState, { type: 'failed', code: 'not_found', message: 'Save it first' })`.
- **Expected:** `{ kind: 'error', code: 'not_found', message: 'Save it first' }` (literal — no rewriting).
- **Test type:** unit
- **File:** `components/use-panel-state.test.ts`

#### T013a-TEST-4 — ready → capturing replaces previous image (FR-11)
- **Scenario:** Start from `{ kind: 'ready', imageBase64: 'A', … }`. Dispatch `capture`.
- **Expected:** `{ kind: 'capturing', startedAt: … }`. Previous `imageBase64` is gone from state.
- **Test type:** unit
- **File:** `components/use-panel-state.test.ts`

#### T013a-TEST-5 — error → capturing on Retry
- **Scenario:** Dispatch `capture` from error state.
- **Expected:** Transitions to `{ kind: 'capturing', startedAt: … }`.
- **Test type:** unit
- **File:** `components/use-panel-state.test.ts`

#### T013a-TEST-6 — Invalid transitions are no-ops
- **Scenario:** Dispatch `resolved` from `idle` or `error`.
- **Expected:** State returns unchanged (or an impossible-transition assertion fires in dev). No crash.
- **Test type:** unit
- **File:** `components/use-panel-state.test.ts`

#### T014a-TEST-1 — Shutter renders default idle state with correct ARIA
- **Scenario:** Render `<Shutter state="idle" onPress={noop} />`.
- **Expected:** A `<button>` with `aria-label="Capture screenshot"`, NOT `aria-busy`, classes include `rounded-full` + amber palette intent. Contains Lucide `Camera` icon SVG.
- **Test type:** UI
- **File:** `components/Shutter.test.tsx`

#### T014a-TEST-2 — Capturing state flips `aria-busy` and label
- **Scenario:** Re-render with `state="capturing"`.
- **Expected:** `aria-busy="true"`, `aria-label="Capturing screenshot"`, camera icon replaced with an aperture-spinner element.
- **Test type:** UI
- **File:** `components/Shutter.test.tsx`

#### T014a-TEST-3 — Enter and Space activate the button
- **Scenario:** Focus the Shutter, fire `keydown` Enter (then Space in a second case).
- **Expected:** `onPress` invoked exactly once per keystroke. (Native `<button>` — this is a regression guard that no custom handler is preventing default.)
- **Test type:** UI
- **File:** `components/Shutter.test.tsx`

#### T014a-TEST-4 — Visible focus ring under `:focus-visible`
- **Scenario:** Tab-focus the Shutter.
- **Expected:** Computed style has a non-zero `outline` or a `ring` class is applied (assert the class list). Never suppressed by an `outline: none` rule anywhere in the cascade.
- **Test type:** UI
- **File:** `components/Shutter.test.tsx`

#### T014a-TEST-5 — Disabled state swallows clicks
- **Scenario:** Render with `state="disabled"`. Click.
- **Expected:** `onPress` NOT called. Button has `disabled` attribute or `aria-disabled="true"`.
- **Test type:** UI
- **File:** `components/Shutter.test.tsx`

#### T014a-TEST-6 — `prefers-reduced-motion: reduce` collapses scale + bloom
- **Scenario:** Set `window.matchMedia('(prefers-reduced-motion: reduce)').matches = true`. Render and click Shutter.
- **Expected:** The `shutter-press` keyframe animation and the bloom overlay are absent (or inert). An 80 ms opacity dip is acceptable per § 4c-4.
- **Test type:** UI
- **File:** `components/Shutter.test.tsx`

#### T016a-TEST-1 — Counter does NOT appear before 5 s
- **Scenario:** With `vi.useFakeTimers()`, press Shutter, advance 4000 ms.
- **Expected:** The "Still catching…" sub-line is NOT in the DOM. LiveRegion has NOT received an "Still capturing" announcement.
- **Test type:** UI (timing)
- **File:** `components/use-elapsed.test.ts` (or inside `PageshotPanel.integration.test.tsx`)

#### T016a-TEST-2 — Counter appears at exactly 5 s
- **Scenario:** Advance to 5000 ms.
- **Expected:** Sub-line `"Still catching… 5 s"` visible. LiveRegion announces "Still capturing, 5 seconds."
- **Test type:** UI (timing)
- **File:** `components/use-elapsed.test.ts`

#### T016a-TEST-3 — Counter increments every second past 5 s
- **Scenario:** Advance to 6000, 7000, 8000 ms.
- **Expected:** Sub-line updates to "6 s", "7 s", "8 s". LiveRegion announcement fires each time.
- **Test type:** UI (timing)
- **File:** `components/use-elapsed.test.ts`

#### T016a-TEST-4 — Interval cleared on any transition out of capturing
- **Scenario:** Enter capturing, advance to 6 s (counter visible). Resolve with `{ ok: true, image }`. Advance another 5 s.
- **Expected:** No further interval ticks, no announcements after ready. `vi.getTimerCount()` for the interval is 0. (Leak regression.)
- **Test type:** UI (timing)
- **File:** `components/use-elapsed.test.ts`

#### T017a-TEST-1 — Ready variant renders image with full alt text
- **Scenario:** `<PolaroidCard kind="ready" imageBase64="AAA" siteName="acme" pageName="Home" capturedAt={new Date('2026-04-22T09:14')} />`.
- **Expected:** An `<img>` exists with `src="data:image/png;base64,AAA"` and `alt` matching `/Screenshot of page Home on acme, captured .*2026-04-22.*09:14/` (format-flexible).
- **Test type:** UI
- **File:** `components/PolaroidCard.test.tsx`

#### T017a-TEST-2 — Ready ledge shows `{site}/{page}` + `HH:mm` local
- **Scenario:** Same as T017a-TEST-1.
- **Expected:** Ledge text contains `acme/Home` (left) and `09:14` (right). Both truncated via `.truncate` class on long inputs.
- **Test type:** UI
- **File:** `components/PolaroidCard.test.tsx`

#### T017a-TEST-3 — Error variant renders per-code title + subtitle (table-driven)
- **Scenario:** Render each of the five codes (`auth`, `not_found`, `upstream_unavailable`, `network`, `unknown`) with the exact titles/subtitles from § 4c-4.
- **Expected:** Each render contains the exact title + exact subtitle strings. Icon is `WifiOff` for `network`, `AlertCircle` for others. Title element uses `text-rose-600` (not `-500`) per § 4.5 contrast.
- **Test type:** UI (table-driven)
- **File:** `components/PolaroidCard.test.tsx`

#### T017a-TEST-4 — Error ledge shows FR-12 hint italic + centered
- **Scenario:** Error variant.
- **Expected:** Ledge contains "Shows the last saved version of this page." with italic style and center alignment (class list assertion).
- **Test type:** UI
- **File:** `components/PolaroidCard.test.tsx`

#### T017a-TEST-5 — Reduced motion collapses slide-up to opacity only
- **Scenario:** `matchMedia` reduced-motion true.
- **Expected:** Arrival motion classes / inline style exclude `translate-y-*` transform and keep only opacity transition.
- **Test type:** UI
- **File:** `components/PolaroidCard.test.tsx`

#### T018a-TEST-1 — Variant → icon mapping
- **Scenario:** Render `<ActionPill variant="copy">`, `variant="download"`, `variant="retry"`.
- **Expected:** Each renders with the correct Lucide icon (Copy, Download, RefreshCw) and correct default label.
- **Test type:** UI
- **File:** `components/ActionPill.test.tsx`

#### T018a-TEST-2 — Disabled state swallows click
- **Scenario:** `state="disabled"` + click.
- **Expected:** `onPress` NOT invoked. `aria-disabled="true"` or `disabled` attribute present.
- **Test type:** UI
- **File:** `components/ActionPill.test.tsx`

#### T018a-TEST-3 — Copy success auto-reverts after 1.8 s
- **Scenario:** Trigger `state="success"` on a Copy pill. Fake-advance 1.8 s.
- **Expected:** Pill shows "Copied" for the duration, reverts to "Copy" after 1.8 s. `state` transitions back. (AC-2.3.)
- **Test type:** UI (timing)
- **File:** `components/ActionPill.test.tsx`

#### T018a-TEST-4 — Download success auto-reverts after 1.4 s
- **Scenario:** Same as T018a-TEST-3 but for Download.
- **Expected:** Pill shows "Saved" for 1.4 s then reverts.
- **Test type:** UI (timing)
- **File:** `components/ActionPill.test.tsx`

#### T018a-TEST-5 — Keyboard Enter and Space activate
- **Scenario:** Focus the pill, press Enter (then Space).
- **Expected:** `onPress` invoked once per keystroke.
- **Test type:** UI
- **File:** `components/ActionPill.test.tsx`

#### T020a-TEST-1 — Successful copy writes `ClipboardItem` with correct blob type
- **Scenario:** `ready` state + mock `navigator.clipboard.write` resolve. Click Copy.
- **Expected:** `clipboard.write` called with a single-element array whose element is a `ClipboardItem` containing an `image/png` Blob. The Blob's first bytes match the PNG magic number `\x89PNG\r\n\x1a\n`.
- **Test type:** UI + integration
- **File:** `components/copy-action.test.tsx`

#### T020a-TEST-2 — Pill morphs to "Copied" then reverts after 1.8 s
- **Scenario:** Successful copy + fake timers.
- **Expected:** Immediately after resolution, pill text is "Copied"; after 1800 ms it reverts to "Copy". LiveRegion contains "Copied to clipboard." (AC-2.3.)
- **Test type:** UI (timing)
- **File:** `components/copy-action.test.tsx`

#### T020a-TEST-3 — Permission denied → shake + InlineMessage + Download enabled
- **Scenario:** `clipboard.write` rejects with `DOMException('NotAllowedError')`.
- **Expected:** Copy pill has `animate-shake` / `data-denied` once; after shake, pill is disabled. `<InlineMessage>` visible with EXACT text "Clipboard access was blocked. Use Download instead." Download pill remains enabled. (AC-2.4 / R-3.)
- **Test type:** UI
- **File:** `components/copy-action.test.tsx`

#### T020a-TEST-4 — `ClipboardItem` undefined → Copy disabled from the outset
- **Scenario:** `global.ClipboardItem = undefined` at test setup; render panel in ready state.
- **Expected:** Copy pill is disabled. `<InlineMessage>` visible with the same denied-message text. Download enabled.
- **Test type:** UI
- **File:** `components/copy-action.test.tsx`

#### T021a-TEST-1 — Filename baseline
- **Scenario:** `buildScreenshotFilename('acme', 'home', new Date('2026-04-22T09:42'))`.
- **Expected:** `"acme_home_20260422-0942.png"`.
- **Test type:** unit
- **File:** `lib/filename.test.ts`

#### T021a-TEST-2 — Unicode + punctuation → `-`; output lowercased and kebab
- **Scenario:** `buildScreenshotFilename('Marketing Sïte!', 'Home — Landing', new Date('2026-04-22T09:42'))`.
- **Expected:** `"marketing-s-te_home-landing_20260422-0942.png"` (or an equivalent kebab form with non-ASCII replaced by `-` and runs collapsed — assert against a regex `/^[a-z0-9_-]+\.png$/` AND the specific expected string).
- **Test type:** unit
- **File:** `lib/filename.test.ts`

#### T021a-TEST-3 — Emoji → `-`
- **Scenario:** `buildScreenshotFilename('acme 🚀', 'home', new Date(…))`.
- **Expected:** Emoji bytes replaced with `-`; runs of `-` collapsed; output matches `/^[a-z0-9_-]+\.png$/`.
- **Test type:** unit
- **File:** `lib/filename.test.ts`

#### T021a-TEST-4 — Overlong input truncates to ≤ 100 chars, `.png` preserved, timestamp preserved
- **Scenario:** Supply a 200-char site name and a 200-char page name.
- **Expected:** Output length ≤ 100. Output ends with `.png`. Output contains the full `YYYYMMDD-HHmm` timestamp. Truncation of site + page is roughly proportional (each kept to some share of the budget).
- **Test type:** unit
- **File:** `lib/filename.test.ts`

#### T021a-TEST-5 — Local time (not UTC)
- **Scenario:** `buildScreenshotFilename('s', 'p', new Date('2026-04-22T23:59:00.000-07:00'))` with process `TZ=America/Los_Angeles`.
- **Expected:** Timestamp segment is `20260422-2359` (local), not UTC.
- **Test type:** unit
- **File:** `lib/filename.test.ts`

#### T021a-TEST-6 — Minute-granularity collision produces identical filename
- **Scenario:** Two calls with the same site/page within the same minute.
- **Expected:** Identical filename returned (documents expected behavior — collision handling is not in v1 scope per § 5 / OQ resolution).
- **Test type:** unit
- **File:** `lib/filename.test.ts`

#### T021a-TEST-7 — Download click synthesizes `<a download>` and revokes URL
- **Scenario:** `ready` state with stubbed `URL.createObjectURL` / `URL.revokeObjectURL`. Click Download.
- **Expected:** `createObjectURL` called once with a PNG blob; a synthesized `<a>` gains `download={filename}` where `filename` matches the helper's output; `.click()` fired; `revokeObjectURL` called once after click. Pill shows "Saved" for 1.4 s then reverts.
- **Test type:** UI + integration
- **File:** `components/download-action.test.tsx`

#### T022a-TEST-1 — Visible state exposes `role="status"` + aria-live polite
- **Scenario:** `<InlineMessage visible>…</InlineMessage>`.
- **Expected:** Rendered node has `role="status"` and `aria-live="polite"`; children visible.
- **Test type:** UI
- **File:** `components/InlineMessage.test.tsx`

#### T022a-TEST-2 — Hidden state hides from a11y tree
- **Scenario:** `<InlineMessage visible={false}>…</InlineMessage>`.
- **Expected:** Node is `display: none` (or otherwise unreachable via `getByRole('status')`); screen readers would not announce.
- **Test type:** UI
- **File:** `components/InlineMessage.test.tsx`

#### T023a-TEST-1 — Renders `role="status"`, `aria-live="polite"`, `.sr-only`
- **Scenario:** Render `<LiveRegion />`.
- **Expected:** A single DOM node with all three attributes/classes. Visually hidden (`.sr-only` produces `clip: rect(…)`-style containment).
- **Test type:** UI
- **File:** `components/LiveRegion.test.tsx`

#### T023a-TEST-2 — `announce()` updates text content
- **Scenario:** Call `announce('Hello')`. Then `announce('World')`.
- **Expected:** The LiveRegion's text content transitions "Hello" → "World" (or accumulates, depending on implementation — assert the most recent message is present).
- **Test type:** UI
- **File:** `components/LiveRegion.test.tsx`

#### T023a-TEST-3 — Each state change fires the exact expected announcement (table-driven)
- **Scenario:** For each state transition in the reducer, invoke the panel's announcement hook.
- **Expected:** LiveRegion text matches exactly one of: `"Ready to capture."`, `"Capturing started."`, `"Still capturing, N seconds."` (with N substituted), `"Screenshot ready."`, `"Copied to clipboard."`, `"Download started."`, `"Capture failed: <title>. <subtitle>."` (substituted with the code-specific title/subtitle from § 4c-4).
- **Test type:** UI (table-driven)
- **File:** `components/LiveRegion.test.tsx` + `components/PageshotPanel.integration.test.tsx`

#### T024a-TEST-1 — Shutter is `document.activeElement` after first non-null pages.context
- **Scenario:** Mount panel with `pages.context` null initially; then fire `onSuccess` with valid context.
- **Expected:** After the first event, `document.activeElement === shutterButton`.
- **Test type:** UI
- **File:** `components/PageshotPanel.integration.test.tsx`

#### T024a-TEST-2 — capturing → ready moves focus to Copy (with `preventScroll`)
- **Scenario:** Complete a golden-path capture.
- **Expected:** On ready, `document.activeElement === copyButton`. `focus` was called with `{ preventScroll: true }` (spy `HTMLElement.prototype.focus`).
- **Test type:** UI
- **File:** `components/PageshotPanel.integration.test.tsx`

#### T024a-TEST-3 — capturing → error moves focus to Retry pill
- **Scenario:** Force an error envelope.
- **Expected:** `document.activeElement === retryButton`.
- **Test type:** UI
- **File:** `components/PageshotPanel.integration.test.tsx`

#### T024a-TEST-4 — Escape returns focus to Shutter from any inner focusable
- **Scenario:** Focus Copy pill, press Escape.
- **Expected:** `document.activeElement === shutterButton`.
- **Test type:** UI
- **File:** `components/PageshotPanel.integration.test.tsx`

#### T024a-TEST-5 — Tab order equals DOM order (Shutter → Copy → Download/Retry)
- **Scenario:** Tab through the panel from document start.
- **Expected:** Focus visits Shutter → Copy → Download (ready) or Shutter → Retry (error) in that order. Disabled elements skipped.
- **Test type:** UI
- **File:** `components/PageshotPanel.integration.test.tsx`

#### T025-TEST-1 — Golden-path end-to-end inside jsdom (US-1 AC-1.1–1.5, US-2, US-3)
- **Scenario:** Mount panel with valid pages.context. Mock `fetch('/api/screenshot/p1')` → `{ ok: true, image }` from fixture. Click Shutter. Wait. Click Copy. Click Download.
- **Expected:** States flow idle → capturing → ready; PolaroidCard visible with correct alt text; Copy succeeds (clipboard stub called with correct blob); Download synthesizes the right filename. Entire flow completes without thrown errors.
- **Test type:** integration
- **File:** `components/PageshotPanel.integration.test.tsx`

#### T025-TEST-2 — Offline detection short-circuits fetch (AC-5.4)
- **Scenario:** `navigator.onLine = false`. Click Shutter.
- **Expected:** Panel transitions directly to `error` with `code: 'network'` without calling `/api/screenshot/...`. Retry pill visible.
- **Test type:** integration
- **File:** `components/PageshotPanel.integration.test.tsx`

#### T025-TEST-3 — 5xx → error card with Retry visible (AC-5.3)
- **Scenario:** Mock fetch to return `{ ok: false, error: { code: 'upstream_unavailable', message: 'Try again in a moment.' } }` with HTTP 502.
- **Expected:** Error card renders § 4c-4 `upstream_unavailable` title/subtitle. Retry pill visible and enabled. Copy disabled. Download absent. (AC-5.5 recoverable.)
- **Test type:** integration
- **File:** `components/PageshotPanel.integration.test.tsx`

#### T025-TEST-4 — `prefers-reduced-motion` collapses bloom + slide-up across the whole panel
- **Scenario:** `matchMedia` reduced-motion true. Run the golden path.
- **Expected:** No bloom overlay rendered; Polaroid arrival uses opacity-only; Shutter press has no scale animation.
- **Test type:** integration
- **File:** `components/PageshotPanel.integration.test.tsx`

#### T025-TEST-5 — ARIA live region announces every state change in order
- **Scenario:** Spy on `announce()`. Run golden path.
- **Expected:** Announcements, in order: `"Ready to capture."`, `"Capturing started."`, `"Screenshot ready."`, `"Copied to clipboard."` (after Copy), `"Download started."` (after Download). Each fires exactly once.
- **Test type:** integration
- **File:** `components/PageshotPanel.integration.test.tsx`

#### T025-TEST-6 — Unsaved-draft hint always visible on valid pageId (FR-12 / AC-4.1)
- **Scenario:** Render across each of the four panel states (idle, capturing, ready, error) with a valid pageId.
- **Expected:** Hint text "Screenshot shows the last saved version of this page." (or the ledge variant) is present in the DOM in every state — confirmed via `getByText(/last saved version/i)`.
- **Test type:** integration
- **File:** `components/PageshotPanel.integration.test.tsx`

---

### § 10 — Coverage statement

| PRD § 6 AC | Primary test(s) |
|---|---|
| AC-1.1 Capture button visible + enabled when pageId present | T025-TEST-1, T024a-TEST-1 |
| AC-1.2 Click disables + spinner until response | T014a-TEST-2, T025-TEST-1 |
| AC-1.3 Image rendered inline at ≤ panel width | T017a-TEST-1 |
| AC-1.4 Image contains only rendered page (no chrome) | (Out of automated test scope — manual/T029) |
| AC-1.5 Golden path ≤ 10 s wall-clock | (Manual, M1 verification — T029) |
| AC-2.1 Copy visible + enabled after capture | T025-TEST-1 |
| AC-2.2 Clipboard write uses `image/png` Blob, not data URL | T020a-TEST-1 |
| AC-2.3 "Copied" label reverts within ≤ 2 s | T020a-TEST-2, T018a-TEST-3 |
| AC-2.4 Clipboard denial → inline message + Download fallback | T020a-TEST-3, T020a-TEST-4 |
| AC-3.1 Download visible + enabled after capture | T025-TEST-1 |
| AC-3.2 Click triggers browser download | T021a-TEST-7 |
| AC-3.3 Filename kebab ASCII ≤ 100 chars | T021a-TEST-1..4 |
| AC-3.4 Timestamp is local capture time | T021a-TEST-5 |
| AC-4.1 Hint always visible on valid pageId | T025-TEST-6 |
| AC-4.2 Capture enabled regardless of dirty state | T024a-TEST-1 (Shutter is focused/enabled on mount) + T025-TEST-1 |
| AC-4.3 404 → "Save the page first" | T011a-TEST-4, T017a-TEST-3 |
| AC-5.1 401 → refresh + retry, persistent → admin message | T011a-TEST-2, T011a-TEST-3, T017a-TEST-3 |
| AC-5.2 404 error wording | T017a-TEST-3 |
| AC-5.3 5xx / timeout → try-again + Retry | T011a-TEST-5, T025-TEST-3 |
| AC-5.4 Offline detected + message | T011a-TEST-6, T025-TEST-2 |
| AC-5.5 No unrecoverable state — Retry always 1 click away | T025-TEST-3, T024a-TEST-3 |

| PRD § 7 FR | Primary test(s) |
|---|---|
| FR-01 Single Page Builder Context Panel extension | (Config — T027/T028) |
| FR-02 `pages.context` subscription yields pageId/siteName/pageName | T007a-TEST-2, T007a-TEST-4 |
| FR-03 Panel renders capture + states + preview + actions | T025-TEST-1 |
| FR-04 No client-side credentials | T011a-TEST-9 + build-time lint |
| FR-05 Route obtains cached token, calls Agent API, returns envelope | T011a-TEST-1 |
| FR-06 401 → invalidate + retry once | T011a-TEST-2, T011a-TEST-3 |
| FR-07 Non-200 → code envelope | T011a-TEST-3..T011a-TEST-6 |
| FR-08 Clipboard uses `ClipboardItem` `image/png` | T020a-TEST-1 |
| FR-09 Filename template | T021a-TEST-1..7 |
| FR-10 Elapsed counter appears at 5 s | T016a-TEST-1..3 |
| FR-11 Previous image replaced on re-capture | T013a-TEST-4 |
| FR-12 Static hint always visible on valid pageId | T025-TEST-6 |
| FR-13 Missing env → `auth` envelope + admin message | T011a-TEST-7 |

| Key NFR | Primary test(s) |
|---|---|
| NFR-S-01 Secret never reaches browser or response | T011a-TEST-9 + build-time ESLint rule |
| NFR-S-02 Token cache + 60 s safety margin | T010a-TEST-2, T010a-TEST-3 |
| NFR-A-01 Keyboard + focus + ARIA live | T014a-TEST-3..4, T018a-TEST-5, T024a-TEST-1..5, T023a-TEST-3 |
| NFR-Br-01 Clipboard fallback | T020a-TEST-4 |
| NFR-O-01 Log secrets never, tenant id on first success | T011a-TEST-9, T011a-TEST-10 |

**Coverage claim:** Every AC from PRD § 6 (except AC-1.4 "no editor chrome in image" which is a server-rendered fact about the Agent API, out of our control, and AC-1.5 wall-clock latency which is manual) and every FR from PRD § 7 (except FR-01 which is a Cloud Portal registration fact) has at least one automated test listed above.

---

## 11. Test fixtures and mocks

Use these stable fixture paths. Adding a new scenario (e.g. "401-then-403") is a fixture change, not a test change.

### Server-side fixtures

`fixtures/agentApi.screenshot.ok.json` — canonical success response from the Agent API.
```json
{
  "image": "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=="
}
```
(1×1 transparent PNG base64; starts with the PNG magic `iVBORw0KGgo…` which the Copy path can verify as `\x89PNG\r\n\x1a\n`.)

`fixtures/agentApi.screenshot.404.json` — upstream 404 body.
```json
{ "error": "page not found" }
```

`fixtures/agentApi.screenshot.401.json` — upstream 401 body used by the retry test.
```json
{ "error": "unauthorized" }
```

`fixtures/agentApi.screenshot.5xx.json` — upstream 502 body.
```json
{ "error": "service unavailable" }
```

### OAuth fixtures

`fixtures/oauth.token.ok.json` — canonical token response.
```json
{
  "access_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.test.payload",
  "token_type": "Bearer",
  "expires_in": 86400,
  "scope": "api"
}
```
(Payload is clearly-fake — do NOT use a real token. `test.payload` signature segment ensures no real key material is in the repo.)

`fixtures/oauth.token.short-ttl.json` — same shape but `expires_in: 30` — used to exercise the 60 s safety margin test (T010a-TEST-3).

`fixtures/oauth.token.400.json` — auth endpoint 400 body.
```json
{ "error": "invalid_client", "error_description": "authentication failed" }
```

### SDK fixtures

`fixtures/pagesContext.canonical.json` — canned `PagesContext` event payload used in T007a-TEST-4.
```json
{
  "siteInfo": { "id": "s1", "name": "acme", "displayName": "Acme Marketing" },
  "pageInfo": { "id": "p1", "name": "Home", "displayName": "Home", "path": "/" }
}
```

### Response envelope expectations

`fixtures/serverEnvelope.*` — the server-route envelope shapes the UI expects. The UI tests load these rather than mocking the fetch body inline.

- `fixtures/serverEnvelope.ok.json` — `{ "ok": true, "image": "<base64 from agentApi.screenshot.ok>" }`
- `fixtures/serverEnvelope.auth.json` — `{ "ok": false, "error": { "code": "auth", "message": "Ask your administrator to check the app's credentials." } }`
- `fixtures/serverEnvelope.not_found.json` — `{ "ok": false, "error": { "code": "not_found", "message": "Save the page first, then try again." } }`
- `fixtures/serverEnvelope.upstream_unavailable.json` — `{ "ok": false, "error": { "code": "upstream_unavailable", "message": "Try again in a moment." } }`
- `fixtures/serverEnvelope.network.json` — `{ "ok": false, "error": { "code": "network", "message": "Check your connection, then try again." } }`

### Mock helpers (shared across tests)

- `test-utils/mockFetch.ts` — exports `installFetchMock(table)` that routes requests to Agent API vs OAuth endpoint vs `/api/screenshot` based on URL and returns fixtures. Teardown in `afterEach`.
- `test-utils/mockClipboard.ts` — exports `installClipboard({ mode: 'ok' | 'denied' | 'unavailable' })` to swap `navigator.clipboard.write` and/or remove `ClipboardItem`.
- `test-utils/mockMatchMedia.ts` — exports `setReducedMotion(boolean)` for a11y tests.
- `test-utils/sdkStubs.ts` — typed Marketplace SDK stubs per `client.md § 9a` — `vi.fn<QueryFn>()`, `vi.fn<DestroyFn>()`.

Fixtures and helpers land as part of the RED commits that first use them. Do not defer fixture creation to GREEN — tests are unreadable if they inline 400 characters of base64.

---

## Handoff Metadata

- **Canonical run manifest:** `products/pageshot/project-planning/workflow/current-run.json`
- **Source PRD:** `products/pageshot/project-planning/PRD/prd-000.md` (Lead Dev loaded full PRD; Developer 08 will only load `prd-minimal-000.md`)
- **Source architecture:** ADRs only — minimal track (ADR-0001 through ADR-0006 in `products/pageshot/project-planning/ADR/`)
- **Source UI variant:** `products/pageshot/project-planning/ui-design/ui-design-20260422T073037Z-v2.md` ("Shutterbug")
- **Source POC:** `products/pageshot/pocs/poc-v2/index.html` (visual source of truth)
- **Recommended next command:** `/implement` — QA enrichment (§ 9–11) is complete; test-first ordering is encoded in § 4 task splits (`*a` RED → `*b` GREEN) and § 5 execution order.
- **Recommended next input file:** none additional — Developer 08 loads `prd-minimal-000.md` + this task breakdown only.
- **Run-manifest update:** the Team Lead should set `task_breakdown_style: tdd` in `current-run.json` to signal the execution agent to respect RED → GREEN → REFACTOR sequencing.
