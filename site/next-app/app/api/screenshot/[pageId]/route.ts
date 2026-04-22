/**
 * `/api/screenshot/[pageId]` — server-side proxy for the SitecoreAI Agent API
 * page-screenshot endpoint.
 *
 * Contracts (see task-breakdown § 4c-6 / § 4c-4 / FR-06 / FR-07 / FR-13 /
 * NFR-S-01 / R-6 and the T011a test suite):
 *
 *   - Node runtime (ADR-0004). Edge runtime is NOT supported because the
 *     shared OAuth token cache in `@/lib/sitecore-token` relies on module-scope
 *     state that only Node's long-lived server instances preserve.
 *   - Validates `pageId` (trimmed non-empty) before touching any upstream.
 *   - Validates env (`SITECORE_DEPLOY_CLIENT_ID` / `SITECORE_DEPLOY_CLIENT_SECRET`)
 *     via `getSitecoreToken()` — a missing env raises `SitecoreTokenConfigError`
 *     without issuing any network request (FR-13 / T011a-TEST-7).
 *   - Tenant identifier logging happens INSIDE `lib/sitecore-token.ts` on every
 *     fresh cold-cache fetch (§ 4c-6 "on first successful auth"). The route
 *     never logs the bearer token or client secret (NFR-S-01 / R-6).
 *   - On upstream 401, invalidates the cached token, refetches, and retries the
 *     Agent API request EXACTLY ONCE (auth.md § 6 / FR-06).
 *   - Maps upstream outcomes to the `ScreenshotResponse` envelope:
 *       200 → `{ ok: true, image }` (bare base64 — no data-URL wrapping).
 *       404 → `{ code: 'not_found' }` with the save-first subtitle.
 *       5xx → `{ code: 'upstream_unavailable' }`.
 *       double 401 → `{ code: 'auth' }` with the admin-credentials subtitle.
 *       fetch TypeError → `{ code: 'network' }`.
 *       AbortError / unknown → `{ code: 'upstream_unavailable' | 'unknown' }`.
 */

import {
  getSitecoreToken,
  invalidateSitecoreToken,
  SitecoreTokenConfigError,
} from '@/lib/sitecore-token';

export const runtime = 'nodejs';

const AGENT_BASE =
  'https://edge-platform.sitecorecloud.io/stream/ai-agent-api/api/v1/pages';

type ErrorCode =
  | 'auth'
  | 'not_found'
  | 'upstream_unavailable'
  | 'network'
  | 'unknown';

type ScreenshotResponse =
  | { ok: true; image: string }
  | { ok: false; error: { code: ErrorCode; message: string } };

/** Error-copy catalogue — literal strings from task-breakdown § 4c-4. */
const ERROR_COPY: Record<ErrorCode, string> = {
  auth: "Ask your administrator to check the app's credentials.",
  not_found: 'Save the page first, then try again.',
  upstream_unavailable: 'Try again in a moment.',
  network: 'Check your connection, then try again.',
  unknown: 'Try again in a moment.',
};

/** Distinct copy for the missing-env / un-configured-credentials case (FR-13). */
const ADMIN_MUST_CONFIGURE = 'Administrator must configure credentials.';

function json(body: ScreenshotResponse, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function errorEnvelope(
  code: ErrorCode,
  status: number,
  messageOverride?: string,
): Response {
  return json(
    {
      ok: false,
      error: { code, message: messageOverride ?? ERROR_COPY[code] },
    },
    status,
  );
}

/**
 * Viewport presets — translate the client's `viewport=mobile|desktop` query
 * param into the Agent API's `width` + `height` query params.
 *
 * Redeclared here rather than imported from `components/ViewportToggle.tsx`:
 * that file carries `'use client'` and pulls React into its module graph;
 * the Node-runtime route handler must not depend on it.
 */
const VIEWPORT_PRESETS = {
  mobile: { width: 375, height: 812 },
  desktop: { width: 1200, height: 800 },
} as const;

function resolveViewportDims(raw: string | null): {
  width: number;
  height: number;
} {
  if (raw === 'mobile') return VIEWPORT_PRESETS.mobile;
  // desktop is the default — applies on missing, unknown, or explicit "desktop".
  return VIEWPORT_PRESETS.desktop;
}

async function callAgentApi(
  pageId: string,
  token: string,
  dims: { width: number; height: number },
): Promise<Response> {
  // Agent API `/screenshot` query params (per OpenAPI bundle):
  //   version:  required integer — content version to render (using 1 until
  //             we surface a version selector; see dogfood friction log).
  //   width:    rendered viewport width in pixels (default 1200).
  //   height:   rendered viewport height in pixels (default 800).
  //   language: locale code (default 'en') — not exposed in v1.
  // Response shape: { type, fullPage, encoding, timestamp, screenshot_base64 }.
  // Both of these (the response field name + `version` being required) are
  // undocumented in the current agent-api.md skill — dogfood patch candidates.
  const qs = new URLSearchParams({
    version: '1',
    width: String(dims.width),
    height: String(dims.height),
  });
  const url = `${AGENT_BASE}/${encodeURIComponent(pageId)}/screenshot?${qs}`;
  return fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });
}

interface AgentScreenshotOk {
  // Agent API actual response shape (discovered during T029 dogfood):
  //   { type: "png", fullPage: true, encoding: "base64",
  //     timestamp: "...", screenshot_base64: "..." }
  // NOT documented in skills/sitecore/apis/sitecoreai/agent-api.md — pending patch.
  screenshot_base64: string;
}

function isAgentScreenshotOk(value: unknown): value is AgentScreenshotOk {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { screenshot_base64?: unknown }).screenshot_base64 ===
      'string'
  );
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ pageId: string }> },
): Promise<Response> {
  const { pageId: rawPageId } = await ctx.params;
  const pageId = typeof rawPageId === 'string' ? rawPageId.trim() : '';
  if (!pageId) {
    // Empty or whitespace-only pageId: no upstream call (T011a-TEST-8).
    return errorEnvelope('not_found', 400);
  }

  // Parse viewport preset from the request query string. Unknown / missing
  // → desktop default (1200x800).
  const viewport = new URL(req.url).searchParams.get('viewport');
  const dims = resolveViewportDims(viewport);

  // Obtain a token up front. A missing env raises SitecoreTokenConfigError
  // from the cache WITHOUT issuing any network request (FR-13 / T011a-TEST-7).
  let token: string;
  try {
    token = await getSitecoreToken();
  } catch (err) {
    if (err instanceof SitecoreTokenConfigError) {
      return errorEnvelope('auth', 500, ADMIN_MUST_CONFIGURE);
    }
    // Any other failure from the token endpoint → upstream_unavailable.
    return errorEnvelope('upstream_unavailable', 500);
  }

  // First Agent API attempt.
  let upstream: Response;
  try {
    upstream = await callAgentApi(pageId, token, dims);
  } catch (err) {
    return mapFetchRejection(err);
  }

  // 401 → invalidate, refetch token, retry EXACTLY ONCE (auth.md § 6 / FR-06).
  // If the retry also fails with 401, surface the `auth` envelope. No third try.
  if (upstream.status === 401) {
    invalidateSitecoreToken();
    let retryToken: string;
    try {
      retryToken = await getSitecoreToken();
    } catch (err) {
      if (err instanceof SitecoreTokenConfigError) {
        return errorEnvelope('auth', 500, ADMIN_MUST_CONFIGURE);
      }
      return errorEnvelope('upstream_unavailable', 500);
    }

    try {
      upstream = await callAgentApi(pageId, retryToken, dims);
    } catch (err) {
      return mapFetchRejection(err);
    }

    if (upstream.status === 401) {
      // Second 401 → auth envelope. Do not retry again (exactly one retry).
      return errorEnvelope('auth', 500);
    }
  }

  return mapUpstreamStatus(upstream);
}

async function mapUpstreamStatus(upstream: Response): Promise<Response> {
  if (upstream.ok) {
    let parsed: unknown;
    try {
      parsed = await upstream.json();
    } catch {
      return errorEnvelope('upstream_unavailable', 500);
    }
    if (!isAgentScreenshotOk(parsed)) {
      return errorEnvelope('upstream_unavailable', 500);
    }
    return json({ ok: true, image: parsed.screenshot_base64 }, 200);
  }

  if (upstream.status === 404) {
    return errorEnvelope('not_found', 404);
  }

  if (upstream.status >= 500 && upstream.status < 600) {
    return errorEnvelope('upstream_unavailable', 500);
  }

  // Any other non-ok status (e.g. 400, 403) → unknown. We deliberately do
  // NOT echo the upstream body to avoid leaking any incidental secrets.
  return errorEnvelope('unknown', 500);
}

function mapFetchRejection(err: unknown): Response {
  // TypeError from `fetch` = network-layer failure (DNS, TCP reset, CORS, etc.).
  if (err instanceof TypeError) {
    return errorEnvelope('network', 500);
  }
  // AbortError / timeout → upstream_unavailable (transient).
  if (
    err instanceof Error &&
    (err.name === 'AbortError' || err.name === 'TimeoutError')
  ) {
    return errorEnvelope('upstream_unavailable', 500);
  }
  return errorEnvelope('unknown', 500);
}
