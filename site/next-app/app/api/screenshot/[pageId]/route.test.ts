/**
 * T011a-TEST-1..10 — `/api/screenshot/[pageId]` route handler.
 *
 * Behavior under test (§ 4c-1 / § 4c-6 / FR-06 / FR-07 / FR-13 / NFR-S-01 / R-6):
 *   1. Happy path: upstream 200 with base64 image → `{ ok: true, image }`, HTTP 200.
 *   2. 401-once retry: first upstream 401 → invalidate token → retry once → 200 →
 *      `{ ok: true, image }`. Exactly two upstream calls. `invalidateSitecoreToken`
 *      called once. Exactly ONE retry — never zero, never two.
 *   3. Double 401: both upstream calls 401 → `{ ok: false, error: { code: 'auth' } }`,
 *      HTTP 500. Exactly two upstream calls (no third attempt).
 *   4. 404 upstream → `{ code: 'not_found' }` with the § 4c-4 save-first subtitle.
 *   5. 5xx upstream → `{ code: 'upstream_unavailable' }`.
 *   6. fetch rejection (network) → `{ code: 'network' }`.
 *   7. Missing env → `{ code: 'auth' }`, HTTP 500, NO `/oauth/token` call, NO Agent
 *      API call. (FR-13.)
 *   8. Empty pageId → HTTP 400 + `{ code: 'not_found' }`, no upstream call.
 *   9. NFR-S-01: serialized response body NEVER contains `client_secret`, the
 *      literal secret value, or any access token — across all scenarios.
 *  10. Tenant identifier logged on first successful auth; secret + access token
 *      never logged. (R-6 / NFR-O-01.)
 *
 * Tests written BEFORE `app/api/screenshot/[pageId]/route.ts` exists (RED).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import agentOk from '@/fixtures/agentApi.screenshot.ok.json';
import agent401 from '@/fixtures/agentApi.screenshot.401.json';
import agent404 from '@/fixtures/agentApi.screenshot.404.json';
import agent5xx from '@/fixtures/agentApi.screenshot.5xx.json';
import oauthOk from '@/fixtures/oauth.token.ok.json';
import {
  installFetchMock,
  type InstalledFetchMock,
  type MockFetchTable,
} from '@/test-utils/mockFetch';
import {
  invalidateSitecoreToken,
  type SitecoreTokenConfigError,
} from '@/lib/sitecore-token';

// Route handler import — does not yet exist (RED).
import { GET } from './route';

const TOKEN_URL = 'https://auth.sitecorecloud.io/oauth/token';
const AGENT_BASE =
  'https://edge-platform.sitecorecloud.io/stream/ai-agent-api/api/v1/pages';
// JWT with a recognizable `sub` claim so the tenant-id log assertion has
// something to match. `sub` is decoded by the route as the tenant identifier
// per § 4c-6. Payload = { sub: "tenant-abc-123", tid: "tenant-abc-123" }.
// Base64url: eyJzdWIiOiJ0ZW5hbnQtYWJjLTEyMyIsInRpZCI6InRlbmFudC1hYmMtMTIzIn0
const JWT_WITH_TENANT =
  'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ0ZW5hbnQtYWJjLTEyMyIsInRpZCI6InRlbmFudC1hYmMtMTIzIn0.signature';
const TENANT_ID = 'tenant-abc-123';

const TEST_CLIENT_ID = 'test-client-id';
const TEST_CLIENT_SECRET = 'test-client-secret-DO-NOT-LEAK-xyz987';

let fetchMock: InstalledFetchMock | null = null;
let logSpy: ReturnType<typeof vi.spyOn> | null = null;
let errorSpy: ReturnType<typeof vi.spyOn> | null = null;

function mkPageContext(pageId: string): { params: Promise<{ pageId: string }> } {
  return { params: Promise.resolve({ pageId }) };
}

function mkRequest(pageId: string): Request {
  const encoded = encodeURIComponent(pageId);
  return new Request(`http://localhost:3000/api/screenshot/${encoded}`);
}

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

function tokenOkWithTenantJwt() {
  return {
    status: 200,
    body: {
      access_token: JWT_WITH_TENANT,
      token_type: 'Bearer',
      expires_in: oauthOk.expires_in,
    },
  };
}

function defaultTable(extra?: MockFetchTable): MockFetchTable {
  return {
    [TOKEN_URL]: tokenOkWithTenantJwt(),
    ...extra,
  };
}

beforeEach(() => {
  installEnv();
  invalidateSitecoreToken();
  logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  fetchMock?.restore();
  fetchMock = null;
  logSpy?.mockRestore();
  errorSpy?.mockRestore();
  logSpy = null;
  errorSpy = null;
  invalidateSitecoreToken();
  delete process.env.SITECORE_DEPLOY_CLIENT_ID;
  delete process.env.SITECORE_DEPLOY_CLIENT_SECRET;
});

async function readEnvelope(res: Response): Promise<{ body: unknown; raw: string; status: number }> {
  const raw = await res.text();
  return { body: raw ? JSON.parse(raw) : null, raw, status: res.status };
}

function assertNoSecretsInString(s: string): void {
  expect(s).not.toContain('client_secret');
  expect(s).not.toContain(TEST_CLIENT_SECRET);
  expect(s).not.toContain(JWT_WITH_TENANT);
  expect(s).not.toContain(oauthOk.access_token);
}

function collectedLogText(): string {
  const parts: string[] = [];
  for (const spy of [logSpy, errorSpy]) {
    if (!spy) continue;
    for (const call of spy.mock.calls) {
      for (const arg of call) {
        parts.push(typeof arg === 'string' ? arg : safeStringify(arg));
      }
    }
  }
  return parts.join('\n');
}

function safeStringify(x: unknown): string {
  try {
    return JSON.stringify(x);
  } catch {
    return String(x);
  }
}

// -----------------------------------------------------------------------------
// T011a-TEST-1 — Happy path
// -----------------------------------------------------------------------------
describe('T011a-TEST-1 — happy path returns { ok: true, image }', () => {
  it('returns 200 with the upstream base64 image, exactly one upstream call', async () => {
    fetchMock = installFetchMock(
      defaultTable({
        [`${AGENT_BASE}/page-1/screenshot`]: { status: 200, body: agentOk },
      }),
    );

    const res = await GET(mkRequest('page-1'), mkPageContext('page-1'));
    const { body, status, raw } = await readEnvelope(res);
    expect(status).toBe(200);
    expect(body).toEqual({ ok: true, image: agentOk.screenshot_base64 });

    // Exactly one upstream Agent API call.
    const agentCalls = fetchMock.calls.filter((c) => c.url.includes('/ai-agent-api'));
    expect(agentCalls).toHaveLength(1);
    // URL carries the required `version` + viewport-derived width/height.
    // The base path is matched via startsWith so future query-param additions
    // (language, etc.) do not flake this assertion.
    expect(agentCalls[0]!.url.startsWith(`${AGENT_BASE}/page-1/screenshot?`)).toBe(true);
    const parsedUrl = new URL(agentCalls[0]!.url);
    expect(parsedUrl.searchParams.get('version')).toBe('1');
    expect(parsedUrl.searchParams.get('width')).toBe('1200');
    expect(parsedUrl.searchParams.get('height')).toBe('800');

    // Authorization header + Accept header per § 4c-6.
    const agentHeaders = new Headers(agentCalls[0]!.init?.headers);
    expect(agentHeaders.get('authorization') ?? agentHeaders.get('Authorization')).toBe(
      `Bearer ${JWT_WITH_TENANT}`,
    );
    expect(agentHeaders.get('accept') ?? agentHeaders.get('Accept')).toBe(
      'application/json',
    );

    assertNoSecretsInString(raw);
  });
});

// -----------------------------------------------------------------------------
// T011a-TEST-2 — 401 refresh + retry-once → 200
// -----------------------------------------------------------------------------
describe('T011a-TEST-2 — 401 refresh+retry-once succeeds', () => {
  it('invalidates token, refetches, retries Agent API exactly once, returns 200', async () => {
    fetchMock = installFetchMock({
      [TOKEN_URL]: [
        tokenOkWithTenantJwt(),
        // second fetch after invalidation — same JWT shape, different payload
        {
          status: 200,
          body: {
            access_token: JWT_WITH_TENANT.replace('signature', 'signature2'),
            token_type: 'Bearer',
            expires_in: oauthOk.expires_in,
          },
        },
      ],
      [`${AGENT_BASE}/p7/screenshot`]: [
        { status: 401, body: agent401 },
        { status: 200, body: agentOk },
      ],
    });

    const res = await GET(mkRequest('p7'), mkPageContext('p7'));
    const { body, status, raw } = await readEnvelope(res);
    expect(status).toBe(200);
    expect(body).toEqual({ ok: true, image: agentOk.screenshot_base64 });

    const agentCalls = fetchMock.calls.filter((c) => c.url.includes('/ai-agent-api'));
    // Exactly two upstream calls — one retry, not zero, not two.
    expect(agentCalls).toHaveLength(2);

    // Both token and agent endpoint hit twice (token refresh between retries).
    const tokenCalls = fetchMock.calls.filter((c) => c.url === TOKEN_URL);
    expect(tokenCalls).toHaveLength(2);

    assertNoSecretsInString(raw);
  });
});

// -----------------------------------------------------------------------------
// T011a-TEST-3 — Double 401 → auth envelope, exactly 2 upstream calls
// -----------------------------------------------------------------------------
describe('T011a-TEST-3 — double 401 surfaces { code: "auth" }', () => {
  it('returns 500 with auth envelope and does NOT try a third time', async () => {
    fetchMock = installFetchMock({
      [TOKEN_URL]: [tokenOkWithTenantJwt(), tokenOkWithTenantJwt()],
      [`${AGENT_BASE}/px/screenshot`]: [
        { status: 401, body: agent401 },
        { status: 401, body: agent401 },
        { status: 200, body: agentOk }, // would satisfy a 3rd call — must NOT be reached
      ],
    });

    const res = await GET(mkRequest('px'), mkPageContext('px'));
    const { body, status, raw } = await readEnvelope(res);
    expect(status).toBe(500);
    expect(body).toMatchObject({
      ok: false,
      error: { code: 'auth' },
    });
    // Message should match § 4c-4 auth subtitle copy.
    expect((body as { error: { message: string } }).error.message).toBe(
      "Ask your administrator to check the app's credentials.",
    );

    const agentCalls = fetchMock.calls.filter((c) => c.url.includes('/ai-agent-api'));
    expect(agentCalls).toHaveLength(2);

    assertNoSecretsInString(raw);
  });
});

// -----------------------------------------------------------------------------
// T011a-TEST-4 — 404 → not_found with save-first copy
// -----------------------------------------------------------------------------
describe('T011a-TEST-4 — 404 → { code: "not_found" } save-first message', () => {
  it('returns the save-first subtitle per § 4c-4', async () => {
    fetchMock = installFetchMock(
      defaultTable({
        [`${AGENT_BASE}/missing/screenshot`]: { status: 404, body: agent404 },
      }),
    );

    const res = await GET(mkRequest('missing'), mkPageContext('missing'));
    const { body, raw } = await readEnvelope(res);
    expect(body).toMatchObject({
      ok: false,
      error: {
        code: 'not_found',
        message: 'Save the page first, then try again.',
      },
    });

    assertNoSecretsInString(raw);
  });
});

// -----------------------------------------------------------------------------
// T011a-TEST-5 — 5xx → upstream_unavailable
// -----------------------------------------------------------------------------
describe('T011a-TEST-5 — 5xx → { code: "upstream_unavailable" }', () => {
  it.each([500, 502, 503])('maps HTTP %i to upstream_unavailable', async (status) => {
    fetchMock = installFetchMock(
      defaultTable({
        [`${AGENT_BASE}/flaky/screenshot`]: { status, body: agent5xx },
      }),
    );

    const res = await GET(mkRequest('flaky'), mkPageContext('flaky'));
    const { body, raw } = await readEnvelope(res);
    expect(body).toMatchObject({
      ok: false,
      error: {
        code: 'upstream_unavailable',
        message: 'Try again in a moment.',
      },
    });

    assertNoSecretsInString(raw);
  });
});

// -----------------------------------------------------------------------------
// T011a-TEST-6 — fetch rejection → network
// -----------------------------------------------------------------------------
describe('T011a-TEST-6 — fetch TypeError → { code: "network" }', () => {
  it('maps a fetch rejection to the network envelope', async () => {
    fetchMock = installFetchMock({
      [TOKEN_URL]: tokenOkWithTenantJwt(),
      [`${AGENT_BASE}/p1/screenshot`]: () => {
        throw new TypeError('Failed to fetch');
      },
    });

    const res = await GET(mkRequest('p1'), mkPageContext('p1'));
    const { body, raw } = await readEnvelope(res);
    expect(body).toMatchObject({
      ok: false,
      error: { code: 'network' },
    });
    expect((body as { error: { message: string } }).error.message).toBe(
      'Check your connection, then try again.',
    );

    assertNoSecretsInString(raw);
  });
});

// -----------------------------------------------------------------------------
// T011a-TEST-7 — Missing env → auth, no /oauth/token, no Agent API call
// -----------------------------------------------------------------------------
describe('T011a-TEST-7 — missing env produces auth envelope without any fetch', () => {
  it('returns 500 + auth envelope; no token or agent call is issued', async () => {
    fetchMock = installFetchMock(
      defaultTable({
        [`${AGENT_BASE}/any/screenshot`]: { status: 200, body: agentOk },
      }),
    );
    installEnv({ id: '' });

    const res = await GET(mkRequest('any'), mkPageContext('any'));
    const { body, status, raw } = await readEnvelope(res);
    expect(status).toBe(500);
    expect(body).toMatchObject({
      ok: false,
      error: {
        code: 'auth',
        message: 'Administrator must configure credentials.',
      },
    });

    expect(fetchMock.calls).toHaveLength(0);

    assertNoSecretsInString(raw);
  });

  it('raises from the token cache with SitecoreTokenConfigError recognizably', async () => {
    // Extra safety: the underlying cache throws the sentinel type so the route
    // handler can reliably map it without matching error message strings.
    // This locks in the contract the handler relies on.
    installEnv({ id: '' });
    await expect(
      (async () => {
        const mod = await import('@/lib/sitecore-token');
        return mod.getSitecoreToken();
      })(),
    ).rejects.toMatchObject({
      name: 'SitecoreTokenConfigError',
    } satisfies Partial<SitecoreTokenConfigError>);
  });
});

// -----------------------------------------------------------------------------
// T011a-TEST-8 — Empty/malformed pageId → 400 + not_found
// -----------------------------------------------------------------------------
describe('T011a-TEST-8 — empty pageId → 400 not_found with no upstream call', () => {
  it.each(['', '   '])('rejects pageId = %j', async (pageId) => {
    fetchMock = installFetchMock(defaultTable());

    const req = new Request('http://localhost:3000/api/screenshot/blank');
    const res = await GET(req, mkPageContext(pageId));
    const { body, status } = await readEnvelope(res);
    expect(status).toBe(400);
    expect(body).toMatchObject({
      ok: false,
      error: { code: 'not_found' },
    });

    expect(fetchMock.calls).toHaveLength(0);
  });
});

// -----------------------------------------------------------------------------
// T011a-TEST-9 — NFR-S-01 — serialized body never contains secrets
// -----------------------------------------------------------------------------
describe('T011a-TEST-9 — NFR-S-01 secret containment across all scenarios', () => {
  type Scenario = {
    label: string;
    install: () => void;
    pageId: string;
  };

  const scenarios: Scenario[] = [
    {
      label: 'happy path',
      install: () => {
        fetchMock = installFetchMock(
          defaultTable({ [`${AGENT_BASE}/p/screenshot`]: { status: 200, body: agentOk } }),
        );
      },
      pageId: 'p',
    },
    {
      label: '404',
      install: () => {
        fetchMock = installFetchMock(
          defaultTable({ [`${AGENT_BASE}/p/screenshot`]: { status: 404, body: agent404 } }),
        );
      },
      pageId: 'p',
    },
    {
      label: '5xx',
      install: () => {
        fetchMock = installFetchMock(
          defaultTable({ [`${AGENT_BASE}/p/screenshot`]: { status: 502, body: agent5xx } }),
        );
      },
      pageId: 'p',
    },
    {
      label: 'double 401',
      install: () => {
        fetchMock = installFetchMock({
          [TOKEN_URL]: [tokenOkWithTenantJwt(), tokenOkWithTenantJwt()],
          [`${AGENT_BASE}/p/screenshot`]: [
            { status: 401, body: agent401 },
            { status: 401, body: agent401 },
          ],
        });
      },
      pageId: 'p',
    },
    {
      label: 'network',
      install: () => {
        fetchMock = installFetchMock({
          [TOKEN_URL]: tokenOkWithTenantJwt(),
          [`${AGENT_BASE}/p/screenshot`]: () => {
            throw new TypeError('Failed to fetch');
          },
        });
      },
      pageId: 'p',
    },
    {
      label: 'missing env',
      install: () => {
        fetchMock = installFetchMock(defaultTable());
        installEnv({ secret: '' });
      },
      pageId: 'p',
    },
  ];

  it.each(scenarios)(
    'response body contains neither client_secret nor the secret value nor any token ($label)',
    async ({ install, pageId }) => {
      install();

      const res = await GET(mkRequest(pageId), mkPageContext(pageId));
      const { raw } = await readEnvelope(res);

      // The canonical NFR-S-01 assertion, literal:
      expect(raw).not.toContain('client_secret');
      expect(raw).not.toContain(TEST_CLIENT_SECRET);
      expect(raw).not.toContain(JWT_WITH_TENANT);
      expect(raw).not.toContain(oauthOk.access_token);
    },
  );
});

// -----------------------------------------------------------------------------
// T011a-TEST-10 — Tenant identifier logged once on cold-cache success; no secret in logs
// -----------------------------------------------------------------------------
describe('T011a-TEST-10 — tenant-id logged on first success, never the secret', () => {
  it('emits one tenant-id log line per cold-cache token fetch; no secret in any log', async () => {
    fetchMock = installFetchMock(
      defaultTable({
        [`${AGENT_BASE}/p/screenshot`]: { status: 200, body: agentOk },
      }),
    );

    const res = await GET(mkRequest('p'), mkPageContext('p'));
    expect(res.status).toBe(200);

    const text = collectedLogText();

    // Must contain the decoded tenant id exactly once.
    const tenantHits = text.split(TENANT_ID).length - 1;
    expect(tenantHits).toBe(1);

    // Must NEVER contain the secret or the bearer token.
    expect(text).not.toContain('client_secret');
    expect(text).not.toContain(TEST_CLIENT_SECRET);
    expect(text).not.toContain(JWT_WITH_TENANT);
  });

  it('a second successful call does NOT log the tenant again (cache warm)', async () => {
    fetchMock = installFetchMock(
      defaultTable({
        [`${AGENT_BASE}/p/screenshot`]: [
          { status: 200, body: agentOk },
          { status: 200, body: agentOk },
        ],
      }),
    );

    const r1 = await GET(mkRequest('p'), mkPageContext('p'));
    expect(r1.status).toBe(200);
    const r2 = await GET(mkRequest('p'), mkPageContext('p'));
    expect(r2.status).toBe(200);

    const text = collectedLogText();
    const tenantHits = text.split(TENANT_ID).length - 1;
    // Only one tenant log line — second call reused the cached token.
    expect(tenantHits).toBe(1);
  });
});
