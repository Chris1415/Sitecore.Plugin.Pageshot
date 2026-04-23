'use client';

/**
 * T015 — `<ShutterLabel>` + sub-line elapsed counter — Blok redesign pass.
 *
 * Text-only composition. Colours migrate from the Shutterbug stone/amber
 * palette to Blok semantic tokens (`text-foreground` main, `text-primary-fg`
 * elapsed counter) so the label flips under dark mode with the rest of the
 * theme.
 *
 * Copy (verbatim from § 4c-4):
 *   - Main label: "Capture" in idle / disabled, "Capturing…" in capturing states.
 *   - Sub-line (capturing-slow only): "Still catching… {n} s" in Geist Mono.
 */

import { cn } from '@/lib/utils';

import type { ShutterState } from './Shutter';

export interface ShutterLabelProps {
  state: ShutterState;
  elapsedSeconds?: number;
}

function mainLabel(state: ShutterState): string {
  return state === 'capturing' || state === 'capturing-slow'
    ? 'Capturing\u2026'
    : 'Capture';
}

export function ShutterLabel({ state, elapsedSeconds }: ShutterLabelProps) {
  const showSub =
    state === 'capturing-slow' && typeof elapsedSeconds === 'number';
  const subText = showSub ? `Still catching\u2026 ${elapsedSeconds} s` : '';

  return (
    <div className="mt-4 flex flex-col items-center gap-1 text-center">
      <span
        data-testid="shutter-label-main"
        className={cn(
          'font-sans text-[13px] font-medium text-foreground',
        )}
      >
        {mainLabel(state)}
      </span>
      {showSub ? (
        <span
          data-testid="shutter-label-sub"
          className="font-mono text-[11px] text-primary-fg"
          role="text"
        >
          {subText}
        </span>
      ) : null}
    </div>
  );
}
