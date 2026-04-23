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
  SitecoreTokenFetchError,
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
 * Viewport + height presets — translate the client's `viewport=mobile|desktop`
 * and `height=small|medium|large|full` query params into the Agent API's
 * `width` + `height` query params.
 *
 * Confirmed empirically (T029 dogfood): the Agent API treats `height` as the
 * EXACT output-image height — not a viewport hint, not a minimum. There's
 * no `fullPage` toggle. The `fullPage: true` flag in the response body is
 * informational only. The editor picks a height tall enough for their page
 * via the HeightToggle UI. See dogfood friction log.
 */
const VIEWPORT_WIDTHS = {
  mobile: 375,
  desktop: 1200,
} as const;

const HEIGHT_PRESETS = {
  small: 800,
  medium: 2000,
  large: 4000,
  full: 8000,
} as const;

type HeightPresetKey = keyof typeof HEIGHT_PRESETS;

function resolveWidth(raw: string | null): number {
  if (raw === 'mobile') return VIEWPORT_WIDTHS.mobile;
  return VIEWPORT_WIDTHS.desktop;
}

function resolveHeight(raw: string | null): number {
  if (raw && raw in HEIGHT_PRESETS) {
    return HEIGHT_PRESETS[raw as HeightPresetKey];
  }
  return HEIGHT_PRESETS.large;
}

async function callAgentApi(
  pageId: string,
  token: string,
  dims: { width: number; height: number },
): Promise<Response> {
  // Agent API `/screenshot` query params (confirmed empirically + OpenAPI):
  //   version: required integer. Using 1 until we surface a version selector.
  //   width:   rendered viewport width (also controls output image width).
  //   height:  EXACT output-image height in pixels. Page content beyond this
  //            is cropped; shorter pages get whitespace padding. No fullPage
  //            toggle exists; user picks a preset via the HeightToggle UI.
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

  // Parse viewport + height presets from the request query string.
  // Defaults: desktop width (1200) + large height (4000).
  const params = new URL(req.url).searchParams;
  const dims = {
    width: resolveWidth(params.get('viewport')),
    height: resolveHeight(params.get('height')),
  };

  // Obtain a token up front. A missing env raises SitecoreTokenConfigError
  // from the cache WITHOUT issuing any network request (FR-13 / T011a-TEST-7).
  let token: string;
  try {
    token = await getSitecoreToken();
  } catch (err) {
    return mapTokenError(err);
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
      return mapTokenError(err);
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

/**
 * Map a thrown error from `getSitecoreToken()` to the right envelope:
 *   - `SitecoreTokenConfigError` (missing env)              → `auth` + admin message (FR-13)
 *   - `SitecoreTokenFetchError` with 4xx (bad credentials)  → `auth` (credential rejection)
 *   - `SitecoreTokenFetchError` with 5xx or status 0        → `upstream_unavailable`
 *   - anything else                                         → `upstream_unavailable`
 *
 * Credential rejection from the auth endpoint (400/401/403) is categorically an
 * auth problem, NOT a transient upstream outage — surfacing it as "try again
 * in a moment" would hide a real admin-action-required condition from the
 * editor and delay remediation. See § 4c-6 / FR-13 / auth.md § 5.
 */
function mapTokenError(err: unknown): Response {
  if (err instanceof SitecoreTokenConfigError) {
    return errorEnvelope('auth', 500, ADMIN_MUST_CONFIGURE);
  }
  if (err instanceof SitecoreTokenFetchError) {
    if (err.status >= 400 && err.status < 500) {
      return errorEnvelope('auth', 500);
    }
    return errorEnvelope('upstream_unavailable', 500);
  }
  return errorEnvelope('upstream_unavailable', 500);
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
