# Decisions

Curated summary of every Architecture Decision Record (ADR) in PageShot. Each row links to the full ADR for context, consequences, and date. Grouped by theme — read top-to-bottom for the reasoning arc from process through architecture through operations.

## Process

| ADR | Title | Status | Rationale |
|---|---|---|---|
| [ADR-0001](../project-planning/ADR/adr-0001-use-adrs-as-architecture-backbone.md) | Use ADRs as architecture backbone | Accepted | One decision per file, numbered sequentially; architectural choices are recoverable years later by reading the ADR log instead of excavating commits. |

## Architecture

| ADR | Title | Status | Rationale |
|---|---|---|---|
| [ADR-0002](../project-planning/ADR/adr-0002-client-iframe-with-server-proxy.md) | Client-side iframe with a thin Next.js server proxy | Accepted | The Agent API needs a `client_secret`, which cannot live in the browser. A thin Node route handler holds the secret and proxies the one call the panel needs — minimum surface to stay safe. |
| [ADR-0004](../project-planning/ADR/adr-0004-nextjs-app-router-node-runtime.md) | Next.js (App Router) on Node runtime | Accepted | Aligns with the Marketplace scaffold's default stack; Node runtime is required for `node:crypto`, the server-memory token cache, and standard Buffer APIs. Edge-runtime cold-start savings are irrelevant next to the Agent API's 2–10 s upstream latency. |
| [ADR-0006](../project-planning/ADR/adr-0006-stateless-no-persistence.md) | Stateless — no database, no persisted images | Accepted | v1 does not need persistence. Captures are transient (React state + user's clipboard or downloads). OAuth token cache stays in Node process memory. Any future persistence requirement comes with a superseding ADR. |

## Operations

| ADR | Title | Status | Rationale |
|---|---|---|---|
| [ADR-0003](../project-planning/ADR/adr-0003-no-local-https-vercel-previews-as-integration-surface.md) | No local HTTPS; Vercel preview URLs are the integration-test surface | Accepted | Sitecore Pages loads the panel over HTTPS; a local self-signed cert is onboarding friction per machine. Vercel previews are HTTPS by default — use those for portal-connected testing. Local dev stays on plain HTTP for UI iteration. |
| [ADR-0005](../project-planning/ADR/adr-0005-custom-app-single-tenant.md) | Custom app registration (single-tenant, no Marketplace submission) for v1 | Accepted | Zero submission overhead, unconstrained iteration, tenant-scoped credential and scope management. Promotion to the public Marketplace is a later project with its own ADR. |
