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

#### T007 — Wire MarketplaceProvider + `pages.context` subscription
- **Title:** Extend the scaffolded MarketplaceProvider to expose live `pages.context` (pageId, siteName, pageName).
- **Description:** The scaffold ships `components/providers/marketplace.tsx` with a Provider that calls `application.context`. Add a second context `PagesContextContext` that subscribes via **path A (subscribe-via-query)** — `client.query('pages.context', { subscribe: true, onSuccess })` — and stores `{ pageId, siteName, pageName }` extracted from the SDK's `PagesContext` shape (`pageInfo.id`, `siteInfo.name`, `pageInfo.name`). Provide `usePagesContext()` hook returning `{ pageId, siteName, pageName } | null`. Store and call the returned `unsubscribe` on unmount. Do NOT use `client.subscribe('pages.context', …)` — that is path B and will fail typecheck.
- **Expected Output:** `usePagesContext()` returns null initially then the live values once the SDK delivers the first event. On unmount the subscription tears down (verified by unit test).
- **Depends on:** T002, T005

#### T008 — Create `/panel` route (Page Context Panel surface)
- **Title:** Create `app/panel/page.tsx` as a client component that renders the PageShot panel.
- **Description:** Mark file with `'use client'`. Wrap in `MarketplaceProvider`. Read `usePagesContext()` and `useMarketplaceClient()` (the scaffold provides these). Render a placeholder component called `<PageshotPanel />` for now — actual UI comes in E4. Guard-clause: if `usePagesContext()` returns null, render a minimal "Loading page context…" line (per the UI spec assumption "we do not design a no-context skeleton in v1" — this is only the gap between mount and first event). Keep the route Node-less (client-only).
- **Expected Output:** `app/panel/page.tsx` exists, is a client component, renders `<PageshotPanel />` once `usePagesContext()` has values. Route loads at `http://localhost:3000/panel` without SSR errors (use `dynamic` + `{ ssr: false }` if needed).
- **Depends on:** T007

#### T009 — Unit tests for MarketplaceProvider + `pages.context` wiring
- **Title:** Add Vitest tests covering init signature, `pages.context` subscription, and unmount cleanup.
- **Description:** Using the typed stub pattern from `client.md § 9`, assert:
  1. `ClientSDK.init` called exactly once with `{ target: window.parent, modules: [...] }`.
  2. `client.query('pages.context', { subscribe: true, onSuccess: <fn> })` is called after mount.
  3. On unmount, the returned `unsubscribe` function and `client.destroy()` are both invoked once.
  4. `usePagesContext()` returns null before first event, then returns `{ pageId, siteName, pageName }` after `onSuccess` fires with a canned `PagesContext` shape.
  Use `vi.fn<QueryFn>()` and `vi.fn<DestroyFn>()` per the § 9a template — no naked `vi.fn()` casts.
- **Expected Output:** `src/components/providers/marketplace.test.tsx` passing. `npm run test` green.
- **Depends on:** T007, T008

---

### Epic E3 — Server-side OAuth proxy

#### T010 — Implement shared Sitecore OAuth token cache
- **Title:** Add `lib/sitecore-token.ts` with the cached `getSitecoreToken()` function from `auth.md § 5`.
- **Description:** Copy verbatim the module-scope cache + `getSitecoreToken` implementation from § 4c-6 of this breakdown (sourced from `auth.md § 5`). Token endpoint: `POST https://auth.sitecorecloud.io/oauth/token`, body `client_id`/`client_secret`/`grant_type=client_credentials`/`audience=https://api.sitecorecloud.io`. 60 s safety margin on cached expiry. Throws on non-2xx from auth. Export a named function `getSitecoreToken(): Promise<string>`. Also export `invalidateSitecoreToken(): void` which sets the module-level cache to `null` (needed for T011's 401 retry).
- **Expected Output:** `lib/sitecore-token.ts` exists. `getSitecoreToken` returns a token string, caches it, and returns the cached value on subsequent calls within the TTL window (verified by unit test with mocked `fetch`).
- **Depends on:** T002

#### T011 — Implement `/api/screenshot/[pageId]` route handler
- **Title:** Create the Node-runtime route handler that proxies the Agent API screenshot call.
- **Description:** Create `app/api/screenshot/[pageId]/route.ts`:
  - `export const runtime = "nodejs"` (ADR-0004 — NOT edge).
  - Export `GET(request, { params })`. Validate `params.pageId` is a non-empty string; otherwise return `{ ok: false, error: { code: 'not_found', message: '…' } }` with HTTP 400.
  - Check `SITECORE_CLIENT_ID` + `SITECORE_CLIENT_SECRET` are present; if missing, return `auth` envelope with HTTP 500 (FR-13).
  - Call `getSitecoreToken()`. Fetch `GET https://edge-platform.sitecorecloud.io/stream/ai-agent-api/api/v1/pages/{pageId}/screenshot` with `Authorization: Bearer <jwt>` and `Accept: application/json`.
  - **401 retry:** on `401`, call `invalidateSitecoreToken()` once, call `getSitecoreToken()` again, retry the Agent API call exactly once. If second attempt also 401, map to `auth` envelope. Do NOT retry more than once (FR-06, `auth.md § 6`).
  - Map Agent API responses to the `ScreenshotResponse` envelope from PRD § 10 / § 4c-6. Success body `{ ok: true, image: <base64> }` (Agent API returns base64 — see PRD FR-05).
  - Log (server-side only) `{ event, pageId, status, latencyMs, error? }` — never log secrets. Include tenant identifier (derived from token claim or env label) on first successful auth per R-6.
  - Return `NextResponse.json(envelope, { status })`.
- **Expected Output:** Route compiles. Manual curl hitting `http://localhost:3000/api/screenshot/test` with credentials returns `{ ok: true, image: "<base64>" }` or a structured error envelope.
- **Depends on:** T010

#### T012 — Unit tests for the route handler (401 retry, error mapping, missing env)
- **Title:** Vitest coverage of the route handler's key paths without hitting the real Agent API.
- **Description:** Mock `global.fetch` (or a wrapper around it). Assert:
  1. **Happy path** — `200` from Agent API → returns `{ ok: true, image: '…' }` with status 200.
  2. **401 once, then 200** — first upstream call returns 401, second returns 200. `invalidateSitecoreToken` called once; final response is `ok: true`. Only 2 upstream calls total (no infinite loop).
  3. **401 twice** — both upstream calls return 401. Final response envelope `{ ok: false, error: { code: 'auth', … } }`, HTTP 500 or 401 (Developer's choice, document it).
  4. **404 from upstream** → `{ code: 'not_found' }`.
  5. **5xx from upstream** → `{ code: 'upstream_unavailable' }`.
  6. **fetch rejection (network)** → `{ code: 'network' }`.
  7. **Missing env vars** — `SITECORE_CLIENT_ID` blank → returns `{ code: 'auth' }` without calling the auth endpoint.
- **Expected Output:** `app/api/screenshot/[pageId]/route.test.ts` passing. All seven cases covered.
- **Depends on:** T011

---

### Epic E4 — Panel UI — Shutterbug direction

#### T013 — Scaffold panel state machine + `<PageshotPanel>` root
- **Title:** Create a typed `usePanelState` reducer for the four top-level states and wire into `<PageshotPanel>`.
- **Description:** `PanelState` discriminated union from PRD § 10: `idle | capturing | ready | error`. State transitions:
  - `idle` → `capturing` on Capture button click (record `startedAt`).
  - `capturing` → `ready` on `{ ok: true, image }` from `/api/screenshot/[pageId]`.
  - `capturing` → `error` on `{ ok: false, error }` envelope (copy `code` + `message` verbatim).
  - `ready` → `capturing` on Capture click (replaces previous image — FR-11).
  - `error` → `capturing` on Retry click.
  Implement `<PageshotPanel>` client component as the root element of `/panel`. It reads `usePagesContext()` and passes `{ pageId, siteName, pageName }` into the state machine. On capture trigger, issues `fetch('/api/screenshot/' + encodeURIComponent(pageId))` and dispatches accordingly.
- **Expected Output:** `components/PageshotPanel.tsx` + a reducer module. `/panel` compiles and transitions through the four states in the browser against the dev server (manual verification with a mocked route handler is fine at this stage).
- **Depends on:** T008, T011

#### T014 — `<Shutter>` hero button
- **Title:** Implement the 112×112 px amber hero shutter button with all eight visual states.
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
- **Expected Output:** `<Shutter>` renders each state faithfully to POC v2. Tab/Enter/Space activate. `prefers-reduced-motion` verified.
- **Depends on:** T004, T005, T013

#### T015 — `<ShutterLabel>` with elapsed-time counter
- **Title:** Label + mono elapsed-time pill under the shutter.
- **Description:** Component `components/ShutterLabel.tsx`. Props `{ state, elapsedSeconds? }`. Renders the main label ("Capture" | "Capturing…") in Geist Sans 500 13 px (14 px at `@container md`). In `capturing-slow`, adds a secondary mono line `"Still catching… {n} s"` in Geist Mono 11/12 px, `text-amber-700`. The parent panel's `LiveRegion` (T023) announces the elapsed count polite-ly every second past 5 s.
- **Expected Output:** Rendering matches POC v2 label zone. The sub-line only appears when `state === 'capturing-slow'`.
- **Depends on:** T014

#### T016 — Elapsed-time controller (5-second threshold)
- **Title:** Wire the elapsed-seconds hook that flips `capturing` → `capturing-slow` at 5 s.
- **Description:** In `<PageshotPanel>`, when state is `capturing`, start a `setInterval` ticking every 1 s. If `Date.now() - startedAt >= 5000`, dispatch a state-preserving update to show the elapsed seconds (label changes to `capturing-slow` visually; the `PanelState` kind is still `capturing` logically — add a derived `elapsedSeconds?: number` next to `startedAt`). Clear the interval on any transition out of `capturing`. Announce "Still capturing, N seconds" to the LiveRegion each second past 5.
- **Expected Output:** After 5 s of capturing, the mono sub-line appears and updates every second. Announcement fires for assistive tech. No dangling timer after transition.
- **Depends on:** T013, T015

#### T017 — `<PolaroidCard>` (ready + error variants)
- **Title:** The framed preview card for both successful captures and error states.
- **Description:** Component `components/PolaroidCard.tsx`. Discriminated prop union:
  - `{ kind: 'ready'; imageBase64: string; siteName: string; pageName: string; capturedAt: Date }`
  - `{ kind: 'error'; code: 'auth'|'not_found'|'upstream_unavailable'|'network'|'unknown'; title: string; subtitle: string }`
  **Ready:** white surface, `rounded-3xl`, `p-2` (or `p-3` at `@container md`), `border border-stone-200/60`, `shadow-polaroid`. Image slot `aspect-[4/3] rounded-2xl overflow-hidden bg-stone-100`; render `<img src={'data:image/png;base64,' + imageBase64} alt="Screenshot of page {pageName} on {siteName}, captured {capturedAt}" />` with `object-cover object-top`. Bottom ledge: `px-3 py-2 mt-1 border-t text-[11px] font-mono text-stone-600 flex items-center justify-between gap-2`, left = truncated `{siteName}/{pageName}`, right = `HH:mm` local. At `@container xs` (320 px) drop ledge text to 10 px. Arrival motion: `translate-y-2 opacity-0` → `translate-y-0 opacity-100` over 240 ms; reduced-motion = opacity only.
  **Error:** same frame. Image slot `bg-stone-50`, flex-column with large icon (`AlertCircle` | `WifiOff` 32 px, stroke 1.5, `text-rose-500`), title in `text-sm font-medium text-rose-600`, subtitle in `text-xs text-stone-600 text-center max-w-[28ch]`. Ledge shows the FR-12 hint ("Shows the last saved version of this page.") in `text-[11px] italic text-stone-500` center-aligned.
- **Expected Output:** Both variants render per POC v2. `<img alt>` populated. Reduced-motion respected.
- **Depends on:** T004, T005, T013

#### T018 — `<ActionPill>` (Copy, Download, Retry)
- **Title:** Pill-shaped action buttons with success/denied/disabled states.
- **Description:** Component `components/ActionPill.tsx` using `cva` for variants. Base: `h-10 rounded-full border border-stone-300 bg-white px-4 text-sm font-medium text-stone-900`. States:
  - Hover: `bg-amber-50 border-amber-300`.
  - Focus-visible: `ring-2 ring-amber-400 ring-offset-2 ring-offset-amber-50`.
  - Pressed: `bg-amber-100`.
  - Success (Copy → "Copied ✓" / Download → "Saved"): `bg-amber-50 border-amber-300 text-amber-700` + `Check` icon prepended. Auto-reverts after 1.8 s (Copy) or 1.4 s (Download).
  - Disabled: `opacity-50 cursor-not-allowed`.
  - Denied (Copy only after clipboard reject): apply the `animate-[shake_80ms_ease-in-out]` keyframe once, then lock to disabled.
  - `retry` variant: `border-amber-400 text-amber-700` + `RefreshCw` icon; replaces Download in error state.
- **Expected Output:** Three variants + state matrix match POC v2. Keyboard activation works.
- **Depends on:** T004

#### T019 — Layout assembly: Header, StatusLine, EmptyPreview, ActionBar
- **Title:** Assemble `<PageshotPanel>` layout matching POC v2 top-to-bottom.
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
  8. `<LiveRegion>` sr-only at root (T023).
- **Expected Output:** `/panel` renders all zones in the correct order and shows the correct subset per state. Status copy matches exactly.
- **Depends on:** T014, T015, T017, T018

#### T020 — Copy-to-clipboard action + denied fallback
- **Title:** Wire the Copy pill to `navigator.clipboard.write` and handle permission denial.
- **Description:** On Copy click in `ready` state: decode the base64 image to a Blob (`Uint8Array.from(atob(base64), c => c.charCodeAt(0))` → `new Blob([bytes], { type: 'image/png' })`). Call `navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])` (FR-08 / AC-2.2). On success, morph pill to "Copied ✓" for 1.8 s, announce via LiveRegion. On reject (DOMException `NotAllowedError` etc.): trigger shake animation on the pill, disable it (denied → locked disabled per spec), render inline message "Clipboard access was blocked. Use Download instead." via `<InlineMessage>`, keep Download enabled (AC-2.4).
  Also surface the fallback when `navigator.clipboard.write` is not defined at all — same inline message, Copy pill stays disabled from the outset for that session.
- **Expected Output:** Successful copy puts the PNG on the system clipboard. Denial path shows inline message and disables only Copy.
- **Depends on:** T017, T018

#### T021 — Download action with filename template
- **Title:** Trigger a PNG download with `{siteName}_{pageName}_{YYYYMMDD-HHmm}.png`, kebab/ASCII, 100 chars.
- **Description:** On Download click in `ready` state: decode the base64 PNG to a Blob, create `URL.createObjectURL`, synthesize an `<a download>` element, click it, revoke. Filename: add helper `buildScreenshotFilename(siteName, pageName, capturedAt): string` that:
  1. Lowercases.
  2. Replaces non-`[a-z0-9-_]` with `-`.
  3. Collapses runs of `-`.
  4. Concatenates `${site}_${page}_${YYYYMMDD}-${HHmm}.png` using local time (not UTC).
  5. If total length > 100 chars, truncate the `site` and `page` portions proportionally while preserving `.png` and the timestamp suffix — never drop the extension.
  (FR-09, AC-3.2, AC-3.3, AC-3.4.) After trigger, flash pill success state "Saved" for 1.4 s.
- **Expected Output:** File downloads with the correct filename. Unicode/emoji in site/page names get sanitized to `-`. Long names truncate to ≤ 100 chars preserving the extension.
- **Depends on:** T017, T018

#### T022 — `<InlineMessage>` component
- **Title:** Inline message slot for clipboard-denied and secondary hints.
- **Description:** `components/InlineMessage.tsx`. Props `{ visible: boolean; children: ReactNode; tone?: 'info' | 'warn' }`. Role `status`, `aria-live="polite"`. Styling: `mt-2 text-xs text-stone-600 bg-stone-50 border border-stone-200 px-3 py-2 rounded-lg`. Hidden via `data-visible="false"` + `display: none` to avoid layout thrash.
- **Expected Output:** Shows/hides deterministically. Screen readers announce content when it appears.
- **Depends on:** T004

#### T023 — `<LiveRegion>` accessibility announcer
- **Title:** Single sr-only polite live region at panel root.
- **Description:** `components/LiveRegion.tsx`. Renders `<div role="status" aria-live="polite" class="sr-only">{message}</div>`. Export an `announce(msg: string)` helper (via a simple context) used by the state machine to announce: "Ready to capture.", "Capturing started.", "Still capturing, N seconds.", "Screenshot ready.", "Copied to clipboard.", "Download started.", "Capture failed: <title>. <subtitle>." (copy the exact wording from POC `announce()` calls / spec § 4.5).
- **Expected Output:** Every state change produces an announcement. Region is visually invisible.
- **Depends on:** T013, T019

#### T024 — Keyboard map + focus management
- **Title:** Implement the focus strategy from UI spec § Flow E.
- **Description:**
  - On panel mount → `shutter.focus()` (after first non-null pages.context).
  - `capturing` → `ready` → move focus to Copy pill (`btnCopy.focus({ preventScroll: true })`).
  - `capturing` → `error` → move focus to Retry pill.
  - `ready` re-capture press → focus stays on Shutter through `capturing` → returns to Copy on `ready`.
  - Global `Escape` handler (on `<PageshotPanel>`) → refocus Shutter.
  - Tab order = DOM order (ensured by T019 layout).
  - `Enter` / `Space` activate focused button (native `<button>` behavior — no custom handling).
- **Expected Output:** Keyboard walkthrough matches § Flow E exactly. Verified by T025 tests.
- **Depends on:** T019

#### T025 — UI component tests (state rendering, copy, download, a11y)
- **Title:** Vitest + Testing Library tests for the panel UI.
- **Description:** Use `@testing-library/react` with the MarketplaceProvider stubbed out. Cover:
  1. **Idle state** — Shutter present + focused on mount; Copy/Download disabled; EmptyPreview visible; PolaroidCard absent.
  2. **Capturing → elapsed** — press Shutter, advance time 6 s with `vi.useFakeTimers()`, assert sub-line "Still catching… 6 s" appears and `announce` called.
  3. **Ready focus move** — resolve mocked fetch; Copy receives focus; pill becomes enabled; PolaroidCard visible with correct `img alt` (includes siteName + pageName + capturedAt).
  4. **Copy click → success label + revert** — mock `navigator.clipboard.write` resolve; pill shows "Copied" then reverts to "Copy" after 1.8 s (advance fake timers).
  5. **Copy denied → shake + inline message** — mock clipboard reject; pill gains `data-denied`; InlineMessage visible; Download remains enabled.
  6. **Download filename** — unit-test `buildScreenshotFilename('Marketing Site!', 'Home — Landing', new Date('2026-04-22T09:42'))` → matches `marketing-site_home-landing_20260422-0942.png`. Test truncation: supply a 200-char site name, assert output ≤ 100 chars and ends `.png`.
  7. **Error state (404)** — mocked envelope `{ ok: false, error: { code: 'not_found', message: '…' } }`; PolaroidCard renders "We couldn't find that page." + "Save the page first — then we can catch it."; Retry pill visible; Download absent.
  8. **Escape returns focus to shutter** — fire `Escape` keydown from within Copy pill; assert Shutter becomes `document.activeElement`.
- **Expected Output:** `npm run test` green with the above coverage.
- **Depends on:** T013, T014, T015, T017, T018, T019, T020, T021, T023, T024

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

### E1 — Scaffold & project skeleton
- Scaffold fresh from `shadcn@latest add …quickstart-with-client-side-xmc.json` succeeds non-interactively on a clean machine. (E2E — manual)
- `npm run typecheck`, `npm run lint`, `npm run build`, `npm run test` all green immediately after T002. (regression)
- PNA headers present on `GET /` response in dev. (unit — header assertion)
- Tailwind `shadow-shutter`, `shadow-polaroid`, `animate-shutter-bloom` compile and render. (UI sanity)

### E2 — Marketplace SDK integration
- `ClientSDK.init` called exactly once with `target: window.parent` and `modules` registered. (unit)
- `pages.context` subscribed via **path A** (query with `subscribe: true`); path B call would fail typecheck — regression guard.
- Unmount tears down the subscription AND calls `client.destroy()`. (unit)
- `usePagesContext()` returns null pre-event, then correct values post-event. (unit)

### E3 — Server-side OAuth proxy
- **Golden path:** 200 from Agent API → `{ ok: true, image }` returned; latency logged. (unit + manual)
- **401-once retry:** upstream 401 → token invalidated → second call 200 → `{ ok: true }`. Exactly 2 upstream calls. (unit — guards R-1/R-2)
- **Double 401:** two 401s → `{ error: { code: 'auth' } }`; no third call. (unit)
- **404** → `not_found` envelope (AC-4.3 / AC-5.2). (unit)
- **5xx / timeout / fetch reject** map to `upstream_unavailable` / `network` respectively. (unit)
- **Missing env:** blank `SITECORE_CLIENT_ID` → `auth` envelope without hitting auth endpoint (FR-13, R-6). (unit)
- **Bad pageId:** empty string / non-string → HTTP 400 + `not_found`. (unit)
- **Token cache hit:** second call within TTL reuses cached token (no second POST to `/oauth/token`). (unit)
- **Token cache expiry:** past `expiresAt - 60 s` → refresh. (unit)

### E4 — Panel UI — Shutterbug direction
- Idle: Shutter focused on mount, Copy/Download disabled, EmptyPreview visible, PolaroidCard absent. (UI)
- Elapsed counter appears at 5 s (not 4 s, not 6 s). (UI — uses fake timers, guards R-1 surfacing)
- Ready: focus moves to Copy; PolaroidCard `img alt` contains siteName + pageName + capturedAt. (UI + a11y)
- Copy success: pill text morphs to "Copied" then reverts after 1.8 s; LiveRegion announces "Copied to clipboard." (UI + a11y)
- Copy denied: shake + InlineMessage + Download remains enabled. (UI — guards R-3)
- Filename sanitization: unicode / emoji / non-ASCII replaced with `-`; output kebab-case; ≤ 100 chars; `.png` preserved even after truncation. (unit)
- 404 error card: title "We couldn't find that page." + subtitle "Save the page first, then try again."; Retry replaces Download; Copy disabled. (UI — guards R-5)
- Reduced motion: no spring, no bloom, no slide-up. (UI)
- Escape returns focus to Shutter. (UI + a11y)

### E5 — Registration
- `PageShot — TEST` custom app loads from the Vercel preview URL inside Pages editor iframe without CSP / cookie errors (NFR-Co-01).
- Both test and prod custom apps have their env vars scoped correctly (preview vars do not leak to production and vice versa — guards R-6).

### E6 — Dogfood verification
- Happy path under 10 s (M1) on the live tenant.
- Zero mid-run edits to skill files (D1 guard).
- Any friction logged as patch-queue entry in CATALOG (D3 guard).

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

### Ordering constraints

- T001 must run first — nothing else compiles without the scaffold.
- T002 unblocks every subsequent task; test stack + lint clean is a prerequisite for any unit test (T009, T012, T025).
- T004 and T005 (Tailwind tokens + fonts) are prerequisites for UI components (T014–T019, T022).
- T007 (Provider + `pages.context` subscription) must precede T008 (panel route) and T013 (state machine), because the panel consumes `usePagesContext()`.
- T010 (token cache) must precede T011 (route handler), which must precede T012 (its tests) and T013 (state machine that fetches from the route).
- T014/T015/T016 form a mini-chain: Shutter → ShutterLabel → ElapsedController.
- T017, T018, T022, T023 are independent UI components — parallelizable once T004 is done.
- T019 (layout assembly) consumes T014, T015, T017, T018, T022, T023 — it is the join node.
- T020 (copy) and T021 (download) consume T017 + T018 and are the last two interaction wirings before T025 tests.
- T024 (keyboard map) consumes T019 (focus order = DOM order).
- T025 (UI tests) is the last E4 task — depends on all interaction + layout work.
- T026 (Vercel preview) depends on T025 — we deploy only green code.
- T027 → T028 → T029 → T030 are strictly sequential in E5/E6.

### Execution order (all Task IDs in valid dependency order)

```
T001, T002, T003, T004, T005, T006, T007, T008, T009, T010, T011, T012, T013,
T014, T015, T016, T017, T018, T022, T023, T019, T020, T021, T024, T025,
T026, T027, T028, T029, T030
```

### Parallel groups

```
Group 1 (sequential — scaffold foundation):   T001 → T002
Group 2 (parallel — all depend on T002):      T003, T004, T005, T006, T010
Group 3 (sequential — SDK wiring):            T007 → T008 (T008 also depends on T005)
Group 4 (parallel — depends on T010):         T011 → T012
Group 5 (sequential — state machine):         T013 (depends on T008 + T011)
Group 6 (parallel — depends on T013 + tokens):
  - Shutter chain:  T014 → T015 → T016
  - T017 (Polaroid; depends on T004, T005, T013)
  - T018 (ActionPill; depends on T004)
  - T022 (InlineMessage; depends on T004)
  - T023 (LiveRegion; depends on T013 + T019 — sequenced in Group 7)
Group 7 (sequential — layout join):           T019 (depends on T014, T015, T017, T018)
                                              → T023 (depends on T013 + T019)
Group 8 (parallel — depends on T017 + T018):  T020 (copy), T021 (download)
Group 9 (sequential — keyboard + tests):      T024 → T025
Group 10 (sequential — deploy + register):    T026 → T027 → T028 → T029 → T030
Group 11 (parallel — unit tests where possible, run alongside Groups 4–8):
  T009 (depends on T007 + T008),  T012 (depends on T011)
```

Group 11 is the explicit acknowledgment that unit tests can start as soon as their feature lands — the Team Lead can spawn a second Developer to work on T009/T012 in parallel with E4 component work.

---

## 6. Suggested Milestones

- **M1 — Scaffold + skeletons (end of T009):** Marketplace Client-Side scaffold green, PNA headers in place, Tailwind/fonts wired, `.env.local` handled, `MarketplaceProvider` + `pages.context` subscription tested, `/panel` route renders.
- **M2 — Capture round-trip works (end of T013):** `/api/screenshot/[pageId]` handler returns base64 image or typed error envelope; panel state machine transitions idle → capturing → ready/error end-to-end with a real (or mocked) upstream.
- **M3 — Shutterbug UI complete (end of T025):** All visual components match POC v2; copy/download/retry/clipboard-denied all work; keyboard map + a11y complete; all unit + component tests green.
- **M4 — Deployed, registered, dogfood logged (end of T030):** Vercel preview + production deployed; test + production custom apps registered in Cloud Portal; happy path + error paths smoke-tested in the real editor; run + any friction logged to the Marketplace CATALOG.

---

## 7. Risk Areas

- **R-1 — Agent API latency > 10 s** (PRD R-1). Mitigated by the elapsed-time counter (T016) that visibly ticks past 5 s. Test T016/T025 guards the UX.
- **R-2 — OAuth client-credentials setup fails** (wrong scopes, wrong audience, role issue — PRD R-2). Mitigated by the credential-acquisition protocol at T006 and the `auth` error envelope (FR-13 / T011). The first 401 after Vercel deploy is the likely stumble.
- **R-3 — Clipboard write denied** (PRD R-3). Fully covered by T020's denial path + T025 test.
- **R-5 — Unsaved-draft confusion** (PRD R-5). Mitigated by the always-visible FR-12 hint (T019) and the 404 error message (T017).
- **R-6 — Vercel env-var misconfig** (PRD R-6). Mitigated by having two distinct custom apps (test + production) in separate scopes (T027/T028) and by logging the tenant identifier (not the secret) on first successful auth (T011).
- **R-7 — Dogfood first-run surfaces skill gaps** (PRD R-7 — **high likelihood, expected**). That is the purpose of T030 — any friction becomes a patch-queue entry, not a blocker.
- **New at task level:** Chrome Local Network Access enforcement — if T003 is missed, the iframe from the portal will silently fail to load `localhost:3000`. Already covered by T003 + E4 local iteration.
- **New at task level:** Geist font vs. POC's Inter font — visual tie-breaks must not be done with Inter; T005 replaces it with Geist before T019.

---

## 8. Suggested Team Structure

**Primary path: one Developer agent.** This is a small app (~30 tasks, one route handler, ~8 React components) and sequential state between scaffold → SDK wiring → state machine is unavoidable. A single Developer stays in context and delivers M1 → M4 in order.

**Where parallelism helps (Team Lead may spawn a second Developer):**
- **Group 2** (T003/T004/T005/T006/T010) — five independent foundation tasks. A second Developer can own Tailwind tokens + fonts (T004/T005) while the first handles PNA headers + env + token cache (T003/T006/T010).
- **Group 6** — Shutter chain (T014→T015→T016) and Polaroid/Pill/InlineMessage (T017/T018/T022) are visually independent. Two Developers can parallelize.
- **Group 11 — tests** — unit tests (T009/T012) can land in parallel with their feature tasks if the Team Lead chooses to split.

**Hand-offs:** T025 (UI tests) naturally gates Vercel deploy (T026); T029 (smoke test) naturally gates the catalog log (T030). No multi-person hand-off risk.

---

## 9. TDD and quality contract

_(Populated by QA Specialist (07) in the next step.)_

## 10. Per-task test specifications

_(Populated by QA Specialist (07) in the next step.)_

---

## Handoff Metadata

- **Canonical run manifest:** `products/pageshot/project-planning/workflow/current-run.json`
- **Source PRD:** `products/pageshot/project-planning/PRD/prd-000.md` (Lead Dev loaded full PRD; Developer 08 will only load `prd-minimal-000.md`)
- **Source architecture:** ADRs only — minimal track (ADR-0001 through ADR-0006 in `products/pageshot/project-planning/ADR/`)
- **Source UI variant:** `products/pageshot/project-planning/ui-design/ui-design-20260422T073037Z-v2.md` ("Shutterbug")
- **Source POC:** `products/pageshot/pocs/poc-v2/index.html` (visual source of truth)
- **Recommended next command:** `/task-breakdown` QA-enrich phase (populates § 9–10 via QA Specialist (07)); then `/implement`.
- **Recommended next input file:** `project-planning/plans/qa-report.md` (optional on minimal track) — QA may edit § 9–10 in place instead.
