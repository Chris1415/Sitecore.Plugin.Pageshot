# ADR-0002: Client-side iframe Marketplace app with a thin Next.js server proxy

## Status

Accepted

## Context

PageShot's panel runs inside the Sitecore Pages iframe and needs to call the SitecoreAI Agent API `GET /api/v1/pages/{pageId}/screenshot`. The Agent API requires an OAuth 2.0 JWT obtained from a long-lived **`client_id` / `client_secret`** pair held by the Cloud-Portal-registered automation client.

A `client_secret` must never be delivered to a browser — doing so would effectively leak the credential to anyone who inspects the iframe's network traffic or bundle. Three architectures were considered:

1. **Client-side iframe only**, calling the Agent API directly from the browser with a token minted elsewhere. Rejected: there is no safe place to hold the secret that is still reachable from a pure client-side iframe.
2. **Full-stack app**, server-rendered pages on top of the Marketplace SDK. Rejected as over-scoped: PageShot has one UI (the panel) and one network call (the screenshot). Full-stack introduces routing, session, and SSR concerns we don't need.
3. **Client-side iframe + a single server-side route handler** in the same Next.js app, which holds the secret and proxies the one call we need. Accepted.

## Decision

PageShot is built as a **client-side iframe Marketplace custom app** (per `marketplace-sdk/lifecycle.md`'s "client-side iframe" architecture) **plus one Next.js API route handler** at `/api/screenshot/[pageId]`:

- The panel UI is pure client-side, loaded as an iframe by Sitecore Pages.
- Page context (`pageId`, `siteName`, `pageName`) comes from `@sitecore-marketplace-sdk/client`'s `pages.context` subscription.
- On Capture click, the panel calls **its own** server route (`/api/screenshot/[pageId]`) — it never calls `auth.sitecorecloud.io` or `edge-platform.sitecorecloud.io` directly from the browser.
- The route handler: (a) loads `SITECORE_DEPLOY_CLIENT_ID` / `SITECORE_DEPLOY_CLIENT_SECRET` from server env only, (b) obtains or reuses a cached JWT per the token-cache pattern in `.agent/skills/sitecore/apis/sitecoreai/auth.md § 5`, (c) calls the Agent API with the bearer token, (d) returns the base64 image or an error envelope.
- The route runs on the **Node runtime** (not Edge), because `node:crypto` and server-memory caching are both simpler there, and the screenshot endpoint's latency makes edge-runtime benefits irrelevant.

## Consequences

**Easier:**

- Secrets stay server-side. Zero risk of leaking `client_secret` to the browser.
- A single token cache serves all calls, avoiding repeat OAuth round-trips and respecting the 24 h token lifetime.
- `401` retry logic lives in one place, not duplicated in client code.
- The client-side code matches the Marketplace SDK's primary architecture (`marketplace-sdk/lifecycle.md`), so we inherit its iframe / cookie / CSP defaults.
- Observability is simpler — the server route is the one place all Agent API calls flow through; structured logs go there.

**Harder:**

- The app is no longer deployable as pure static assets. A Node runtime is required. Vercel handles this transparently, but any future move to a static-only host would need a rework.
- Two code paths to reason about: the iframe client and the Node route. For PageShot this is one small file each, so the cost is low, but the pattern must be re-applied for every new API call that needs a secret.
- The server route is the trust boundary. If it's misconfigured (wrong tenant secret in prod env, missing scope), the app fails with the same symptom as a bad client — admin-actionable but easy to misdiagnose. Mitigated by logging the tenant identifier (not the secret) on first successful auth.

**Follow-on commitment:**

- Any future feature in PageShot that needs a Sitecore API call goes through the same pattern: one server route per call, token reused from the shared cache. Direct-from-browser Sitecore API calls are forbidden by this ADR.

## Date

2026-04-22
