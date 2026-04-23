# ADR-0004: Next.js (App Router) on Node runtime for the Marketplace app

## Status

Accepted

## Context

PageShot is a Marketplace custom app that ships two code paths in one deployment (per ADR-0002):

1. A client-side iframe UI (the Page Builder Context Panel).
2. A thin server-side route handler that proxies one SitecoreAI Agent API call while holding the OAuth `client_secret`.

Both paths must co-exist in a single deployable hosted on Vercel (per ADR-0003). Candidate frameworks considered:

- **Next.js (App Router)** — first-class Vercel support; native route handlers that can run on either Edge or Node runtime; modern React (server + client components); zero additional wiring for the "client UI + tiny server API" shape this app needs.
- **Vite + a separate Node server** (Express/Fastify/Hono) — more moving parts, two deploy targets on Vercel, no meaningful benefit for this app's scope.
- **Remix** — similar shape to Next.js App Router but less aligned with the Marketplace-starter ecosystem Sitecore provides.

For the route handler runtime:

- **Edge runtime** — faster cold starts, but has limitations on `node:` APIs and the streaming/blob handling for the Agent API's base64 image response adds no benefit; the screenshot endpoint's 2–10 s upstream latency dwarfs any cold-start savings.
- **Node runtime** — full API surface (including `node:crypto` and standard `fetch`), simpler server-memory token cache, no incidental edge-runtime quirks to debug during the dogfood run.

## Decision

PageShot is built with **Next.js 15+ (App Router)** using **TypeScript** and **React 19** on the **Node runtime** for all route handlers.

Concretely:

- One Next.js app at `products/pageshot/site/` (or wherever the scaffold lands), App Router layout.
- Client component at the panel route (`app/panel/page.tsx`) loaded inside the Sitecore Pages iframe.
- Route handler at `app/api/screenshot/[pageId]/route.ts` with `export const runtime = "nodejs"`.
- Strict TypeScript (`strict: true`, `noUncheckedIndexedAccess: true`).
- Tailwind CSS for styling (matches Marketplace starter defaults; no bespoke styling framework).
- ESLint flat config + Prettier with Next.js recommended presets.

## Consequences

**Easier:**

- Vercel deployment is one command; preview URLs are automatic per-branch.
- Route handler and client component live in one repo, one `package.json`, one lockfile.
- The Marketplace starter (`Sitecore/marketplace-starter`) is itself a Next.js app — following the same stack means we can lean on its scaffold patterns directly.
- TypeScript types flow from the server envelope (`ScreenshotResponse`) to the client consumer without a separate contract package.

**Harder:**

- Tied to Vercel's Node runtime constraints (no deploying this exact app to a static-only host without reworking the route handler).
- Next.js major-version upgrades (14 → 15 → …) periodically require migration work; App Router conventions continue to evolve.
- Tailwind is an opinionated choice — a future contributor who prefers a different styling approach has to either live with it or refactor.

**Follow-on commitment:**

- All route handlers added to PageShot over time must stay on Node runtime unless a concrete reason to migrate to Edge appears (and that reason is recorded in a superseding ADR).
- Stack upgrades are handled as their own ADRs when they cross a major version boundary.

## Date

2026-04-22
