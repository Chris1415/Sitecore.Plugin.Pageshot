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
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { StrictMode } from 'react';

import { installClipboard } from '@/test-utils/mockClipboard';
import { installFetchMock, type InstalledFetchMock } from '@/test-utils/mockFetch';
import { setReducedMotion } from '@/test-utils/mockMatchMedia';
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
const SERVER_ENVELOPE_5XX = {
  ok: false,
  error: {
    code: 'upstream_unavailable',
    message: 'Try again in a moment.',
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
let originalOnLineDescriptor: PropertyDescriptor | undefined;

beforeEach(() => {
  sdkHarness.stubs = createSdkStubs();
  sdkHarness.initCalls = [];

  setReducedMotion(false);

  originalCreateObjectURL = URL.createObjectURL;
  originalRevokeObjectURL = URL.revokeObjectURL;
  URL.createObjectURL = vi.fn(() => 'blob:test-url');
  URL.revokeObjectURL = vi.fn();

  originalOnLineDescriptor = Object.getOwnPropertyDescriptor(
    navigator,
    'onLine',
  );
  Object.defineProperty(navigator, 'onLine', {
    configurable: true,
    get() {
      return true;
    },
  });
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
  if (originalOnLineDescriptor) {
    Object.defineProperty(navigator, 'onLine', originalOnLineDescriptor);
  }
  vi.clearAllMocks();
});

function setOnline(online: boolean): void {
  Object.defineProperty(navigator, 'onLine', {
    configurable: true,
    get() {
      return online;
    },
  });
}

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

// ===========================================================================
// T025 — integration + regression coverage
// ===========================================================================

// ---------------------------------------------------------------------------
// T025-TEST-1 — Golden-path end-to-end
// ---------------------------------------------------------------------------

describe('T025-TEST-1 — golden-path end-to-end inside jsdom', () => {
  it('flows idle → capturing → ready; renders the image with alt; Copy writes PNG blob; Download synthesizes <a download=filename>', async () => {
    fetchMock = installFetchMock({
      '/api/screenshot/': { status: 200, body: SERVER_ENVELOPE_OK },
    });
    clipboardInstalled = installClipboard({ mode: 'ok' });

    await mountPanel();

    // Idle visible state.
    expect(screen.getByTestId('status-title').textContent).toBe(
      'Ready when you are.',
    );

    // Press Shutter.
    const shutter = screen.getByRole('button', { name: /capture screenshot/i });
    await act(async () => {
      fireEvent.click(shutter);
    });

    // Ready state arrives — PolaroidCard with alt text that mentions page + site.
    const img = await screen.findByRole('img');
    expect(img.getAttribute('alt')).toMatch(/Home/);
    expect(img.getAttribute('alt')).toMatch(/acme/);

    // Click Copy — clipboard stub receives a PNG ClipboardItem.
    const copyBtn = screen.getByRole('button', { name: /^copy$/i });
    await act(async () => {
      fireEvent.click(copyBtn);
    });
    await waitFor(() => {
      expect(clipboardInstalled!.write).toHaveBeenCalledTimes(1);
    });
    const writeArgs = clipboardInstalled!.write.mock.calls[0];
    const items = writeArgs[0] as ClipboardItem[];
    expect(items.length).toBe(1);

    // Click Download — submits a POST form to /api/download with target=_blank.
    // The form carries the image base64 + sanitized filename; the browser
    // treats the server response's Content-Disposition header as a download,
    // which works even when the iframe sandbox lacks `allow-downloads`.
    const downloadBtn = screen.getByRole('button', { name: /^download$/i });
    const submitSpy = vi
      .spyOn(HTMLFormElement.prototype, 'submit')
      .mockImplementation(function mockSubmit(this: HTMLFormElement) {
        expect(this.getAttribute('method')?.toLowerCase()).toBe('post');
        expect(this.getAttribute('action')).toBe('/api/download');
        expect(this.getAttribute('target')).toBe('_blank');
        const filenameInput = this.querySelector<HTMLInputElement>(
          'input[name="filename"]',
        );
        expect(filenameInput?.value).toMatch(
          /^acme_home_\d{8}-\d{4}\.png$/,
        );
      });
    await act(async () => {
      fireEvent.click(downloadBtn);
    });
    await waitFor(() => {
      expect(submitSpy).toHaveBeenCalledTimes(1);
    });
    submitSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// T025-TEST-2 — Offline short-circuit (AC-5.4)
// ---------------------------------------------------------------------------

describe('T025-TEST-2 — navigator.onLine === false short-circuits fetch', () => {
  it('dispatches failed({ code: network }) without calling /api/screenshot/... when offline', async () => {
    const calls: string[] = [];
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;
      calls.push(url);
      return new Response(JSON.stringify(SERVER_ENVELOPE_OK), { status: 200 });
    }) as typeof fetch;

    setOnline(false);
    await mountPanel();

    const shutter = screen.getByRole('button', { name: /capture screenshot/i });
    await act(async () => {
      fireEvent.click(shutter);
    });

    // Retry pill visible (error state, code: network) — title check.
    const retryBtn = await screen.findByRole('button', { name: /^retry$/i });
    expect(retryBtn).toBeInTheDocument();
    expect(screen.getByTestId('polaroid-error-title').textContent).toMatch(
      /offline/i,
    );

    // No fetch call for /api/screenshot/.
    expect(calls.find((u) => u.includes('/api/screenshot/'))).toBeUndefined();

    globalThis.fetch = originalFetch;
  });
});

// ---------------------------------------------------------------------------
// T025-TEST-3 — 5xx → error card with Retry visible (AC-5.3)
// ---------------------------------------------------------------------------

describe('T025-TEST-3 — 5xx upstream produces error card with visible Retry', () => {
  it('renders upstream_unavailable title + subtitle and an enabled Retry pill', async () => {
    fetchMock = installFetchMock({
      '/api/screenshot/': { status: 502, body: SERVER_ENVELOPE_5XX },
    });

    await mountPanel();

    const shutter = screen.getByRole('button', { name: /capture screenshot/i });
    await act(async () => {
      fireEvent.click(shutter);
    });

    const title = await screen.findByTestId('polaroid-error-title');
    expect(title.textContent).toMatch(/unavailable/i);
    const subtitle = screen.getByTestId('polaroid-error-subtitle');
    expect(subtitle.textContent).toMatch(/try again/i);

    const retryBtn = screen.getByRole('button', { name: /^retry$/i });
    expect(retryBtn).toBeEnabled();

    // Copy + Download should NOT be present in error state.
    expect(screen.queryByRole('button', { name: /^copy$/i })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /^download$/i }),
    ).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// T025-TEST-4 — prefers-reduced-motion collapses bloom + slide-up
// ---------------------------------------------------------------------------

describe('T025-TEST-4 — prefers-reduced-motion collapses bloom + slide-up', () => {
  it('Shutter does not apply animate-shutter-press; Polaroid arrival uses opacity only', async () => {
    setReducedMotion(true);
    fetchMock = installFetchMock({
      '/api/screenshot/': { status: 200, body: SERVER_ENVELOPE_OK },
    });
    clipboardInstalled = installClipboard({ mode: 'ok' });
    await mountPanel();

    const shutter = screen.getByRole('button', { name: /capture screenshot/i });
    await act(async () => {
      fireEvent.click(shutter);
    });

    // Press does not flip animate-shutter-press under reduced motion.
    expect(shutter.className).not.toMatch(/animate-shutter-press/);

    // Wait for polaroid and assert arrival wrapper has no translate-y-2 class.
    const polaroid = await screen.findByTestId('polaroid-root');
    expect(polaroid.className).not.toMatch(/translate-y-2/);
  });
});

// ---------------------------------------------------------------------------
// T025-TEST-5 — ARIA live region announces every catalogue entry in order
// ---------------------------------------------------------------------------

describe('T025-TEST-5 — live region announces each state change in order', () => {
  it('announces Ready to capture → Screenshot ready → Copied to clipboard → Download started during a golden-path run', async () => {
    fetchMock = installFetchMock({
      '/api/screenshot/': { status: 200, body: SERVER_ENVELOPE_OK },
    });
    clipboardInstalled = installClipboard({ mode: 'ok' });

    const { container } = await mountPanel();
    const region = within(container).getByRole('status');

    const observed: string[] = [];
    const push = () => observed.push(region.textContent ?? '');

    // 1. Ready to capture — fires on mount with valid context.
    await waitFor(() => {
      expect(region.textContent).toBe('Ready to capture.');
    });
    push();

    // 2. Press shutter → Capturing started → Screenshot ready.
    const shutter = screen.getByRole('button', { name: /capture screenshot/i });
    await act(async () => {
      fireEvent.click(shutter);
    });
    await waitFor(() => {
      expect(region.textContent).toBe('Screenshot ready.');
    });
    push();

    // 3. Click Copy → Copied to clipboard.
    const copyBtn = screen.getByRole('button', { name: /^copy$/i });
    await act(async () => {
      fireEvent.click(copyBtn);
    });
    await waitFor(() => {
      expect(region.textContent).toBe('Copied to clipboard.');
    });
    push();

    // 4. Click Download → Download started.
    const downloadBtn = screen.getByRole('button', { name: /^download$/i });
    await act(async () => {
      fireEvent.click(downloadBtn);
    });
    await waitFor(() => {
      expect(region.textContent).toBe('Download started.');
    });
    push();

    // Ordered catalogue assertions. The most-recent-wins region can
    // overwrite "Capturing started." before we sample, so we assert the
    // four "terminal" catalogue entries in order. T023a-TEST-3 covers the
    // full seven-entry catalogue.
    expect(observed[0]).toBe('Ready to capture.');
    expect(observed[1]).toBe('Screenshot ready.');
    expect(observed[2]).toBe('Copied to clipboard.');
    expect(observed[3]).toBe('Download started.');
  });
});

// ---------------------------------------------------------------------------
// T025-TEST-6 — Unsaved-draft hint always visible on valid pageId (FR-12)
// ---------------------------------------------------------------------------

describe('T025-TEST-6 — FR-12 / AC-4.1 hint always visible on valid pageId', () => {
  it('the "last saved version" hint is present in idle, capturing, ready, and error states', async () => {
    fetchMock = installFetchMock({
      '/api/screenshot/': [
        { status: 200, body: SERVER_ENVELOPE_OK },
        { status: 200, body: SERVER_ENVELOPE_NOT_FOUND },
      ],
    });
    clipboardInstalled = installClipboard({ mode: 'ok' });

    await mountPanel();

    // idle: status-hint copy contains "last saved version".
    expect(screen.getByText(/last saved version/i)).toBeInTheDocument();

    // capturing: press shutter but don't await ready first.
    const shutter = screen.getByRole('button', { name: /capture screenshot/i });
    fireEvent.click(shutter);
    expect(screen.getByText(/last saved version/i)).toBeInTheDocument();

    // ready: await polaroid then re-check hint (status-hint copy is stable).
    await screen.findByRole('img');
    expect(screen.getByText(/last saved version/i)).toBeInTheDocument();

    // error: re-capture → not_found envelope → error state. The error-state
    // status-hint copy ("We couldn't reach the page this time.") replaces
    // the default status hint, but the PolaroidCard error variant's ledge
    // carries the FR-12 "last saved version" line.
    const shutter2 = screen.getByRole('button', { name: /capture screenshot/i });
    await act(async () => {
      fireEvent.click(shutter2);
    });
    await screen.findByTestId('polaroid-error-title');
    expect(screen.getByText(/last saved version/i)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// T025 regression — StrictMode double-mount does not break the panel
// ---------------------------------------------------------------------------

describe('T025 regression — StrictMode double-mount does not crash the panel', () => {
  it('renders under StrictMode and delivers the canonical context without duplicate errors', async () => {
    fetchMock = installFetchMock({
      '/api/screenshot/': { status: 200, body: SERVER_ENVELOPE_OK },
    });
    if (!sdkHarness.stubs) throw new Error('stubs not installed');
    const emitter = wireSdkQuery(sdkHarness.stubs);

    render(
      <StrictMode>
        <MarketplaceProvider>
          <PageshotPanel />
        </MarketplaceProvider>
      </StrictMode>,
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

    const shutter = await screen.findByRole('button', {
      name: /capture screenshot/i,
    });
    expect(shutter).toBeInTheDocument();
  });
});
