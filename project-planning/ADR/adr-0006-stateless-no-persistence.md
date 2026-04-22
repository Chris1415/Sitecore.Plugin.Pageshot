# ADR-0006: Stateless app — no database, no persisted images, transient state only

## Status

Accepted

## Context

The v1 feature set (capture → preview → copy / download) does not require any data to survive a panel unmount or a deploy. Each capture is a fresh call to the Agent API; the returned image lives in React state and, if the user so chooses, in the browser clipboard or the user's downloads folder.

Introducing persistence — even a small KV store for "recent captures" — would add:

- A secret-management surface (KV connection strings).
- A lifecycle concern (what gets purged, when, by whom).
- A privacy question (who can read captures of pages marketers screenshot — are those pages ever sensitive?).
- A third API / infra to reason about during the dogfood run.

None of these earn their weight for v1.

## Decision

PageShot stores **no** persistent data. Specifically:

- **No database** (no Postgres, no KV, no Redis, no Blob, no external storage).
- **No captured-image persistence.** Once the panel unmounts or the user captures a new image, the previous one is gone from app state.
- **No telemetry pipeline.** Server-side logs stay in Vercel's default log stream per NFR-O-01; they are not exported to a data warehouse or analytics service.
- **In-memory token cache only.** The OAuth JWT lives in Node process memory per the `auth.md § 5` pattern — it survives in-process cache hits but is re-fetched on cold start. No Redis / KV promotion is made.

This applies to v1. Any future feature that needs persistence (capture history, user preferences, audit trail) comes in via a new ADR that supersedes or augments this one.

## Consequences

**Easier:**

- One fewer secret to manage, one fewer infra resource to provision.
- Cold-start behavior is predictable — first request pays the OAuth round-trip; subsequent requests reuse the cached token for up to 24 hours of process lifetime.
- Privacy posture is simple: nothing persists → nothing to leak from our side.
- Dogfood-run scope stays contained.

**Harder:**

- Each Vercel serverless invocation may cold-start with no cached token. In practice this is a ~200 ms penalty once; see `auth.md § 5` for the cache pattern. If multi-instance scaling makes this painful, the ADR to revisit is the token-cache one, not this one.
- Features like "recent captures" or "compare with yesterday's screenshot" are explicitly out of reach until a follow-on ADR introduces persistence.

**Follow-on commitment:**

- Any future feature requesting persistence must come with its own ADR that names the store, the data lifecycle, the secret surface, and the privacy implications. Don't retrofit state silently.

## Date

2026-04-22
