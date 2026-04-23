'use client';

/**
 * T023b — `<LiveRegion>` accessibility announcer.
 *
 * Source of truth: § 4 T023b / § 4c-4 "Announcement catalogue" / PRD NFR-A-01 /
 * POC v2 `#live-region`.
 *
 * This module exposes four things:
 *
 *   - `<LiveRegionProvider>` — React context wrapping the panel tree. Holds
 *                              the current announcement message + an
 *                              `announce(msg)` callback.
 *   - `<LiveRegion>`         — the sr-only `role="status"` + `aria-live="polite"`
 *                              DOM node that assistive tech reads. Renders the
 *                              most recent message; most-recent-wins semantics.
 *   - `useAnnounce()`        — returns the `announce(msg: string) => void`
 *                              callback that any child can call on state
 *                              transitions (reducer, copy hook, download hook).
 *   - `ANNOUNCEMENTS`        — the seven exact catalogue entries from § 4c-4.
 *                              Strings are literal constants; builders
 *                              (`stillCapturing(n)`, `captureFailed(code)`)
 *                              substitute their parameter into the template
 *                              using the `<PanelErrorCode>` → title/subtitle
 *                              lookup already exported by `<PolaroidCard>`.
 *
 * Accessibility contract (§ 4c-4 "Accessibility"):
 *   - Single sr-only `<div role="status" aria-live="polite">` receives all
 *     announcements.
 *   - Polite (not assertive) — the panel's actions are never blocking, so
 *     screen readers should queue messages after the current utterance.
 */

import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { ERROR_CATALOGUE } from './PolaroidCard';
import type { PanelErrorCode } from './use-panel-state';

// -----------------------------------------------------------------------------
// Announcement catalogue — § 4c-4 (seven exact entries)
// -----------------------------------------------------------------------------

/**
 * Build the `"Still capturing, N seconds."` entry. The count is rendered as
 * an integer — callers pass `Math.floor(elapsedMs / 1000)` from the elapsed-
 * time controller (T016b).
 */
function buildStillCapturing(seconds: number): string {
  return `Still capturing, ${seconds} seconds.`;
}

/**
 * Build the `"Capture failed: <title>. <subtitle>."` entry for the given
 * error code. Title + subtitle come from the shared `ERROR_CATALOGUE`
 * exported by `<PolaroidCard>` so the copy is authoritative in one place.
 */
function buildCaptureFailed(code: PanelErrorCode): string {
  const entry = ERROR_CATALOGUE[code];
  // Title + subtitle already end in a period per § 4c-4 copy — concatenate
  // with a single space to produce the announcement.
  return `Capture failed: ${entry.title} ${entry.subtitle}`;
}

/**
 * Exact wording for every state-change announcement — mirrors § 4c-4 one-for-one.
 * Test T023a-TEST-3 asserts these are literal and the builders substitute
 * their argument.
 */
export const ANNOUNCEMENTS = {
  readyToCapture: 'Ready to capture.',
  capturingStarted: 'Capturing started.',
  stillCapturing: buildStillCapturing,
  screenshotReady: 'Screenshot ready.',
  copiedToClipboard: 'Copied to clipboard.',
  downloadStarted: 'Download started.',
  captureFailed: buildCaptureFailed,
} as const;

// -----------------------------------------------------------------------------
// Context + provider + hooks
// -----------------------------------------------------------------------------

type AnnounceFn = (msg: string) => void;

interface LiveRegionContextValue {
  message: string;
  announce: AnnounceFn;
}

const LiveRegionContext = createContext<LiveRegionContextValue | null>(null);

export interface LiveRegionProviderProps {
  children: ReactNode;
}

export function LiveRegionProvider({ children }: LiveRegionProviderProps) {
  const [message, setMessage] = useState<string>('');

  // Most-recent-wins semantics. We do not accumulate messages — polite
  // regions read the latest `textContent` change and that is sufficient for
  // the transition-per-state model § 4c-4 prescribes.
  const announce = useCallback<AnnounceFn>((msg) => {
    setMessage(msg);
  }, []);

  const value = useMemo<LiveRegionContextValue>(
    () => ({ message, announce }),
    [message, announce],
  );

  return (
    <LiveRegionContext.Provider value={value}>
      {children}
    </LiveRegionContext.Provider>
  );
}

/**
 * `useAnnounce()` — returns the `announce(msg)` callback. Safe to call
 * outside the provider: a no-op fallback lets pre-mount code paths skip
 * announcements without throwing. Inside the provider, the callback drives
 * the region text.
 */
export function useAnnounce(): AnnounceFn {
  const ctx = useContext(LiveRegionContext);
  if (!ctx) {
    // Outside a provider — treat as no-op. The panel always wraps its tree
    // in `<LiveRegionProvider>`, so this path is only hit by isolated test
    // renders that don't need announcements.
    return NOOP_ANNOUNCE;
  }
  return ctx.announce;
}

const NOOP_ANNOUNCE: AnnounceFn = () => undefined;

/**
 * `<LiveRegion>` — the sr-only status node. Renders the latest announcement
 * from the surrounding `<LiveRegionProvider>`. When rendered outside a
 * provider (misuse), it renders an empty region silently.
 */
export function LiveRegion() {
  const ctx = useContext(LiveRegionContext);
  const message = ctx?.message ?? '';
  return (
    <div
      data-testid="live-region"
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="sr-only"
    >
      {message}
    </div>
  );
}
