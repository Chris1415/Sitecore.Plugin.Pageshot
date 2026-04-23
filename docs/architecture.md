# Architecture

A narrative overview of how PageShot is put together. For the full reasoning behind each decision, follow the ADR links in [`decisions.md`](./decisions.md).

## System overview

PageShot bridges three runtimes: a **browser panel** loaded inside the Sitecore Pages editor iframe, a **Node-runtime route handler** that proxies credentials-bearing API calls, and the **SitecoreAI Agent API** that actually renders the page screenshot server-side. The three layers have one strict separation: the OAuth `client_id` and `client_secret` live only in the Node runtime — they never reach the browser bundle.

## Three-layer component map

### 1. Panel UI (browser, client-side iframe)

Runs entirely in the browser inside the Sitecore Pages iframe extension point.

- **`MarketplaceProvider`** initializes `@sitecore-marketplace-sdk/client`, subscribes to `pages.context`, and exposes `pageId` / `siteName` / `pageName` via `usePagesContext()`.
- **`PageshotPanel`** composes the full UI: theme switcher, viewport and height toggles, the hero shutter, one or more polaroid capture blocks, action pills (Copy / Download / Open), the inline "clipboard denied" message, and the screen-reader-only live region.
- **Hooks** own their own state: `usePanelState` drives the capture state machine; `useCopyImage`, `useDownloadImage`, `useOpenImage` each wrap one user action; `useElapsedTime` emits the "still capturing" seconds after the 5-second threshold; `useThemeMode` resolves `auto` / `light` / `dark` and persists to `localStorage`.
- **Components** (`Shutter`, `PolaroidCard`, `ActionPill`, `InlineMessage`, `ViewportToggle`, `HeightToggle`, `ThemeToggle`, `LiveRegion`) are Blok-tokened, single-purpose, and keyboard-accessible.

### 2. Server route handler (Node runtime)

One route: `app/api/screenshot/[pageId]/route.ts`. Responsibilities:

- Validate the `pageId` path param (non-empty after trim; otherwise `not_found`).
- Parse `viewport=mobile|desktop` and `height=small|medium|large|full` query params to resolve width and output height.
- Call `getSitecoreToken()` from `lib/sitecore-token.ts` — module-scoped cache, 60 s safety margin, stampede-protected via an in-flight `Promise`.
- `GET https://edge-platform.sitecorecloud.io/stream/ai-agent-api/api/v1/pages/{pageId}/screenshot?version=1&width=…&height=…` with `Authorization: Bearer <jwt>`.
- On `401`, call `invalidateSitecoreToken()`, refetch, retry the Agent API call **exactly once**. On a second `401`, return the `auth` envelope.
- Map outcomes to a discriminated-union envelope: `{ ok: true, image }` on success, `{ ok: false, error: { code, message } }` for `auth | not_found | upstream_unavailable | network | unknown`.
- Log the tenant identifier (`sub` claim, Auth0 convention `<client_id>@clients`) on each cold-cache token fetch from inside `fetchFreshToken` — never from the route handler (the route has no way to distinguish cold-cache from warm-cache).

### 3. SitecoreAI Agent API (upstream)

The `/screenshot` endpoint renders the page server-side and returns a base64 PNG. Required query params — **discovered empirically during the PageShot build, not covered by the public API reference at the time of writing**:

- `version` — **required integer**. Current implementation passes `1`.
- `width` — viewport width in px (also the output image width).
- `height` — **exact** output image height. No `fullPage` toggle exists; the `fullPage: true` field in the response body is informational only.
- Response body: `{ type, fullPage, encoding, timestamp, screenshot_base64 }`. The base64 lives in `screenshot_base64`, not `image`.

## Data flow

End-to-end capture request:

1. Editor opens the Page Builder Context Panel. Sitecore Pages loads `/panel` in the iframe and passes query-string context (`organizationId`, `marketplaceAppTenantId`).
2. `MarketplaceProvider` calls `ClientSDK.init()`, subscribes to `pages.context`, and populates `{ pageId, siteName, pageName }`.
3. Editor picks viewport(s) and height preset, clicks Capture.
4. `<PageshotPanel>` dispatches `capture` to the state machine, fires one `fetch('/api/screenshot/{pageId}?viewport=…&height=…')` per selected viewport in parallel.
5. Route handler resolves the Agent API request, attaches a cached bearer token, calls the upstream API. If `401`, it refreshes once and retries.
6. Agent API returns the full-page PNG at the requested width × height.
7. Route handler extracts `screenshot_base64` and returns `{ ok: true, image }` to the panel.
8. Panel runs each returned PNG through `trimBottomPadding` (canvas-based whitespace trim). On success, dispatches `resolved` with an array of captures.
9. State machine transitions to `ready`; `<PageshotPanel>` renders one `<CaptureBlock>` per capture. Focus moves to the first Copy pill; the live region announces "Screenshot ready."
10. Editor clicks Copy → `navigator.clipboard.write` with PNG `ClipboardItem`. Or Download → canonical `<a download>` click (pending host sandbox fix). Or Open → `window.open` on the blob URL in a new tab.
11. Each action fires its own live-region announcement. Copy and Download flip to a transient success state for 1.8 s / 1.4 s, then revert.

## Technology choices

### Client-side iframe + thin server proxy — [ADR-0002](../project-planning/ADR/adr-0002-client-iframe-with-server-proxy.md)

A full-stack SSR app would be over-scoped for a single UI + single upstream call. A pure client-side iframe would leak the `client_secret`. The thin proxy pattern is the minimum surface that keeps the secret server-side.

### No local HTTPS — [ADR-0003](../project-planning/ADR/adr-0003-no-local-https-vercel-previews-as-integration-surface.md)

Integration-test the panel on Vercel preview URLs (HTTPS by default). Local dev runs on plain HTTP for UI iteration. Avoids per-machine certificate management.

### Next.js (App Router) on Node runtime — [ADR-0004](../project-planning/ADR/adr-0004-nextjs-app-router-node-runtime.md)

Aligns with the Sitecore Marketplace scaffold's own choice. Node runtime is required for `node:crypto`, the module-scoped token cache, and the Buffer APIs the JWT decoder uses. Edge runtime's cold-start savings are irrelevant given the Agent API's 2–10 s upstream latency.

### Custom app, not public Marketplace — [ADR-0005](../project-planning/ADR/adr-0005-custom-app-single-tenant.md)

Zero submission overhead, unconstrained iteration, single-tenant scope. Promotion to public Marketplace is a separate project with its own ADR.

### Stateless — [ADR-0006](../project-planning/ADR/adr-0006-stateless-no-persistence.md)

No database, no persisted images, no telemetry pipeline. Captures live in React state for the session and in the user's clipboard or downloads folder. The OAuth token cache is module-scoped in the Node process — never promoted to Redis or a KV store.

## Accessibility

- **WCAG 2.1 AA** contrast via Blok semantic tokens under both light and dark themes.
- **Keyboard operability** on every interactive element. Tab order is DOM order (Shutter → Copy → Download → Open in ready state; Shutter → Retry in error state). Enter and Space activate the focused button. Escape refocuses the shutter.
- **ARIA live region** (`role="status"`, `aria-live="polite"`) announces every state transition. Catalogue has seven entries: ready-to-capture, capturing, still-capturing (N seconds, once per second past the 5-second threshold), screenshot-ready, copied, download-started, capture-failed (five per-code variants).
- **`prefers-reduced-motion`** collapses the shutter press-spring, capture bloom, and aperture spin. Click and keyboard behavior is unchanged.
- **Auto-focus on state change**. Ready state → focus moves to first Copy pill with `preventScroll: true`. Error state → focus moves to Retry pill.

## Theming

The panel applies `.dark` to its root `<main>` element when `useThemeMode` resolves to dark. Blok's Tailwind v4 `@custom-variant dark (&:is(.dark *))` picks up the class and swaps every semantic token's dark-variant value. Every surface uses tokens (`bg-background`, `text-foreground`, `bg-primary`, `text-inverse-text`, `bg-muted`, `border-border`, `text-danger-fg`), so no per-component dark-mode logic is needed.

## Testing

- **151 automated tests** across 18 files — unit, hook, component, and integration.
- **Full TDD trail** — every behavior landed as a RED commit (failing test) followed by a GREEN commit (implementation) on the `prd-000` branch.
- **NFR-S-01 secret containment** is a build-time check in the test matrix: the route handler never echoes `client_secret` or the bearer token into response bodies, and grep of the production `.next/static/` bundle returns zero matches for `SITECORE_DEPLOY_*` or the literal client-id value.
- **Playwright E2E** is installed but smoke-level; full end-to-end validation happens interactively on Vercel preview URLs inside a real Sitecore Pages editor.
