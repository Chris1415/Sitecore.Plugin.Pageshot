# ADR-0003: No local HTTPS; Vercel preview URLs are the integration-test surface

## Status

Accepted

## Context

Sitecore Pages loads Marketplace extension points inside HTTPS iframes and sets cookies with `SameSite=None; Secure`, so any extension URL must be HTTPS-served. The Marketplace SDK testing guide describes two paths for local development:

1. **Local HTTPS with a self-signed or mkcert-issued certificate**, so `https://localhost:3000` can be registered as an extension URL and tested inside the real Pages editor.
2. **Deploy-preview URLs**, where the dev loop pushes to a branch and tests against a Vercel preview (HTTPS by default), without running HTTPS locally.

Setting up local HTTPS with a trusted certificate is time-consuming on a fresh Windows dev environment and is a frequent source of Marketplace-app onboarding friction — not because it's technically hard, but because each dev/browser combination has its own quirks.

## Decision

**PageShot's integration-test surface is Vercel preview URLs.** Local HTTPS is explicitly not set up:

- **Local dev** runs on plain HTTP (`http://localhost:3000`) and is used only for iteration on panel UI that does **not** require the Marketplace iframe — component work, state-machine work, styling.
- **Integration testing inside the real Pages editor** happens on Vercel previews. Each push to a branch produces a preview URL (`https://pageshot-<branch>-<team>.vercel.app`). That URL is registered as the extension URL in a **test custom app** in Cloud Portal.
- **Production** is the Vercel production URL registered in the **production custom app**.
- The Marketplace SDK's `isDevelopment` / mock-mode flag may be used for pure-UI iteration locally, but any test that must exercise `pages.context` from the real editor runs on a preview URL.

## Consequences

**Easier:**

- No certificate management, no per-machine trust-store fiddling, no HSTS surprises.
- Preview URLs are also the review surface — reviewers can test a PR branch by opening Pages and pointing the test custom app at the preview URL.
- HTTPS is guaranteed by Vercel for every preview; no risk of a misconfigured cert blocking the iframe.

**Harder:**

- Dev loop for anything that requires real Pages iframe context has a Vercel-deploy step (~30 s per push). Not suitable for tight inner-loop iteration on iframe-dependent behavior.
- Anything that must work offline or without a Vercel deployment (rare for this app) cannot be fully tested locally.
- Requires a dedicated "test custom app" in Cloud Portal whose URL is rotated between preview deployments, or re-registered per branch. The rotation cost is low for a one-person dev loop but scales poorly for a team.

**Follow-on commitment:**

- The implementation runbook must document how to rotate the test custom app's URL when a new preview URL appears (or how to use a stable preview alias).
- If a future feature's dev loop makes the preview-deploy latency painful, revisit this ADR and add local HTTPS.

## Date

2026-04-22
