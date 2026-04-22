/**
 * T010a-TEST-1..6 — SitecoreAI OAuth client-credentials token cache.
 *
 * Behavior under test (§ 4c-6 / auth.md § 5 + § 6):
 *   - Fresh fetch POSTs to `https://auth.sitecorecloud.io/oauth/token`
 *     with `Content-Type: application/x-www-form-urlencoded` and a body that
 *     includes `client_id`, `client_secret`, `grant_type=client_credentials`,
 *     and `audience=https://api.sitecorecloud.io` (literal — not the API base URL).
 *   - Second call within TTL reuses the cached token — no second POST.
 *   - Refresh is triggered when cached expiry is within the 60-second safety
 *     margin (NFR-S-02).
 *   - `invalidateSitecoreToken()` drops the cache so the next call refetches.
 *   - Non-2xx responses throw a structured error that does NOT include the
 *     request body (no `client_secret` in the thrown message — NFR-S-01).
 *   - Concurrent first callers share ONE in-flight fetch (stampede protection
 *     per auth.md § 5 pattern).
 *   - Missing env vars (`SITECORE_DEPLOY_CLIENT_ID` / `_SECRET`) throw a
 *     recognizable error BEFORE hitting the token endpoint so the route
 *     handler can map to the `auth` envelope without a network call.
 *
 * These tests are written BEFORE `lib/sitecore-token.ts` exists (RED).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import oauthOk from '@/fixtures/oauth.token.ok.json';
import oauthShortTtl from '@/fixtures/oauth.token.short-ttl.json';
import oauth400 from '@/fixtures/oauth.token.400.json';
import { installFetchMock, type InstalledFetchMock } from '@/test-utils/mockFetch';

// Import target (does not yet exist — this makes the file RED).
import {
  getSitecoreToken,
  invalidateSitecoreToken,
} from './sitecore-token';

const TOKEN_URL = 'https://auth.sitecorecloud.io/oauth/token';
const TEST_CLIENT_ID = 'test-client-id';
const TEST_CLIENT_SECRET = 'test-client-secret-DO-NOT-LEAK';

let fetchMock: InstalledFetchMock | null = null;

function installEnv(overrides?: { id?: string | undefined; secret?: string | undefined }): void {
  if (overrides && 'id' in overrides) {
    if (overrides.id === undefined) delete process.env.SITECORE_DEPLOY_CLIENT_ID;
    else process.env.SITECORE_DEPLOY_CLIENT_ID = overrides.id;
  } else {
    process.env.SITECORE_DEPLOY_CLIENT_ID = TEST_CLIENT_ID;
  }
  if (overrides && 'secret' in overrides) {
    if (overrides.secret === undefined) delete process.env.SITECORE_DEPLOY_CLIENT_SECRET;
    else process.env.SITECORE_DEPLOY_CLIENT_SECRET = overrides.secret;
  } else {
    process.env.SITECORE_DEPLOY_CLIENT_SECRET = TEST_CLIENT_SECRET;
  }
}

beforeEach(() => {
  installEnv();
  // Always start each test with an empty cache — the module is a shared singleton.
  invalidateSitecoreToken();
});

afterEach(() => {
  fetchMock?.restore();
  fetchMock = null;
  vi.useRealTimers();
  invalidateSitecoreToken();
  delete process.env.SITECORE_DEPLOY_CLIENT_ID;
  delete process.env.SITECORE_DEPLOY_CLIENT_SECRET;
});

// -----------------------------------------------------------------------------
// T010a-TEST-1 — Fresh fetch POSTs the correct form-encoded body
// -----------------------------------------------------------------------------
describe('T010a-TEST-1 — token endpoint request shape', () => {
  it('POSTs application/x-www-form-urlencoded to /oauth/token with all four fields and returns access_token', async () => {
    fetchMock = installFetchMock({
      [TOKEN_URL]: { status: 200, body: oauthOk },
    });

    const token = await getSitecoreToken();

    expect(token).toBe(oauthOk.access_token);

    expect(fetchMock.calls).toHaveLength(1);
    const firstCall = fetchMock.calls[0]!;
    expect(firstCall.url).toBe(TOKEN_URL);
    expect(firstCall.init?.method).toBe('POST');

    // Headers must declare form-urlencoded Content-Type.
    const headers = new Headers(firstCall.init?.headers);
    expect(headers.get('Content-Type') ?? headers.get('content-type')).toBe(
      'application/x-www-form-urlencoded',
    );

    // Body contains all four required fields with correct values.
    // Accept both string and URLSearchParams body shapes.
    const raw = firstCall.init?.body;
    const bodyStr =
      typeof raw === 'string'
        ? raw
        : raw instanceof URLSearchParams
          ? raw.toString()
          : String(raw ?? '');
    const params = new URLSearchParams(bodyStr);
    expect(params.get('client_id')).toBe(TEST_CLIENT_ID);
    expect(params.get('client_secret')).toBe(TEST_CLIENT_SECRET);
    expect(params.get('grant_type')).toBe('client_credentials');
    // Audience must be the LITERAL api.sitecorecloud.io — NOT the API base URL.
    expect(params.get('audience')).toBe('https://api.sitecorecloud.io');
  });
});

// -----------------------------------------------------------------------------
// T010a-TEST-2 — Cache reuse within TTL (no second POST)
// -----------------------------------------------------------------------------
describe('T010a-TEST-2 — cache reuse within TTL', () => {
  it('returns the cached token on a second call without re-fetching', async () => {
    fetchMock = installFetchMock({
      [TOKEN_URL]: { status: 200, body: oauthOk },
    });

    const first = await getSitecoreToken();
    const second = await getSitecoreToken();

    expect(first).toBe(oauthOk.access_token);
    expect(second).toBe(oauthOk.access_token);
    // Exactly ONE network call despite two getSitecoreToken() calls.
    expect(fetchMock.calls).toHaveLength(1);
  });
});

// -----------------------------------------------------------------------------
// T010a-TEST-3 — Refresh at 60 s safety margin
// -----------------------------------------------------------------------------
describe('T010a-TEST-3 — refresh inside 60 s safety margin', () => {
  it('re-fetches when cached expiry is < 60 s away (short_ttl: 30 s)', async () => {
    // Seed the cache with a token that expires in 30 s — inside the safety margin.
    fetchMock = installFetchMock({
      [TOKEN_URL]: [
        { status: 200, body: oauthShortTtl },
        { status: 200, body: oauthOk },
      ],
    });

    const firstToken = await getSitecoreToken();
    expect(firstToken).toBe(oauthShortTtl.access_token);
    expect(fetchMock.calls).toHaveLength(1);

    // Even immediately after, the 30 s TTL is < 60 s => next call should refetch.
    const secondToken = await getSitecoreToken();
    expect(secondToken).toBe(oauthOk.access_token);
    expect(fetchMock.calls).toHaveLength(2);
  });
});

// -----------------------------------------------------------------------------
// T010a-TEST-4 — invalidateSitecoreToken() wipes the cache
// -----------------------------------------------------------------------------
describe('T010a-TEST-4 — invalidateSitecoreToken wipes the cache', () => {
  it('forces a fresh fetch on the next getSitecoreToken() call', async () => {
    fetchMock = installFetchMock({
      [TOKEN_URL]: [
        { status: 200, body: oauthOk },
        { status: 200, body: { ...oauthOk, access_token: 'second-token' } },
      ],
    });

    const t1 = await getSitecoreToken();
    expect(t1).toBe(oauthOk.access_token);
    expect(fetchMock.calls).toHaveLength(1);

    invalidateSitecoreToken();

    const t2 = await getSitecoreToken();
    expect(t2).toBe('second-token');
    expect(fetchMock.calls).toHaveLength(2);
  });
});

// -----------------------------------------------------------------------------
// T010a-TEST-5 — Non-2xx from /oauth/token throws; no secret in error
// -----------------------------------------------------------------------------
describe('T010a-TEST-5 — 4xx/5xx on /oauth/token throws structured error', () => {
  it('rejects with an error that does not leak client_secret', async () => {
    fetchMock = installFetchMock({
      [TOKEN_URL]: { status: 400, body: oauth400 },
    });

    await expect(getSitecoreToken()).rejects.toThrow();

    // Grab the thrown error instance so we can assert secret-containment.
    let caught: unknown;
    try {
      // A second attempt (cache is empty after a failed fetch).
      fetchMock.restore();
      fetchMock = installFetchMock({
        [TOKEN_URL]: { status: 500, body: { error: 'boom' } },
      });
      await getSitecoreToken();
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(Error);
    const msg = (caught as Error).message;
    expect(msg).not.toContain('client_secret');
    expect(msg).not.toContain(TEST_CLIENT_SECRET);
    // And status should be mentioned so callers can distinguish 4xx vs 5xx.
    expect(msg).toMatch(/5\d{2}|auth/i);
  });

  it('does not cache a failed fetch — next call retries the endpoint', async () => {
    fetchMock = installFetchMock({
      [TOKEN_URL]: [
        { status: 500, body: { error: 'upstream hiccup' } },
        { status: 200, body: oauthOk },
      ],
    });

    await expect(getSitecoreToken()).rejects.toThrow();
    const recovered = await getSitecoreToken();
    expect(recovered).toBe(oauthOk.access_token);
    expect(fetchMock.calls).toHaveLength(2);
  });
});

// -----------------------------------------------------------------------------
// T010a-TEST-6 — Concurrent callers share ONE in-flight request (stampede)
// -----------------------------------------------------------------------------
describe('T010a-TEST-6 — stampede protection via in-flight promise', () => {
  it('three parallel first-calls produce exactly one POST to /oauth/token', async () => {
    // Delay the fetch resolution so we can be sure all three calls race
    // through getSitecoreToken() before the first fetch resolves.
    let resolveFetch: ((res: Response) => void) | null = null;
    fetchMock = installFetchMock({
      [TOKEN_URL]: () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        }),
    });

    const p1 = getSitecoreToken();
    const p2 = getSitecoreToken();
    const p3 = getSitecoreToken();

    // Let the microtask queue flush so the first fetch call is actually issued.
    await new Promise((r) => setTimeout(r, 0));

    // Only ONE fetch must have gone out at this point.
    expect(fetchMock.calls).toHaveLength(1);

    // Resolve the shared fetch.
    resolveFetch!(
      new Response(JSON.stringify(oauthOk), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const [t1, t2, t3] = await Promise.all([p1, p2, p3]);
    expect(t1).toBe(oauthOk.access_token);
    expect(t2).toBe(oauthOk.access_token);
    expect(t3).toBe(oauthOk.access_token);

    // Still exactly one POST after all three resolve.
    expect(fetchMock.calls).toHaveLength(1);
  });
});

// -----------------------------------------------------------------------------
// T010a-TEST-7 (supplementary) — Missing env throws without hitting the endpoint
// -----------------------------------------------------------------------------
// Covers the FR-13 / § 4c-6 "missing env" path that the route handler relies on
// to map directly to the `auth` envelope WITHOUT a token-endpoint round trip.
// Not listed as a separate scenario in § 10 T010a but required by T011a-TEST-7
// (which asserts `fetch` is NEVER called when env is missing) — the cache MUST
// raise a recognizable error before any network IO, so the route-handler layer
// can catch it and produce the `auth` envelope. Documented in § 4c-6 "Missing
// env vars server-side → { code: 'auth' }".
describe('T010a-TEST-7 — missing env throws before hitting the token endpoint', () => {
  it('throws when SITECORE_DEPLOY_CLIENT_ID is missing', async () => {
    fetchMock = installFetchMock({
      [TOKEN_URL]: { status: 200, body: oauthOk },
    });
    installEnv({ id: undefined });

    await expect(getSitecoreToken()).rejects.toThrow();
    expect(fetchMock.calls).toHaveLength(0);
  });

  it('throws when SITECORE_DEPLOY_CLIENT_SECRET is missing', async () => {
    fetchMock = installFetchMock({
      [TOKEN_URL]: { status: 200, body: oauthOk },
    });
    installEnv({ secret: undefined });

    await expect(getSitecoreToken()).rejects.toThrow();
    expect(fetchMock.calls).toHaveLength(0);
  });

  it('throws when both env vars are present but empty', async () => {
    fetchMock = installFetchMock({
      [TOKEN_URL]: { status: 200, body: oauthOk },
    });
    installEnv({ id: '', secret: '' });

    await expect(getSitecoreToken()).rejects.toThrow();
    expect(fetchMock.calls).toHaveLength(0);
  });
});
