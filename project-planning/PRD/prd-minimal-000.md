# PRD Minimal (execution orientation)

---
document_type: prd_minimal
artifact_name: prd-minimal-000.md
pairs_with_prd: project-planning/PRD/prd-000.md
generated_at: 2026-04-22T07:30:37Z
run_manifest: project-planning/workflow/run-20260422T073037Z.json
consumed_by:
  - Developer (08) under `/implement`
purpose: |
  Condensed north-star for implementation. Keeps token use low: agent 08 reads this plus
  the enriched task breakdown only — not the full PRD or architecture doc.
---

## Problem (one short paragraph)

Content editors in SitecoreAI Pages who need to share what they're working on (Slack, Teams, review threads) currently fall back to OS screenshot tools, manually crop out the Pages editor chrome, and end up with inconsistent-quality images — a multi-step context switch that happens multiple times per day.

## Goal (one short paragraph)

Add a one-button "Capture screenshot" control to Pages via a **Marketplace custom app** exposing a **Page Builder Context Panel**. The image is produced by the SitecoreAI **Agent API** `/screenshot` endpoint and the editor can copy it to clipboard or download as PNG without leaving the editor.

## Non-negotiables

- **Secrets never in browser.** `SITECORE_CLIENT_ID` / `SITECORE_CLIENT_SECRET` live only in server env; a Next.js route handler proxies the Agent API call. See **ADR-0002**.
- **SDK-first rule.** Page context comes from `@sitecore-marketplace-sdk/client` `pages.context` subscription — not from Agent API site/page lookups. Direct Agent API use is confined to the `/screenshot` call, which has no SDK wrapper.
- **Follow `auth.md § 0`** credential-acquisition protocol when setting up OAuth: ask user upfront, fall back to `.env.local`, leave blank + report if missing. Never invent placeholder credentials.
- **Stateless.** No database, no persisted images, no telemetry pipeline. Transient React state + server-memory token cache only.
- **Accessibility + keyboard operability** in v1 (a11y + `Tab`/`Enter`/`Space`).
- **HTTPS in all integrated environments** (Vercel preview + production). No local HTTPS certificate setup. See **ADR-0003**.
- **Error paths are first-class:** `401` → refresh+retry-once; `404` → "save first"; `5xx`/timeout → retryable error; offline → detected.

## In scope / out of scope (very short)

- **In scope:** One Page Context Panel. Capture button. Inline image preview. Copy-to-clipboard. Download-as-PNG (filename `{siteName}_{pageName}_{YYYYMMDD-HHmm}.png`). Loading state + elapsed counter after 5 s. Static "last saved version" hint. Custom-app registration in target tenant. Vercel deployment.
- **Out of scope:** annotations, cropping, history, batch capture, viewport selection, direct Slack/Teams integrations, public-app submission, local HTTPS setup.

## Success criteria

- Editor can capture → copy or download in ≤ 10 s on a healthy tenant (golden path).
- Captured image contains no editor chrome.
- All documented error cases produce an actionable inline message; user is never stranded.
- Clipboard-blocked state falls back cleanly to Download.
- Dogfood: the build runs end-to-end from the Sitecore skill chain with zero mid-run skill-file edits; any friction is logged in `.agent/skills/sitecore/marketplace-sdk/CATALOG.md`.

## Key constraints & assumptions

- Architecture: client-side iframe Marketplace app + one Next.js API route (server-side proxy). See **ADR-0002**.
- Hosting: Vercel; HTTPS via Vercel defaults; Vercel preview URLs are the integration-test surface. See **ADR-0003**.
- App type: **custom app** (single-tenant, no Marketplace submission).
- Auth: OAuth 2.0 client credentials per `.agent/skills/sitecore/apis/sitecoreai/auth.md` (audience `https://api.sitecorecloud.io`, 24 h token lifetime, server-memory cache with 60 s safety margin, single retry on `401`).
- API call: `GET https://edge-platform.sitecorecloud.io/stream/ai-agent-api/api/v1/pages/{pageId}/screenshot`.
- Tenant for registration: resolved at scaffold time (stakeholder has it ready).
- Viewport: endpoint default in v1; revisit if wrong viewport is produced.

## Handoff

- **Full PRD:** `project-planning/PRD/prd-000.md` (for humans and upstream agents only — not loaded by agent 08 in normal flow).
- **Executable contract:** `project-planning/plans/task-breakdown-<timestamp>.md` after QA (07) enrichment.
