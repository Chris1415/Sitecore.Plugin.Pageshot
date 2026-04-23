'use client';

/**
 * T017b — `<PolaroidCard>` ready + error variants — Blok redesign pass.
 *
 * Replaces the Shutterbug amber-shadowed polaroid frame with a Blok
 * `<Card>`-shaped surface: neutral background, subtle border, Blok semantic
 * tokens for text + icons. The "polaroid" idiom is preserved — an image slot
 * with a narrow "ledge" footer below — but the visual language is neutral
 * and dark-mode-friendly.
 *
 * Copy source of truth: § 4c-4 ("Error card", "Error-card per-code copy",
 * "Error icon mapping"). Functional behaviour (discriminated union props,
 * alt-text contract, reduced-motion arrival, image slot scrolling, ledge
 * format, data-testid attributes) is unchanged.
 *
 * Accessibility:
 *   - `<img alt="Screenshot of page {pageName} on {siteName}, captured {capturedAt}">`
 *   - Error title uses `text-danger-fg` (Blok destructive foreground token)
 *     which meets WCAG 2.1 AA contrast for small text; historical contract
 *     was specifically `text-rose-600`. Switching to the token makes the
 *     surface dark-mode-aware.
 *   - Reduced motion collapses the slide-up to opacity only.
 */

import { AlertCircle, WifiOff } from 'lucide-react';
import { useEffect, useState } from 'react';

import { cn } from '@/lib/utils';

import type { PanelErrorCode } from './use-panel-state';

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
      expanded?: boolean;
    }
  | {
      kind: 'error';
      code: PanelErrorCode;
    };

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
        className="flex h-8 w-8 items-center justify-center text-danger-500"
        aria-hidden="true"
      >
        <WifiOff className="h-8 w-8" strokeWidth={1.5} />
      </span>
    );
  }
  return (
    <span
      data-testid="polaroid-error-icon-alert-circle"
      className="flex h-8 w-8 items-center justify-center text-danger-500"
      aria-hidden="true"
    >
      <AlertCircle className="h-8 w-8" strokeWidth={1.5} />
    </span>
  );
}

export function PolaroidCard(props: PolaroidCardProps) {
  const reducedMotion = usePrefersReducedMotion();

  // Arrival motion — same frame for both variants. Reduced-motion drops the
  // translate and keeps opacity only (per § 4c-4). Shadow + border use Blok
  // tokens so the card follows the theme (light / dark) automatically.
  const rootClassName = cn(
    'rounded-3xl border border-border bg-card p-2 shadow-sm',
    '@container/polaroid transition-[opacity,transform] duration-[240ms] ease-[cubic-bezier(0.2,0.9,0.2,1)]',
    'opacity-100',
    !reducedMotion && 'translate-y-0',
  );

  if (props.kind === 'ready') {
    const { imageBase64, siteName, pageName, capturedAt, expanded = false } = props;
    const altText = `Screenshot of page ${pageName} on ${siteName}, captured ${capturedAt.toLocaleString()}`;
    const imageSlotClass = expanded
      ? 'overflow-hidden rounded-2xl bg-muted'
      : 'max-h-[420px] overflow-y-auto overflow-x-hidden rounded-2xl bg-muted';
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
            'mt-1 flex items-center justify-between gap-2 border-t border-border',
            'px-3 py-2 font-mono text-[11px] text-muted-foreground',
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

  // Error variant — same frame, danger-foreground title, AlertCircle/WifiOff
  // icon from the catalogue.
  const entry = ERROR_CATALOGUE[props.code];
  return (
    <div data-testid="polaroid-root" className={rootClassName}>
      <div
        className={cn(
          'flex aspect-[4/3] flex-col items-center justify-center gap-2',
          'overflow-hidden rounded-2xl bg-muted px-4 text-center',
        )}
      >
        <ErrorIcon kind={entry.icon} />
        <p
          data-testid="polaroid-error-title"
          className="text-sm font-medium text-danger-fg"
        >
          {entry.title}
        </p>
        <p
          data-testid="polaroid-error-subtitle"
          className="max-w-[28ch] text-xs text-muted-foreground"
        >
          {entry.subtitle}
        </p>
      </div>
      <div
        data-testid="polaroid-ledge"
        className={cn(
          'mt-1 flex items-center justify-center border-t border-border',
          'px-3 py-2 text-[11px] italic text-muted-foreground text-center',
        )}
      >
        {LAST_SAVED_HINT}
      </div>
    </div>
  );
}
