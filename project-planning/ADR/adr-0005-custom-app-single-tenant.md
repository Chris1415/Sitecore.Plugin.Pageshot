# ADR-0005: Custom app registration (single-tenant, no Marketplace submission) for v1

## Status

Accepted

## Context

The Sitecore Marketplace supports two registration modes for an app:

- **Custom app** — registered in Cloud Portal by an organization for that organization's own tenant(s). Visible only to that organization's users. No submission, no review, no listing on the public Marketplace.
- **Public app** — published to the Sitecore Marketplace, discoverable by any Sitecore customer, subject to Sitecore's review and submission process.

PageShot's v1 purpose is a dogfood of the agentic framework + a practical tool for a specific set of editors on a specific tenant. It is explicitly not a product we are bringing to market.

## Decision

PageShot is registered as a **custom app** in the owning organization's Cloud Portal for v1. It is **not** submitted to the public Marketplace.

Two custom-app registrations are expected:

- A **test** custom app whose extension URL points to whichever Vercel preview deployment is currently being tested (rotated per-branch as needed — see ADR-0003).
- A **production** custom app whose extension URL points to the Vercel production deployment.

## Consequences

**Easier:**

- No public-review cycle, no submission overhead, no third-party-install UX to design.
- Iteration speed is unconstrained — what Vercel deploys, the custom app sees.
- Security posture is simpler — the OAuth automation client is scoped to one tenant and managed by one organization.

**Harder:**

- Every new tenant that wants PageShot must configure its own custom-app registration + automation client + Vercel env vars. There is no "install from Marketplace" flow.
- The decision to promote to a public app is a separate project (rebranding, submission prep, docs, support). ADR-0005 is not a commitment to that path.

**Follow-on commitment:**

- If PageShot ever goes public, that becomes a new ADR superseding this one — not an implicit promotion.

## Date

2026-04-22
