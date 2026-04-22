/**
 * T024a-TEST-1..5 — `<PageshotPanel>` keyboard + focus map (RED).
 *
 * Per § 10 T024a-TEST-* and § 4c-4 "Keyboard & focus map". These tests
 * exercise the focus-management contract the panel must honour; they fail
 * on the T019 composition because the focus moves are owned by T024b and
 * not yet wired.
 *
 * Harness:
 *   - `@sitecore-marketplace-sdk/client` is `vi.mock`-ed so `ClientSDK.init`
 *     returns a stub whose `query` function is driven per-test. The
 *     `pages.context` subscription captures its `onSuccess` callback; tests
 *     invoke it to deliver a canonical page context event.
 *   - `global.fetch` is swapped via `installFetchMock` so
 *     `/api/screenshot/...` responses come from fixtures.
 *   - `<PageshotPanel>` is rendered inside the real `<MarketplaceProvider>`
 *     so the production `usePagesContext()` path is exercised.
 *
 * T025-TEST-1..6 land in a subsequent commit (post-T024b GREEN) and extend
 * this file with end-to-end golden-path scenarios. Keeping T024a tests
 * isolated here produces a clean RED → GREEN → INTEGRATION history.
 *
 * Behavior under test — T024a (§ 4c-4):
 *   T024a-TEST-1: Shutter is `document.activeElement` after first non-null
 *                 pages.context.
 *   T024a-TEST-2: capturing → ready moves focus to the Copy pill with
 *                 `{ preventScroll: true }`.
 *   T024a-TEST-3: capturing → error moves focus to the Retry pill.
 *   T024a-TEST-4: Escape anywhere inside the panel returns focus to the
 *                 Shutter.
 *   T024a-TEST-5: Tab order = DOM order (Shutter → Copy → Download in
 *                 ready; Shutter → Retry in error).
 */

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

import { installClipboard } from '@/test-utils/mockClipboard';
import { installFetchMock, type InstalledFetchMock } from '@/test-utils/mockFetch';
import { createSdkStubs, type SdkStubBundle } from '@/test-utils/sdkStubs';

// ---------------------------------------------------------------------------
// Module-level mocks of the Marketplace SDK — same pattern as
// components/providers/marketplace.test.tsx.
// ---------------------------------------------------------------------------

const sdkHarness = vi.hoisted(() => ({
  stubs: null as SdkStubBundle | null,
  initCalls: [] as Array<unknown>,
}));

vi.mock('@sitecore-marketplace-sdk/client', () => ({
  ClientSDK: {
    init: vi.fn(async (config: unknown) => {
      sdkHarness.initCalls.push(config);
      if (!sdkHarness.stubs) {
        throw new Error(
          '[test] sdkHarness.stubs not installed before ClientSDK.init',
        );
      }
      return sdkHarness.stubs.client;
    }),
  },
}));

vi.mock('@sitecore-marketplace-sdk/xmc', () => ({
  XMC: { __marker: 'XMC' },
}));

import { MarketplaceProvider } from './providers/marketplace';
import { PageshotPanel } from './PageshotPanel';

// ---------------------------------------------------------------------------
// Canonical pages.context payload.
// ---------------------------------------------------------------------------

const CANONICAL_PAGES_CONTEXT = {
  siteInfo: { id: 's1', name: 'acme', displayName: 'Acme Marketing' },
  pageInfo: { id: 'p1', name: 'Home', displayName: 'Home', path: '/' },
};

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

// ---------------------------------------------------------------------------
// Fetch envelope fixtures used by the focus-map tests.
// ---------------------------------------------------------------------------

const ONE_PX_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

const SERVER_ENVELOPE_OK = { ok: true, image: ONE_PX_PNG_BASE64 };
const SERVER_ENVELOPE_NOT_FOUND = {
  ok: false,
  error: {
    code: 'not_found',
    message: 'Save the page first, then try again.',
  },
};

// ---------------------------------------------------------------------------
// Wire the SDK stub's `query`: application.context resolves immediately;
// pages.context captures the onSuccess callback for manual driving.
// ---------------------------------------------------------------------------

interface PagesEmitter {
  emit: (payload: unknown) => void;
}

function wireSdkQuery(stubs: SdkStubBundle): PagesEmitter {
  let pagesOnSuccess: ((data: unknown) => void) | undefined;
  const unsubscribe = vi.fn();

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
    emit: (payload: unknown) => {
      if (!pagesOnSuccess) {
        throw new Error(
          '[test] pages.context onSuccess callback not captured yet — await provider wiring',
        );
      }
      pagesOnSuccess(payload);
    },
  };
}

// ---------------------------------------------------------------------------
// Per-test setup + teardown.
// ---------------------------------------------------------------------------

let fetchMock: InstalledFetchMock | null = null;
let clipboardInstalled: ReturnType<typeof installClipboard> | null = null;
let originalCreateObjectURL: typeof URL.createObjectURL;
let originalRevokeObjectURL: typeof URL.revokeObjectURL;

beforeEach(() => {
  sdkHarness.stubs = createSdkStubs();
  sdkHarness.initCalls = [];

  originalCreateObjectURL = URL.createObjectURL;
  originalRevokeObjectURL = URL.revokeObjectURL;
  URL.createObjectURL = vi.fn(() => 'blob:test-url');
  URL.revokeObjectURL = vi.fn();
});

afterEach(() => {
  if (fetchMock) {
    fetchMock.restore();
    fetchMock = null;
  }
  if (clipboardInstalled) {
    clipboardInstalled.restore();
    clipboardInstalled = null;
  }
  URL.createObjectURL = originalCreateObjectURL;
  URL.revokeObjectURL = originalRevokeObjectURL;
  vi.clearAllMocks();
});

/**
 * Render the real `<MarketplaceProvider>` + `<PageshotPanel>` tree, then
 * deliver the canonical pages.context payload to flip the hook to populated
 * values.
 */
async function mountPanel() {
  if (!sdkHarness.stubs) throw new Error('stubs not installed');
  const emitter = wireSdkQuery(sdkHarness.stubs);

  const result = render(
    <MarketplaceProvider>
      <PageshotPanel />
    </MarketplaceProvider>,
  );

  await waitFor(() => {
    expect(sdkHarness.stubs!.query).toHaveBeenCalledWith(
      'pages.context',
      expect.objectContaining({ subscribe: true }),
    );
  });

  await act(async () => {
    emitter.emit(CANONICAL_PAGES_CONTEXT);
  });

  return { emitter, ...result };
}

// ---------------------------------------------------------------------------
// T024a-TEST-1 — Shutter is document.activeElement after first non-null
//                pages.context.
// ---------------------------------------------------------------------------

describe('T024a-TEST-1 — Shutter auto-focus on panel mount with valid pages.context', () => {
  it('moves focus to the Shutter button after the first onSuccess event', async () => {
    fetchMock = installFetchMock({
      '/api/screenshot/': { status: 200, body: SERVER_ENVELOPE_OK },
    });
    await mountPanel();

    await waitFor(() => {
      const shutter = screen.getByRole('button', { name: /capture screenshot/i });
      expect(document.activeElement).toBe(shutter);
    });
  });
});

// ---------------------------------------------------------------------------
// T024a-TEST-2 — capturing → ready moves focus to Copy (preventScroll)
// ---------------------------------------------------------------------------

describe('T024a-TEST-2 — capturing → ready moves focus to Copy (preventScroll: true)', () => {
  it('focuses the Copy pill on ready state with preventScroll: true', async () => {
    fetchMock = installFetchMock({
      '/api/screenshot/': { status: 200, body: SERVER_ENVELOPE_OK },
    });
    clipboardInstalled = installClipboard({ mode: 'ok' });
    const focusSpy = vi.spyOn(HTMLElement.prototype, 'focus');

    await mountPanel();

    const shutter = screen.getByRole('button', { name: /capture screenshot/i });
    await act(async () => {
      fireEvent.click(shutter);
    });

    const copyBtn = await screen.findByRole('button', { name: /^copy$/i });
    await waitFor(() => {
      expect(document.activeElement).toBe(copyBtn);
    });

    // Assert at least one focus call was made with { preventScroll: true }.
    const calledWithPreventScroll = focusSpy.mock.calls.some((args) => {
      const opts = args[0] as { preventScroll?: boolean } | undefined;
      return opts?.preventScroll === true;
    });
    expect(calledWithPreventScroll).toBe(true);

    focusSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// T024a-TEST-3 — capturing → error moves focus to Retry
// ---------------------------------------------------------------------------

describe('T024a-TEST-3 — capturing → error moves focus to Retry pill', () => {
  it('focuses the Retry pill when the fetch returns a not_found envelope', async () => {
    fetchMock = installFetchMock({
      '/api/screenshot/': { status: 200, body: SERVER_ENVELOPE_NOT_FOUND },
    });
    await mountPanel();

    const shutter = screen.getByRole('button', { name: /capture screenshot/i });
    await act(async () => {
      fireEvent.click(shutter);
    });

    const retryBtn = await screen.findByRole('button', { name: /^retry$/i });
    await waitFor(() => {
      expect(document.activeElement).toBe(retryBtn);
    });
  });
});

// ---------------------------------------------------------------------------
// T024a-TEST-4 — Escape returns focus to Shutter from any inner focusable
// ---------------------------------------------------------------------------

describe('T024a-TEST-4 — Escape returns focus to Shutter', () => {
  it('pressing Escape while Copy is focused returns focus to the Shutter button', async () => {
    fetchMock = installFetchMock({
      '/api/screenshot/': { status: 200, body: SERVER_ENVELOPE_OK },
    });
    clipboardInstalled = installClipboard({ mode: 'ok' });
    await mountPanel();

    const shutter = screen.getByRole('button', { name: /capture screenshot/i });
    await act(async () => {
      fireEvent.click(shutter);
    });

    const copyBtn = await screen.findByRole('button', { name: /^copy$/i });
    await waitFor(() => {
      expect(document.activeElement).toBe(copyBtn);
    });

    await act(async () => {
      fireEvent.keyDown(copyBtn, { key: 'Escape', code: 'Escape' });
    });
    await waitFor(() => {
      expect(document.activeElement).toBe(shutter);
    });
  });
});

// ---------------------------------------------------------------------------
// T024a-TEST-5 — Tab order equals DOM order
// ---------------------------------------------------------------------------

describe('T024a-TEST-5 — Tab order equals DOM order (Shutter → Copy → Download | Shutter → Retry)', () => {
  it('in ready state, Shutter precedes Copy precedes Download in DOM order', async () => {
    fetchMock = installFetchMock({
      '/api/screenshot/': { status: 200, body: SERVER_ENVELOPE_OK },
    });
    clipboardInstalled = installClipboard({ mode: 'ok' });
    await mountPanel();

    const shutter = screen.getByRole('button', { name: /capture screenshot/i });
    await act(async () => {
      fireEvent.click(shutter);
    });

    const copyBtn = await screen.findByRole('button', { name: /^copy$/i });
    const downloadBtn = await screen.findByRole('button', { name: /^download$/i });

    expect(
      shutter.compareDocumentPosition(copyBtn) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      copyBtn.compareDocumentPosition(downloadBtn) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('in error state, Shutter precedes Retry in DOM order', async () => {
    fetchMock = installFetchMock({
      '/api/screenshot/': { status: 200, body: SERVER_ENVELOPE_NOT_FOUND },
    });
    await mountPanel();

    const shutter = screen.getByRole('button', { name: /capture screenshot/i });
    await act(async () => {
      fireEvent.click(shutter);
    });

    const retryBtn = await screen.findByRole('button', { name: /^retry$/i });
    expect(
      shutter.compareDocumentPosition(retryBtn) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});
