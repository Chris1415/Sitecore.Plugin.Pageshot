# Implementation Runbook

---
document_type: implementation_runbook
artifact_name: implementation-runbook-20260422T073037Z.md
generated_at: 2026-04-22T07:30:37Z
run_manifest: project-planning/workflow/run-20260422T073037Z.json
source_inputs:
  - project-planning/PRD/prd-minimal-000.md
  - project-planning/plans/task-breakdown-20260422T073037Z.md
consumed_by:
  - Developer (08)
next_input:
  - products/pageshot/site/next-app/
---

## 1. Implementation Scope

Implement **PageShot** — a Sitecore Marketplace custom app that adds a Page Builder Context Panel with a one-button "Capture screenshot" control. The panel pulls the current page via `@sitecore-marketplace-sdk/client`'s `pages.context` subscription, calls a server-side Next.js route handler that proxies `GET /api/v1/pages/{pageId}/screenshot` on the SitecoreAI Agent API (OAuth client credentials), and lets the editor copy to clipboard or download the PNG. Visual direction: **Shutterbug** (winning UI variant v2).

Execution scope: **all six epics (E1–E6) of the enriched task breakdown**, TDD style, sequential execution (parallelization disabled per `task_breakdown_style: tdd`).

## 2. Canonical Inputs

- **Primary (slim context):**
  - `prd_minimal` → `products/pageshot/project-planning/PRD/prd-minimal-000.md`
  - `task_breakdown` → `products/pageshot/project-planning/plans/task-breakdown-20260422T073037Z.md` (post-QA, RED/GREEN splits, § 9 TDD contract, § 10 75 test specs, § 11 fixtures)
- **Visual source of truth (may be opened by Developer):**
  - `selected_poc_path` → `products/pageshot/pocs/poc-v2/index.html` (Shutterbug clickdummy)
- **Not loaded in normal flow:** full PRD, ADRs, architecture file (none exists — minimal track), UI design spec (text form). The task breakdown § 4c has copied every relevant detail.
- **Mode:** `pipeline`. No rebuild assets — `source.analysis_mode: greenfield`.

## 3. Target Directory Decision

- **Product root:** `products/pageshot/` (dedicated git repo, branch `prd-000`)
- **Implementation directory:** `products/pageshot/site/next-app/`
  - Rationale: ADR-0004 names `products/pageshot/site/` as the app root. The Marketplace scaffold produces a `next-app/` subdirectory. Lead Developer resolved the mismatch by nesting the scaffold inside `site/`, so the final Next.js app root is `site/next-app/`. Accepted by stakeholder during § 4c review.
- **Vercel connection:** monorepo root connected; `products/pageshot/site/next-app/` configured as the Vercel project's "root directory." Confirmed by stakeholder.

## 4. Planned Delivery Order

Per task breakdown § 5. Sequential; no parallelization (TDD mandate). RED → GREEN pairs executed back-to-back.

| Milestone | Tasks | Summary |
|---|---|---|
| **M1 — Scaffold + skeletons** | E1: T001 → T002 → T003 (+ T003-TEST-1) → T004 (+ T004-TEST-1) → T005 → T006 | Marketplace custom-app scaffold per `skills/sitecore/setup/scaffold.md` + `marketplace-sdk/lifecycle.md`. Next.js 15 App Router, TypeScript strict, Tailwind, Vitest + Playwright setup. `.env.local.example` with `SITECORE_CLIENT_ID` / `SITECORE_CLIENT_SECRET` placeholders. `.gitignore` covers `.env.local`. Shared mocks (`mockFetch`, `mockClipboard`, `mockMatchMedia`) added for § 11 fixtures. |
| **M2 — Capture round-trip works** | E2: T007a → T007b → T008 — E3: T010a → T010b → T011a → T011b | Marketplace SDK Provider + `pages.context` subscription. Token cache (`lib/sitecore-token.ts`) with 60 s safety margin + stampede protection. Route handler `app/api/screenshot/[pageId]/route.ts` with 401 retry-once + full error-code envelope. Credentials loaded from `.env.local` server-side only. |
| **M3 — Shutterbug UI complete** | E4: T013 → T014 → T015 → T016 → T017 → T018 → T019 → T020 → T021 → T022 → T023 → T024 → T025 (and `a`/`b` test-first splits per task breakdown) | State-machine reducer, `ShutterButton` with spring-scale + capture bloom + aperture spin, `PolaroidCard` preview + ledge, `ActionPill` for Copy/Download/Retry, elapsed-time controller, keyboard+focus map, ARIA live-region announcer, `prefers-reduced-motion` fallback, filename sanitization (+ download action), Copy-to-clipboard (+ denied fallback), inline error message mapping. Integration tests at panel level (T025). |
| **M4 — Deployed & registered + dogfood logged** | E5: T026 → T027 → T028 — E6: T029 → T030 | Vercel deployment configuration; test custom app + production custom app registered in Cloud Portal; env vars wired in Vercel. End-to-end smoke test on Vercel preview URL. Run logged to `.agent/skills/sitecore/marketplace-sdk/CATALOG.md` with any friction captured as patch-queue entries. |

## 5. Verification Checklist

Before declaring implementation complete:

- [ ] Every task in § 5 execution order is marked done in this runbook.
- [ ] `pnpm lint` (or `npm run lint`) passes with zero errors.
- [ ] `pnpm build` passes on the Node runtime.
- [ ] `pnpm test` (Vitest) passes; all unit + integration + component tests green.
- [ ] `pnpm test:e2e` (Playwright) — at least the golden-path smoke green, OR explicitly note E2E deferred.
- [ ] No `client_secret` reachable from any client bundle (grep the `.next/static/` output for secret-like patterns; NFR-S-01 assertion).
- [ ] `.env.local` contains real `SITECORE_CLIENT_ID` / `SITECORE_CLIENT_SECRET`; `.env.local.example` documents the vars with placeholders only.
- [ ] Vercel preview URL tested inside a real Sitecore Pages editor iframe; successful screenshot captured; Copy + Download both work.
- [ ] Run logged in `.agent/skills/sitecore/marketplace-sdk/CATALOG.md` with patch candidates.

## 6. Risks To Watch During Implementation

Pulled from PRD § 13 (via task breakdown § 7):

- **R-2 OAuth setup friction.** If the automation client lacks the right scopes or the audience is wrong, every screenshot call 401s after one retry. Mitigation: follow `auth.md § 0` credential-acquisition protocol to the letter; log the tenant identifier (not the secret) on first successful auth.
- **R-1 Agent API latency.** Screenshot endpoint can take 2–10 s. Elapsed-time counter (FR-10) hides the wait. No artificial timeout shorter than Vercel's default.
- **R-3 Clipboard permission denial.** Graceful fallback to Download (AC-2.4). Test it — do not assume clipboard-always-works.
- **R-4 Iframe / cookie issues.** Cross-origin iframe with `SameSite=None; Secure`. Follow `marketplace-sdk/testing-debug.md`; test on Vercel preview before production registration.
- **R-6 Vercel env-var misconfig.** Wrong tenant secret in production env is silent-wrong. Log tenant identifier on first auth per NFR-O-01.
- **R-7 Dogfood-first-run reveals skill gaps.** **This is expected.** Every friction point encountered → patch candidate in the catalog (D3).

## 7. Completion Criteria

Implementation is complete when:

1. All tasks in § 5 task-breakdown execution order are implemented with passing RED → GREEN → REFACTOR cycles (TDD contract satisfied).
2. Verification checklist (§ 5 above) is fully checked.
3. The Vercel production custom-app registration in Cloud Portal points to the deployed production URL and loads correctly inside Sitecore Pages.
4. A real editor can click Capture and copy/download a clean page screenshot end-to-end (product success — M1 golden path).
5. The dogfood run is logged to the Marketplace SDK catalog with run metadata and any patch candidates classified (skill gap / command gap / external bug).

## 8. What Needs To Be Tested (global testing runbook)

Per task breakdown § 4b + § 10 + § 11. Used by `/test` for the comprehensive QA pass.

**Unit tests** (scope):
- `lib/sitecore-token.ts` — cache reuse within TTL, refresh inside 60 s safety margin, stampede protection (parallel first calls share one token fetch). Test IDs: T010a-TEST-1..6.
- Filename sanitization helper (`lib/filename.ts`) — kebab-case + ASCII-only + illegal-char replacement + truncation + collision behavior. Tests: T021a-TEST-1..6.
- State-machine reducer — state transitions for all documented events. Tests: T013a-TEST-1..6.
- Error-code mapping — 401/404/5xx/network/unknown → envelope codes. Tests: T011a-TEST-1..10.

**Integration tests** (scope):
- Route handler `app/api/screenshot/[pageId]/route.ts` — mocked Agent API responses (ok, 401 + refresh retry, 404, 5xx, timeout) via `mockFetch`. Assert response envelope shape, NFR-S-01 secret containment (no `client_secret` in response body), tenant-id logged on first success. Tests: T011a-TEST-1..10.

**UI / component tests** (scope):
- `ShutterButton` — enabled/disabled/capturing states, spring animation collapses under `prefers-reduced-motion`, visible focus ring, Enter/Space activation, aperture swap during capturing. Tests: T014a-TEST-1..6.
- `PolaroidCard` — preview + ledge content, error-in-polaroid variant, exact rose-600 tint on error title. Tests: T017a-TEST-1..5.
- `ActionPill` (Copy/Download/Retry) — state transitions, keyboard map. Tests: T018a-TEST-1..5.
- Elapsed-time controller — counter appears at 5 s, updates every second, stops on state change. Tests: T016a-TEST-1..4.
- LiveRegion announcer — correct ARIA text per transition (catalogued in § 4c-4). Tests: T023a-TEST-1..3.
- Keyboard + focus — Tab order (Capture → Copy → Download), auto-focus of Copy on ready, auto-focus of Retry on error. Tests: T024a-TEST-1..5.
- Copy-to-clipboard action — PNG blob write, confirmation bloom, denied fallback. Tests: T020a-TEST-1..4.

**E2E tests** (optional v1 nice-to-have, not blocking):
- Playwright smoke: panel loads → click shutter → mock server returns base64 → preview renders → Copy + Download fire.

**Regression**: full suite (unit + integration + component) must be green before `/ship`. E2E suite if present must be green on Vercel preview.

**Test commands** (established during T003/T004):
- `pnpm lint`
- `pnpm build`
- `pnpm test` (Vitest)
- `pnpm test:e2e` (Playwright; deferrable to post-v1)

## Handoff Metadata

- **Canonical run manifest:** `products/pageshot/project-planning/workflow/current-run.json`
- **Implementation target directory:** `products/pageshot/site/next-app/`
- **Recommended next command:** `/code-review` → `/test` → `/document` → `/ship`
- **Recommended next input file:** this runbook + the implementation code in the target directory
