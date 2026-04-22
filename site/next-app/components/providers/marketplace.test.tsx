/**
 * T007a-TEST-1..4 — MarketplaceProvider + `pages.context` subscription.
 *
 * Behavior under test (§ 4c-1 / § 4c-6 / client.md § 2 + § 6a):
 *   - `ClientSDK.init` is called exactly once with `{ target: window.parent, modules: [XMC] }`.
 *   - The Provider subscribes to `pages.context` via PATH A
 *     (`client.query('pages.context', { subscribe: true, onSuccess, onError })`).
 *     PATH B (`client.subscribe('pages.context', ...)`) is never invoked — that would
 *     be a typecheck regression (`pages.context` lives in `QueryMap`, not `SubscribeMap`).
 *   - On unmount: the `unsubscribe` returned by `client.query` runs exactly once AND
 *     `client.destroy()` runs exactly once.
 *   - `usePagesContext()` transitions `null` -> `{ pageId, siteName, pageName }` once
 *     the SDK delivers the first `onSuccess` event; fields are extracted from
 *     `pageInfo.id`, `siteInfo.name`, `pageInfo.name` per `client.md § 6a`.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { StrictMode, useEffect } from 'react';

import pagesContextFixture from '@/fixtures/pagesContext.canonical.json';
import { createSdkStubs, type SdkStubBundle } from '@/test-utils/sdkStubs';

// --- Module-level mock of @sitecore-marketplace-sdk/client -------------------
// The Provider calls `ClientSDK.init(config)` at mount. We intercept that static
// and hand back a fresh typed stub bundle so each test owns its own `query` /
// `destroy` spies and can assert call shapes.

const sdkHarness = vi.hoisted(() => ({
  stubs: null as SdkStubBundle | null,
  initCalls: [] as Array<Parameters<typeof ClientSDKInitShape>[0]>,
  initImpl: null as ((config: unknown) => Promise<unknown>) | null,
}));

// Typing helper — never executed, only here so `typeof ClientSDKInitShape` gives
// us the init-config type without importing the real SDK into the hoist block.
declare function ClientSDKInitShape(config: {
  target: Window;
  modules?: unknown[];
  origin?: string;
  timeout?: number;
}): Promise<unknown>;

vi.mock('@sitecore-marketplace-sdk/client', () => ({
  ClientSDK: {
    init: vi.fn(async (config: Parameters<typeof ClientSDKInitShape>[0]) => {
      sdkHarness.initCalls.push(config);
      if (sdkHarness.initImpl) {
        return sdkHarness.initImpl(config);
      }
      if (!sdkHarness.stubs) {
        throw new Error('[test] sdkHarness.stubs not installed before ClientSDK.init');
      }
      return sdkHarness.stubs.client;
    }),
  },
}));

vi.mock('@sitecore-marketplace-sdk/xmc', () => ({
  // Opaque module marker — the Provider just passes it through to `modules: [XMC]`.
  XMC: { __marker: 'XMC' },
}));

// Import the Provider AFTER the module mocks are declared.
import {
  MarketplaceProvider,
  useMarketplaceClient,
  // `usePagesContext` is introduced in T007b (GREEN). Importing it now makes
  // T007a fail at module load, which is the correct RED signal.
  // @ts-expect-error usePagesContext is introduced by T007b
  usePagesContext,
} from './marketplace';

// --- Fixture-derived sample `application.context` payload --------------------
// The Provider gates children render on `appContext` being set (scaffold
// behavior we preserve). We resolve `application.context` synchronously so
// children — including `usePagesContext()` consumers — render before the
// `pages.context` event fires, per T007a-TEST-4.
const CANONICAL_APP_CONTEXT = {
  id: 'app-test',
  url: 'https://test.local',
  name: 'PageShot (test)',
  type: 'xmc:pages-contextview',
  installationId: 'inst-test',
  organizationId: 'org-test',
  resourceAccess: [],
  extensionPoints: [],
};

// --- Helpers -----------------------------------------------------------------

/**
 * Configure `query` so:
 *   - `application.context` resolves immediately with the canonical shape.
 *   - `pages.context` returns a pending-but-subscribable result: `data` undefined,
 *     `unsubscribe` wired. The `onSuccess` callback is captured for later manual
 *     triggering so tests can drive the subscription lifecycle.
 */
function wireDefaultQuery(stubs: SdkStubBundle): {
  unsubscribe: ReturnType<typeof vi.fn>;
  getPagesOnSuccess: () => ((data: unknown) => void) | undefined;
  getPagesOnError: () => ((err: Error) => void) | undefined;
} {
  const unsubscribe = vi.fn();
  let pagesOnSuccess: ((data: unknown) => void) | undefined;
  let pagesOnError: ((err: Error) => void) | undefined;

  stubs.query.mockImplementation(((key: string, options?: {
    subscribe?: boolean;
    onSuccess?: (data: unknown) => void;
    onError?: (err: Error) => void;
  }) => {
    if (key === 'application.context') {
      return Promise.resolve({
        data: CANONICAL_APP_CONTEXT,
        error: undefined,
        status: 'success',
        isLoading: false,
        isError: false,
        isSuccess: true,
        refetch: vi.fn(),
      });
    }
    if (key === 'pages.context') {
      pagesOnSuccess = options?.onSuccess;
      pagesOnError = options?.onError;
      return Promise.resolve({
        data: undefined,
        error: undefined,
        status: 'loading',
        isLoading: true,
        isError: false,
        isSuccess: false,
        refetch: vi.fn(),
        unsubscribe,
      });
    }
    return Promise.resolve({
      data: undefined,
      error: undefined,
      status: 'idle',
      isLoading: false,
      isError: false,
      isSuccess: false,
      refetch: vi.fn(),
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any);

  return {
    unsubscribe,
    getPagesOnSuccess: () => pagesOnSuccess,
    getPagesOnError: () => pagesOnError,
  };
}

beforeEach(() => {
  sdkHarness.stubs = createSdkStubs();
  sdkHarness.initCalls = [];
  sdkHarness.initImpl = null;
});

afterEach(() => {
  vi.clearAllMocks();
});

// -----------------------------------------------------------------------------
// T007a-TEST-1 — `ClientSDK.init` called once with correct arguments
// -----------------------------------------------------------------------------
describe('T007a-TEST-1 — ClientSDK.init call shape', () => {
  it('calls ClientSDK.init exactly once with target=window.parent and modules=[XMC]', async () => {
    if (!sdkHarness.stubs) throw new Error('stubs missing');
    wireDefaultQuery(sdkHarness.stubs);

    render(
      <MarketplaceProvider>
        <div data-testid="child">child</div>
      </MarketplaceProvider>,
    );

    await waitFor(() => {
      expect(sdkHarness.initCalls.length).toBeGreaterThan(0);
    });

    expect(sdkHarness.initCalls).toHaveLength(1);
    const [config] = sdkHarness.initCalls;
    expect(config.target).toBe(window.parent);
    expect(Array.isArray(config.modules)).toBe(true);
    // The XMC module-mock marker flows through; assert XMC is present in modules.
    expect(config.modules).toEqual(
      expect.arrayContaining([expect.objectContaining({ __marker: 'XMC' })]),
    );
  });

  it('StrictMode double-mount still produces exactly one ClientSDK.init (idempotent)', async () => {
    if (!sdkHarness.stubs) throw new Error('stubs missing');
    wireDefaultQuery(sdkHarness.stubs);

    render(
      <StrictMode>
        <MarketplaceProvider>
          <div data-testid="child">child</div>
        </MarketplaceProvider>
      </StrictMode>,
    );

    // Allow both strict-mode effects to run.
    await waitFor(() => {
      expect(sdkHarness.initCalls.length).toBeGreaterThan(0);
    });
    // Give React a microtask tick to flush the duplicate StrictMode effect if any.
    await new Promise((r) => setTimeout(r, 0));

    expect(sdkHarness.initCalls).toHaveLength(1);
  });
});

// -----------------------------------------------------------------------------
// T007a-TEST-2 — `pages.context` subscribed via PATH A
// -----------------------------------------------------------------------------
describe('T007a-TEST-2 — pages.context subscription uses PATH A', () => {
  it('invokes client.query("pages.context", { subscribe: true, onSuccess, onError })', async () => {
    if (!sdkHarness.stubs) throw new Error('stubs missing');
    const driver = wireDefaultQuery(sdkHarness.stubs);

    render(
      <MarketplaceProvider>
        <div data-testid="child">child</div>
      </MarketplaceProvider>,
    );

    await waitFor(() => {
      expect(sdkHarness.stubs?.query).toHaveBeenCalledWith(
        'pages.context',
        expect.objectContaining({
          subscribe: true,
          onSuccess: expect.any(Function),
          onError: expect.any(Function),
        }),
      );
    });

    // Typecheck regression guard — PATH B (subscribe-verb) must NOT be used
    // for `pages.context`. The key lives in QueryMap, not SubscribeMap.
    expect(sdkHarness.stubs?.subscribe).not.toHaveBeenCalledWith(
      'pages.context',
      expect.anything(),
    );

    // Callbacks captured — sanity check.
    expect(driver.getPagesOnSuccess()).toBeTypeOf('function');
    expect(driver.getPagesOnError()).toBeTypeOf('function');
  });
});

// -----------------------------------------------------------------------------
// T007a-TEST-3 — Unmount tears down subscription AND calls client.destroy()
// -----------------------------------------------------------------------------
describe('T007a-TEST-3 — unmount lifecycle', () => {
  it('invokes unsubscribe exactly once and client.destroy() exactly once on unmount', async () => {
    if (!sdkHarness.stubs) throw new Error('stubs missing');
    const driver = wireDefaultQuery(sdkHarness.stubs);

    const { unmount } = render(
      <MarketplaceProvider>
        <div data-testid="child">child</div>
      </MarketplaceProvider>,
    );

    // Wait until the pages.context subscription has been wired.
    await waitFor(() => {
      expect(sdkHarness.stubs?.query).toHaveBeenCalledWith(
        'pages.context',
        expect.objectContaining({ subscribe: true }),
      );
    });

    unmount();

    expect(driver.unsubscribe).toHaveBeenCalledTimes(1);
    expect(sdkHarness.stubs?.destroy).toHaveBeenCalledTimes(1);
  });
});

// -----------------------------------------------------------------------------
// T007a-TEST-4 — usePagesContext() returns null, then live values
// -----------------------------------------------------------------------------
describe('T007a-TEST-4 — usePagesContext hook transitions null -> populated', () => {
  it('returns null before onSuccess fires, then returns the extracted fields once it fires', async () => {
    if (!sdkHarness.stubs) throw new Error('stubs missing');
    const driver = wireDefaultQuery(sdkHarness.stubs);

    // A probe component reads the hook on every render and records the
    // sequence of observed values. `useEffect` runs after commit so the
    // recorded sequence reflects what consumers would see.
    const observed: Array<unknown> = [];
    function Probe(): ReactNode {
      const ctx = usePagesContext();
      useEffect(() => {
        observed.push(ctx);
      }, [ctx]);
      return <div data-testid="probe">{ctx ? 'have-context' : 'null'}</div>;
    }

    const { findByTestId } = render(
      <MarketplaceProvider>
        <Probe />
      </MarketplaceProvider>,
    );

    // Wait for the provider to render children (appContext resolved).
    const probe = await findByTestId('probe');
    expect(probe.textContent).toBe('null');
    // First observed value is the pre-event null.
    expect(observed[0]).toBeNull();

    // Fire the initial pages.context event with the canonical fixture.
    await act(async () => {
      driver.getPagesOnSuccess()?.(pagesContextFixture);
    });

    // Hook transitions to the extracted shape.
    await waitFor(() => {
      expect(probe.textContent).toBe('have-context');
    });

    const populated = observed[observed.length - 1];
    expect(populated).toEqual({
      pageId: 'p1',
      siteName: 'acme',
      pageName: 'Home',
    });
  });

  it('usePagesContext() hook is accessible via the Provider tree (smoke)', async () => {
    if (!sdkHarness.stubs) throw new Error('stubs missing');
    wireDefaultQuery(sdkHarness.stubs);

    function wrapper({ children }: { children: ReactNode }) {
      return <MarketplaceProvider>{children}</MarketplaceProvider>;
    }

    const { result } = renderHook(
      () => ({
        client: useMarketplaceClient(),
        pages: usePagesContext(),
      }),
      { wrapper },
    );

    await waitFor(() => {
      expect(result.current.client).toBeDefined();
    });
    // Initial value is null — no event fired yet.
    expect(result.current.pages).toBeNull();
  });
});
