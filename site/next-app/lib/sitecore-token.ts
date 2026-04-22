/**
 * SitecoreAI OAuth 2.0 client-credentials token cache.
 *
 * Canonical implementation of the pattern in
 * `.agent/skills/sitecore/apis/sitecoreai/auth.md § 5`, with the extensions
 * required by task-breakdown § 4c-6:
 *
 *   - Module-scope cache keyed by `{ token, expiresAt }`.
 *   - 60-second safety margin on the cached expiry (NFR-S-02).
 *   - Stampede protection via a shared in-flight Promise — concurrent first
 *     callers all await the same fetch (auth.md § 5 pattern).
 *   - Pre-flight validation of `SITECORE_DEPLOY_CLIENT_ID` and
 *     `SITECORE_DEPLOY_CLIENT_SECRET` so the route handler can map missing
 *     env to the `{ code: 'auth' }` envelope WITHOUT issuing a network call
 *     (FR-13, T011a-TEST-7).
 *   - Errors never include the request body — `client_secret` must never
 *     appear in thrown messages (NFR-S-01).
 *
 * The cache is in-memory per Node process (ADR-0006). For multi-instance
 * deployments, promote to Redis/KV — out of scope for v1.
 */

const TOKEN_ENDPOINT = 'https://auth.sitecorecloud.io/oauth/token';
const TOKEN_AUDIENCE = 'https://api.sitecorecloud.io';
// 60-second safety margin — defends against clock skew and long requests
// that outlive a "still-valid" cache check (auth.md § 5, § 8 "Pitfalls").
const SAFETY_MARGIN_MS = 60_000;

interface CachedToken {
  token: string;
  expiresAt: number;
}

interface TokenResponseBody {
  access_token: string;
  token_type?: string;
  expires_in: number;
  scope?: string;
}

/** Sentinel error thrown when env vars are missing — the route handler maps this to `auth`. */
export class SitecoreTokenConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SitecoreTokenConfigError';
  }
}

/** Thrown when the token endpoint itself returns a non-2xx — maps to `auth` after retry. */
export class SitecoreTokenFetchError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'SitecoreTokenFetchError';
    this.status = status;
  }
}

// Module-scope state — intentionally shared across all callers in this process.
let cached: CachedToken | null = null;
// In-flight promise: when non-null, all subsequent callers await this same
// Promise instead of issuing a second fetch (stampede protection).
let inFlight: Promise<string> | null = null;

function readEnv(): { clientId: string; clientSecret: string } {
  const clientId = process.env.SITECORE_DEPLOY_CLIENT_ID;
  const clientSecret = process.env.SITECORE_DEPLOY_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new SitecoreTokenConfigError(
      'Sitecore OAuth credentials are not configured (SITECORE_DEPLOY_CLIENT_ID / SITECORE_DEPLOY_CLIENT_SECRET missing).',
    );
  }
  return { clientId, clientSecret };
}

async function fetchFreshToken(): Promise<string> {
  const { clientId, clientSecret } = readEnv();

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'client_credentials',
    audience: TOKEN_AUDIENCE,
  });

  let res: Response;
  try {
    res = await fetch(TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
  } catch (err) {
    // Network-layer failure — do NOT echo the body. Surface only a summary.
    const summary = err instanceof Error ? err.name : 'NetworkError';
    throw new SitecoreTokenFetchError(0, `Sitecore auth network error: ${summary}`);
  }

  if (!res.ok) {
    // IMPORTANT (NFR-S-01): we include the status but NEVER the request body,
    // because the body contains client_secret. Do not `console.error(body)` either.
    throw new SitecoreTokenFetchError(
      res.status,
      `Sitecore auth failed with status ${res.status}`,
    );
  }

  const json = (await res.json()) as TokenResponseBody;
  if (!json.access_token || typeof json.expires_in !== 'number') {
    throw new SitecoreTokenFetchError(
      res.status,
      `Sitecore auth returned malformed token payload (status ${res.status})`,
    );
  }

  cached = {
    token: json.access_token,
    expiresAt: Date.now() + json.expires_in * 1000,
  };

  // R-6 / NFR-O-01 / § 4c-6: on first successful auth, log the tenant
  // identifier so operators can correlate requests without exposing the
  // bearer token or client secret. A warm-cache call skips this function
  // entirely, so this fires at most once per cold-cache fetch.
  const tenant = decodeTenantIdFromJwt(json.access_token);
  if (tenant) {
    // Log ONLY the tenant id — never the bearer token or any secret.
    console.log(`[pageshot] tenant=${tenant}`);
  }

  return json.access_token;
}

/**
 * Extract the `sub` (fallback: `tid`) claim from a JWT without verifying the
 * signature. The token cache does not need to authenticate the JWT — it only
 * needs the tenant identifier for structured logging. Returns `null` on any
 * parse failure; callers must treat the return value as best-effort metadata.
 */
function decodeTenantIdFromJwt(jwt: string): string | null {
  try {
    const parts = jwt.split('.');
    if (parts.length < 2) return null;
    const payloadSegment = parts[1]!;
    // base64url → base64
    const b64 = payloadSegment.replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
    const decoded = Buffer.from(padded, 'base64').toString('utf8');
    const parsed: unknown = JSON.parse(decoded);
    if (parsed && typeof parsed === 'object') {
      const sub = (parsed as Record<string, unknown>).sub;
      if (typeof sub === 'string' && sub.length > 0) return sub;
      const tid = (parsed as Record<string, unknown>).tid;
      if (typeof tid === 'string' && tid.length > 0) return tid;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Get a valid Sitecore access token. Returns the cached token when it is still
 * fresh (current time is at least 60 seconds before expiry); otherwise fetches
 * a new one. Concurrent first-callers share a single in-flight request.
 */
export async function getSitecoreToken(): Promise<string> {
  const now = Date.now();
  if (cached && cached.expiresAt - now > SAFETY_MARGIN_MS) {
    return cached.token;
  }

  // Stampede protection — if a fetch is already in flight, join it.
  if (inFlight) return inFlight;

  inFlight = (async () => {
    try {
      return await fetchFreshToken();
    } finally {
      // Always clear the in-flight handle so the next caller can retry on failure.
      inFlight = null;
    }
  })();

  return inFlight;
}

/**
 * Drop the cached token. Called by the route handler after a 401 upstream
 * response so the next getSitecoreToken() refetches (auth.md § 6).
 */
export function invalidateSitecoreToken(): void {
  cached = null;
  // Any in-flight fetch continues to completion for its own caller, but a
  // fresh call after this will issue a new fetch if no other in-flight exists.
}
