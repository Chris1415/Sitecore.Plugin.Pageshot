import { vi } from 'vitest';

/**
 * Fetch-mock table — maps URL substrings (or exact URLs) to response specs.
 * Routes requests to Agent API / OAuth endpoint / local `/api/screenshot` based on URL.
 *
 * Fleshed out per § 11 of the task breakdown during T010a / T011a RED work.
 * Stubbed in E1 (T002) so tests written later can import it by the stable path.
 */
export type MockFetchEntry =
  | {
      status: number;
      body?: unknown;
      headers?: Record<string, string>;
    }
  | ((req: Request) => Response | Promise<Response>);

export type MockFetchTable = Record<string, MockFetchEntry | MockFetchEntry[]>;

export interface InstalledFetchMock {
  calls: Array<{ url: string; init?: RequestInit }>;
  restore: () => void;
}

const originalFetch = globalThis.fetch;

export function installFetchMock(table: MockFetchTable): InstalledFetchMock {
  const calls: InstalledFetchMock['calls'] = [];
  // track an index per url so sequential scenarios (e.g. 401-then-200) work
  const cursor = new Map<string, number>();

  const impl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    calls.push({ url, init });

    const key = Object.keys(table).find((k) => url.includes(k));
    if (!key) {
      throw new Error(`[mockFetch] No fixture registered for URL: ${url}`);
    }
    const entry = table[key]!;
    const list = Array.isArray(entry) ? entry : [entry];
    const idx = Math.min(cursor.get(key) ?? 0, list.length - 1);
    cursor.set(key, (cursor.get(key) ?? 0) + 1);
    const spec = list[idx];
    if (!spec) {
      throw new Error(`[mockFetch] no entry at index ${idx} for URL: ${url}`);
    }

    if (typeof spec === 'function') {
      return spec(new Request(url, init));
    }
    return new Response(spec.body == null ? null : JSON.stringify(spec.body), {
      status: spec.status,
      headers: {
        'content-type': 'application/json',
        ...(spec.headers ?? {}),
      },
    });
  });

  globalThis.fetch = impl as typeof fetch;

  return {
    calls,
    restore: () => {
      globalThis.fetch = originalFetch;
    },
  };
}
