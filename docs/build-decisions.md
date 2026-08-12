# Build decisions — PageShot

Why this code is shaped the way it is, at component grain. Source files link here
instead of carrying the reasoning inline (rule `87-comment-economy`).

Architecture decisions live in `../project-planning/ADR/`.

Anchors are a contract — source comments point at them. Never rename one; supersede it.

> **Provenance.** Harvested 2026-08-12 from source-file header comments (303 lines, 10 blocks).

---

### The screenshot route is Node runtime, not Edge {#node-runtime}

**Decision.** `/api/screenshot/[pageId]` runs on the **Node** runtime.

**Why.** The shared OAuth token cache relies on **module-scope state**, which only Node's
long-lived server instances preserve. Edge would silently re-authenticate on every request.

**Order of operations matters:** `pageId` is validated (trimmed, non-empty) **before** touching
any upstream, and env validation happens inside `getSitecoreToken()` — a missing credential
raises a config error **without issuing any network request**.

**On upstream 401: invalidate the cached token, refetch, retry EXACTLY ONCE.** A second 401
maps to the `auth` error code with the admin-credentials subtitle rather than looping.

**The route never logs the bearer token or client secret.** Tenant-identifier logging happens
inside the token module, only on a fresh cold-cache fetch.

**Every upstream outcome maps to one envelope** — 200 → `{ ok: true, image }` (bare base64, **no
data-URL wrapping**); 404 → `not_found` with the save-first subtitle; 5xx →
`upstream_unavailable`; double 401 → `auth`; a fetch `TypeError` → `network`; abort/unknown →
`upstream_unavailable` / `unknown`.

### Trim the padding client-side, because the API has no `fullPage` toggle {#trim-image}

**Decision.** A client-side auto-trim strips trailing single-colour padding from the returned PNG.

**Why it exists.** The Agent API's `/screenshot` endpoint has **no `fullPage=true` toggle** —
`height` is the exact output-image height, and shorter pages get padded at the bottom with the
site's background colour. Picking a "big enough" preset reliably captures the whole page but
produces a long strip of padding.

**The algorithm refuses to guess.** It samples the bottom-left and bottom-right pixels; if they
do not match within tolerance there is no obvious single-colour padding and the **original image
is returned untouched**. Otherwise it scans rows bottom-to-top, ~20 sample points per row, and
the first row containing an off-colour pixel is the last content row.

**Two safety guards keep it from over-trimming** a page with a genuinely solid-colour bottom
section (a footer with a CTA on a uniform background): the trim must exceed **2% of height**, and
the trimmed result must stay **≥ 100px**. With no canvas context (SSR, test env) it returns the
original base64 unchanged — **it never throws**.

### Copy failure is sticky for the session {#copy-denied-sticky}

**Decision.** `useCopyImage` exposes `{ available, status, deniedMessage, copy }`. A permission
denial flips status to `denied` **with no auto-revert** — sticky for the session. Success flips
to `copied` for 1.8s, then back to idle.

**`available` is false at mount when `ClipboardItem` is `undefined`** (old browsers, locked-down
contexts), so the parent disables Copy **from the outset** rather than letting the user press a
button that cannot work. `copy()` is a no-op in that case.

**`deniedMessage` is exposed regardless of current status** — a stable literal ("Clipboard
access was blocked. Use Download instead.") so parents render it by conditioning on
`denied || unsupported` rather than reaching for their own string.

**The test asserts PNG magic bytes**, not just that a blob was written: the first 8 bytes must
be `89 50 4E 47 0D 0A 1A 0A`.

**Deliberately plain `useState` + `useEffect`**, not React 19's `use()` — so the reducer is easy
to reason about under fake timers.

### The elapsed-time hook returns `null` below the threshold {#elapsed-threshold}

**Decision.** `useElapsedTime(startedAt)` returns `null` until 5 seconds have passed, then the
integer seconds. **Below the threshold the sub-line is not rendered at all** — there is no "0
seconds" state.

**A null `startedAt` installs no timer** and returns immediately.

**No `Date.now()` at render time.** The interval callback computes elapsed and calls the state
setter; render is a pure read.

### Invalid state transitions return the same reference {#state-machine-noop}

**Decision.** The panel reducer treats invalid transitions as no-ops **returning the identical
state reference**, so React's bail-out short-circuits the re-render.

**`ready` carries an array of captures**, one per requested viewport — the single-viewport case
is a length-1 array. **A failure drops any in-flight partial captures**; Retry re-runs the whole
set rather than stitching a partial result.

---

## Accessibility contracts

### One polite live region, most-recent-wins {#live-region}

**Decision.** A single `sr-only` `<div role="status" aria-live="polite">` at panel root receives
every announcement. A second `announce()` **replaces** the previous message — assistive tech
announces changes, not accumulation.

**Polite, not assertive**, because the panel's actions are never blocking, so messages should
queue after the current utterance.

**The seven catalogue entries are exact strings**, table-tested against the prescribed wording:
"Ready to capture." / "Capturing started." / "Still capturing, N seconds." / "Screenshot ready."
/ "Copied to clipboard." / "Download started." / "Capture failed: `<title>`. `<subtitle>`."
Builders substitute their parameter into the template using the error-code → title/subtitle
lookup the card already exports, rather than a second copy of those strings.

### The focus map is a contract, not a nicety {#focus-map}

**Decision.** Focus moves are explicit and tested: the Shutter is `document.activeElement` after
the first non-null page context; `capturing → ready` moves focus to Copy **with
`{ preventScroll: true }`**; `capturing → error` moves focus to Retry; Escape anywhere in the
panel returns focus to the Shutter; and tab order equals DOM order.

**The integration suite renders inside the real provider**, so the production context path is
exercised — the SDK client is mocked at the module boundary and the `pages.context`
subscription's `onSuccess` callback is captured and invoked per test.

**T024a tests were kept isolated from the later golden-path scenarios** deliberately, to produce
a clean RED → GREEN → INTEGRATION history rather than one file that was never red.

### Filenames are sanitised, length-bounded, and local-time {#filename}

**Decision.** `buildScreenshotFilename(siteName, pageName, capturedAt)` lowercases both slugs,
replaces every run of non-`[a-z0-9_-]` with a single `-`, trims leading/trailing dashes, and
assembles `${site}_${page}_${YYYYMMDD}-${HHmm}.png` using **local time, not UTC**.

**Over 100 characters, both slugs truncate proportionally** — each keeps at least one character,
and the timestamp suffix plus `.png` extension are always preserved.

**Minute granularity means two captures in the same minute collide by design** — asserted, not
accidental.
