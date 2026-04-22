'use client';

/**
 * T017b — `<PolaroidCard>` ready + error variants.
 *
 * Visual source of truth: `products/pageshot/pocs/poc-v2/index.html`
 * `.polaroid` / `.polaroid-slot` / `.polaroid-ledge` blocks. Copy source of
 * truth: § 4c-4 of the task breakdown ("Polaroid preview card",
 * "Error card", "Error-card per-code copy", "Error icon mapping").
 *
 * Props — discriminated union per § 4 T017b:
 *   - `{ kind: 'ready';  imageBase64; siteName; pageName; capturedAt }`
 *   - `{ kind: 'error';  code }`  // copy is looked up from ERROR_CATALOGUE below
 *
 * Accessibility (§ 4c-4 + § 4 T017b):
 *   - `<img alt="Screenshot of page {pageName} on {siteName}, captured {capturedAt}">`
 *   - Error title is `text-rose-600` (5.7:1 contrast per spec § 4.5), NOT -500.
 *   - Reduced motion collapses the slide-up entrance to opacity-only.
 */

import { AlertCircle, WifiOff } from 'lucide-react';
import { useEffect, useState } from 'react';

import { cn } from '@/lib/utils';

import type { PanelErrorCode } from './use-panel-state';

/**
 * § 4c-4 copy + icon catalogue for the error card. Kept inline (not a separate
 * constants file) because this is the only consumer in Phase 2. If
 * `<InlineMessage>` or the announcement catalogue (T023) later share the copy
 * it can be lifted.
 */
type ErrorIconKind = 'alert-circle' | 'wifi-off';

interface ErrorEntry {
  title: string;
  subtitle: string;
  icon: ErrorIconKind;
}

export const ERROR_CATALOGUE: Record<PanelErrorCode, ErrorEntry> = {
  auth: {
    title: 'Authentication failed.',
    subtitle: "Ask your administrator to check the app's credentials.",
    icon: 'alert-circle',
  },
  not_found: {
    title: "We couldn't find that page.",
    subtitle: 'Save the page first, then try again.',
    icon: 'alert-circle',
  },
  upstream_unavailable: {
    title: 'Screenshot service is unavailable.',
    subtitle: 'Try again in a moment.',
    icon: 'alert-circle',
  },
  network: {
    title: 'You appear to be offline.',
    subtitle: 'Check your connection, then try again.',
    icon: 'wifi-off',
  },
  unknown: {
    title: 'Something went wrong.',
    subtitle: 'Try again in a moment.',
    icon: 'alert-circle',
  },
};

// FR-12 static hint shown on the error ledge.
const LAST_SAVED_HINT = 'Shows the last saved version of this page.';

export type PolaroidCardProps =
  | {
      kind: 'ready';
      imageBase64: string;
      siteName: string;
      pageName: string;
      capturedAt: Date;
      /**
       * When `true`, the image slot has no height cap — the polaroid grows
       * to fit the full screenshot inline. When `false` (default), the
       * slot is capped at 420 px and scrolls internally for tall pages.
       */
      expanded?: boolean;
    }
  | {
      kind: 'error';
      code: PanelErrorCode;
    };

/**
 * Read `prefers-reduced-motion: reduce`. Same pattern as `<Shutter>`.
 * Lazy-initialised from `matchMedia`; re-subscribes on mount. SSR-safe.
 */
function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState<boolean>(() => {
    if (typeof window === 'undefined' || !window.matchMedia) {
      return false;
    }
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) {
      return;
    }
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    const listener = (event: MediaQueryListEvent) => setReduced(event.matches);
    mql.addEventListener?.('change', listener);
    return () => mql.removeEventListener?.('change', listener);
  }, []);

  return reduced;
}

function formatHhMm(d: Date): string {
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

function ErrorIcon({ kind }: { kind: ErrorIconKind }) {
  if (kind === 'wifi-off') {
    return (
      <span
        data-testid="polaroid-error-icon-wifi-off"
        className="flex h-8 w-8 items-center justify-center text-rose-500"
        aria-hidden="true"
      >
        <WifiOff className="h-8 w-8" strokeWidth={1.5} />
      </span>
    );
  }
  return (
    <span
      data-testid="polaroid-error-icon-alert-circle"
      className="flex h-8 w-8 items-center justify-center text-rose-500"
      aria-hidden="true"
    >
      <AlertCircle className="h-8 w-8" strokeWidth={1.5} />
    </span>
  );
}

export function PolaroidCard(props: PolaroidCardProps) {
  const reducedMotion = usePrefersReducedMotion();

  // Arrival motion — same frame for both variants. Reduced-motion drops the
  // translate and keeps opacity only (per § 4c-4). The `translate-y-0` state
  // is what the card rests at; we always include it here so the class is
  // stable across tests. The `translate-y-2` entrance utility is only added
  // when motion is allowed.
  const rootClassName = cn(
    'rounded-3xl border border-stone-200/60 bg-white p-2 shadow-polaroid',
    '@container/polaroid transition-[opacity,transform] duration-[240ms] ease-[cubic-bezier(0.2,0.9,0.2,1)]',
    'opacity-100',
    !reducedMotion && 'translate-y-0',
  );

  if (props.kind === 'ready') {
    const { imageBase64, siteName, pageName, capturedAt, expanded = false } = props;
    const altText = `Screenshot of page ${pageName} on ${siteName}, captured ${capturedAt.toLocaleString()}`;
    // Compact (default): 420 px cap + scrollable for tall pages.
    // Expanded: no cap, polaroid grows to the image's natural height.
    // In both states Copy + Download ship the same full-resolution PNG.
    const imageSlotClass = expanded
      ? 'overflow-hidden rounded-2xl bg-stone-100'
      : 'max-h-[420px] overflow-y-auto overflow-x-hidden rounded-2xl bg-stone-100';
    return (
      <div data-testid="polaroid-root" className={rootClassName}>
        <div data-testid="polaroid-image-slot" className={imageSlotClass}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`data:image/png;base64,${imageBase64}`}
            alt={altText}
            className="block h-auto w-full"
          />
        </div>
        <div
          data-testid="polaroid-ledge"
          className={cn(
            'mt-1 flex items-center justify-between gap-2 border-t border-stone-200/60',
            'px-3 py-2 font-mono text-[11px] text-stone-600',
          )}
        >
          <span
            data-testid="polaroid-ledge-site-page"
            className="truncate"
          >{`${siteName}/${pageName}`}</span>
          <span
            data-testid="polaroid-ledge-time"
            className="truncate"
          >{formatHhMm(capturedAt)}</span>
        </div>
      </div>
    );
  }

  // Error variant — same frame, rose-600 title, AlertCircle/WifiOff icon.
  const entry = ERROR_CATALOGUE[props.code];
  return (
    <div data-testid="polaroid-root" className={rootClassName}>
      <div
        className={cn(
          'flex aspect-[4/3] flex-col items-center justify-center gap-2',
          'overflow-hidden rounded-2xl bg-stone-50 px-4 text-center',
        )}
      >
        <ErrorIcon kind={entry.icon} />
        <p
          data-testid="polaroid-error-title"
          className="text-sm font-medium text-rose-600"
        >
          {entry.title}
        </p>
        <p
          data-testid="polaroid-error-subtitle"
          className="max-w-[28ch] text-xs text-stone-600"
        >
          {entry.subtitle}
        </p>
      </div>
      <div
        data-testid="polaroid-ledge"
        className={cn(
          'mt-1 flex items-center justify-center border-t border-stone-200/60',
          'px-3 py-2 text-[11px] italic text-stone-500 text-center',
        )}
      >
        {LAST_SAVED_HINT}
      </div>
    </div>
  );
}
