/**
 * The announcer's contract: one sr-only polite region, most-recent-wins, and
 * the seven catalogue strings asserted at their EXACT wording.
 * See docs/build-decisions.md#live-region.
 */

import { describe, it, expect } from 'vitest';
import { act, render, renderHook, screen } from '@testing-library/react';
import { useEffect } from 'react';
import type { ReactNode } from 'react';

import {
  ANNOUNCEMENTS,
  LiveRegion,
  LiveRegionProvider,
  useAnnounce,
} from './LiveRegion';
import type { PanelErrorCode } from './use-panel-state';

/**
 * Standard wrapper — a provider containing both the `<LiveRegion>` output
 * node and a consumer that exposes `announce()`. Tests compose this to render
 * the region + drive announcements through the same API the panel will use.
 */
function Wrapper({ children }: { children: ReactNode }) {
  return (
    <LiveRegionProvider>
      <LiveRegion />
      {children}
    </LiveRegionProvider>
  );
}

/**
 * Capture the `announce` callback from a consumer into a holder object —
 * using a mutable object field (not a `let` rebind) keeps the react-hooks
 * purity linter happy. The consumer writes the callback in a post-commit
 * effect so render stays pure.
 */
interface AnnounceHolder {
  current: (msg: string) => void;
}
function AnnounceConsumer({ holderRef }: { holderRef: AnnounceHolder }) {
  const announce = useAnnounce();
  useEffect(() => {
    holderRef.current = announce;
  }, [announce, holderRef]);
  return null;
}

// -----------------------------------------------------------------------------
// T023a-TEST-1 — Renders role="status", aria-live="polite", .sr-only
// -----------------------------------------------------------------------------
describe('T023a-TEST-1 — renders role="status" + aria-live="polite" + .sr-only', () => {
  it('renders exactly one region with the correct ARIA attributes and the sr-only class', () => {
    render(
      <Wrapper>
        <div data-testid="consumer" />
      </Wrapper>,
    );

    // `getByRole('status')` confirms role is exposed to the a11y tree.
    const region = screen.getByRole('status');
    expect(region).toBeInTheDocument();
    expect(region).toHaveAttribute('aria-live', 'polite');
    // The region is visually hidden via Tailwind v4's `.sr-only` utility.
    expect(region.className).toMatch(/\bsr-only\b/);
  });
});

// -----------------------------------------------------------------------------
// T023a-TEST-2 — announce() updates text content
// -----------------------------------------------------------------------------
describe('T023a-TEST-2 — announce() updates the region text content', () => {
  it('transitions the region text from empty → "Hello" → "World"', () => {
    const holderRef: AnnounceHolder = { current: () => undefined };

    render(
      <Wrapper>
        <AnnounceConsumer holderRef={holderRef} />
      </Wrapper>,
    );

    const region = screen.getByRole('status');
    // Initial: empty.
    expect(region.textContent ?? '').toBe('');

    act(() => {
      holderRef.current('Hello');
    });
    expect(region.textContent).toBe('Hello');

    act(() => {
      holderRef.current('World');
    });
    // Most-recent-wins: second announcement replaces the first.
    expect(region.textContent).toBe('World');
  });

  it('useAnnounce() returns a stable callable (not null) when used inside provider', () => {
    const { result } = renderHook(() => useAnnounce(), {
      wrapper: ({ children }) => (
        <LiveRegionProvider>{children}</LiveRegionProvider>
      ),
    });
    expect(typeof result.current).toBe('function');
  });
});

// -----------------------------------------------------------------------------
// T023a-TEST-3 — Each state change fires the exact expected announcement
// -----------------------------------------------------------------------------
describe('T023a-TEST-3 — each state change fires the exact expected announcement (table-driven)', () => {
  it('ANNOUNCEMENTS.readyToCapture === "Ready to capture."', () => {
    expect(ANNOUNCEMENTS.readyToCapture).toBe('Ready to capture.');
  });

  it('ANNOUNCEMENTS.capturingStarted === "Capturing started."', () => {
    expect(ANNOUNCEMENTS.capturingStarted).toBe('Capturing started.');
  });

  it('ANNOUNCEMENTS.stillCapturing(N) substitutes integer seconds', () => {
    expect(ANNOUNCEMENTS.stillCapturing(5)).toBe('Still capturing, 5 seconds.');
    expect(ANNOUNCEMENTS.stillCapturing(12)).toBe('Still capturing, 12 seconds.');
  });

  it('ANNOUNCEMENTS.screenshotReady === "Screenshot ready."', () => {
    expect(ANNOUNCEMENTS.screenshotReady).toBe('Screenshot ready.');
  });

  it('ANNOUNCEMENTS.copiedToClipboard === "Copied to clipboard."', () => {
    expect(ANNOUNCEMENTS.copiedToClipboard).toBe('Copied to clipboard.');
  });

  it('ANNOUNCEMENTS.downloadStarted === "Download started."', () => {
    expect(ANNOUNCEMENTS.downloadStarted).toBe('Download started.');
  });

  // ------ Error code table (5 × `captureFailed(code)`) --------------------
  const errorCases: Array<{
    code: PanelErrorCode;
    expected: string;
  }> = [
    {
      code: 'auth',
      expected:
        "Capture failed: Authentication failed. Ask your administrator to check the app's credentials.",
    },
    {
      code: 'not_found',
      expected:
        "Capture failed: We couldn't find that page. Save the page first, then try again.",
    },
    {
      code: 'upstream_unavailable',
      expected:
        'Capture failed: Screenshot service is unavailable. Try again in a moment.',
    },
    {
      code: 'network',
      expected:
        'Capture failed: You appear to be offline. Check your connection, then try again.',
    },
    {
      code: 'unknown',
      expected: 'Capture failed: Something went wrong. Try again in a moment.',
    },
  ];

  for (const { code, expected } of errorCases) {
    it(`ANNOUNCEMENTS.captureFailed("${code}") === "${expected}"`, () => {
      expect(ANNOUNCEMENTS.captureFailed(code)).toBe(expected);
    });
  }

  // ------ Round-trip: announce() → region text matches catalogue entry ---
  it('announcing ANNOUNCEMENTS.capturingStarted lands verbatim in the region', () => {
    const holderRef: AnnounceHolder = { current: () => undefined };
    render(
      <Wrapper>
        <AnnounceConsumer holderRef={holderRef} />
      </Wrapper>,
    );

    act(() => {
      holderRef.current(ANNOUNCEMENTS.capturingStarted);
    });
    const region = screen.getByRole('status');
    expect(region.textContent).toBe('Capturing started.');
  });

  it('announcing ANNOUNCEMENTS.captureFailed("not_found") lands verbatim in the region', () => {
    const holderRef: AnnounceHolder = { current: () => undefined };
    render(
      <Wrapper>
        <AnnounceConsumer holderRef={holderRef} />
      </Wrapper>,
    );

    act(() => {
      holderRef.current(ANNOUNCEMENTS.captureFailed('not_found'));
    });
    const region = screen.getByRole('status');
    expect(region.textContent).toBe(
      "Capture failed: We couldn't find that page. Save the page first, then try again.",
    );
  });
});
