# Changelog

All notable changes to PageShot are recorded here.

## [PRD-000] — 2026-04-23

First release — end-to-end capture flow inside a real Sitecore Pages editor.

### Added

- **Page Builder Context Panel** at `/panel`, registered as a Sitecore Marketplace custom app extension. Loads inside Sitecore Pages via the iframe extension point.
- **Capture flow**. One-button capture of the current page via the SitecoreAI Agent API `/screenshot` endpoint. Chrome-free rendering — no editor toolbars or sidebars in the output.
- **Multi-viewport capture**. Editor selects Mobile (375 × N px) and/or Desktop (1200 × N px). Both selected → parallel captures, one polaroid per viewport stacked vertically.
- **Height presets**. Four options — Small (800 px), Medium (2 000 px), Large (4 000 px, default), Full (8 000 px) — cover short hero sections through long marketing pages.
- **Auto-trim**. Canvas-based detection of trailing solid-color padding, cropped client-side before display. Copy and Download ship the trimmed bytes. Graceful fallback on tainted canvas / missing canvas / ambiguous padding.
- **Expand / Collapse** per polaroid. Default preview capped at 420 px scroll; expanded view shows the full captured page inline.
- **Copy to clipboard**. Native `navigator.clipboard.write` with a `ClipboardItem` containing `image/png`. Graceful denied-fallback message when browser blocks clipboard-write permission.
- **Download as PNG**. Canonical `<a download>` synthesis with a structured filename: `{siteName}_{pageName}_{YYYYMMDD-HHmm}.png` (lower-kebab-case, ASCII-safe, truncated to ≤ 100 chars preserving the extension).
- **Open in new tab**. Immediate iframe-sandbox workaround — opens the blob URL via `window.open`, bypassing the host's missing `allow-downloads` sandbox flag.
- **Theme switcher**. Auto / Light / Dark modes in the panel header. Auto follows `prefers-color-scheme` and reacts live to system changes; Light and Dark force either theme. User choice persists in `localStorage`.
- **Blok design system**. Neutral Sitecore-native palette, semantic tokens (`bg-background`, `text-foreground`, `bg-primary`, `text-inverse-text`, `bg-muted`, `border-border`, `text-danger-fg`), dark-mode-aware via the `.dark` class applied on the panel root.
- **Accessibility**. WCAG 2.1 AA contrast; full keyboard operability (Tab order, Enter/Space on every pill, Escape refocuses the shutter); ARIA `role="status"` live region announces every state transition with a seven-entry catalogue (ready-to-capture, capturing, elapsed-at-5-s, screenshot-ready, copied, download-started, capture-failed by code); `prefers-reduced-motion` collapses the shutter press-spring, bloom, and aperture-spin animations.
- **Error states** in the same polaroid frame. Five mapped codes with distinct copy and icons — `auth`, `not_found`, `upstream_unavailable`, `network`, `unknown`. Offline short-circuit detects `navigator.onLine === false` before issuing a fetch.
- **OAuth client-credentials flow** with a server-side token cache. 24 h JWT lifetime with a 60 s safety margin; stampede protection via in-flight Promise; exactly-one refresh-retry on 401; tenant-id logged once per cold-cache fetch from inside `fetchFreshToken()`. Secrets (`SITECORE_DEPLOY_CLIENT_ID`, `SITECORE_DEPLOY_CLIENT_SECRET`) are Node-runtime-only; verified not present in the production client bundle.

### Deferred / Known limitations

- **Download action requires host sandbox fix.** Sitecore Pages' iframe sandbox does not currently include `allow-downloads`. The canonical `<a download>` click path will begin working automatically when Sitecore ships the fix (expected). Until then, use the Open action for the same result in a new browser tab.
- **Agent API height is exact.** The `/screenshot` endpoint has no `fullPage` toggle; `height` is the exact output image height. PageShot mitigates this with the Height picker and client-side auto-trim.
- **Single-tenant custom app.** Not submitted to the public Marketplace. Rolling out to a second tenant requires its own automation client + environment vars + custom-app registration.
