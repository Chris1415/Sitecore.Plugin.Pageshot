'use client';

/**
 * T015 — `<ShutterLabel>` + sub-line elapsed counter.
 *
 * Non-code-style scaffolding per § 9.3 — the label is composition only; its
 * behavior is covered by the T014b + T016b suites (the Shutter parent changes
 * label text on state transitions; the elapsed-time controller drives the
 * `capturing-slow` sub-line visibility).
 *
 * Props (per § 4 T015):
 *   - `state`            — mirrors `<Shutter>`'s state union.
 *   - `elapsedSeconds?`  — integer seconds to display once the sub-line is
 *                          visible (state `capturing-slow`). Ignored for other
 *                          states.
 *
 * Copy (verbatim from § 4c-4):
 *   - Main label: "Capture" in idle / disabled, "Capturing…" in capturing states.
 *   - Sub-line (capturing-slow only): "Still catching… {n} s" in Geist Mono,
 *     amber-700.
 *
 * Sizing: Geist Sans 500 / 13 px main label (14 px under the `md` container
 * query — implemented via Tailwind's `@container` modifier once layout wires
 * it in T019; Phase 1 keeps the base 13 px).
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
          'font-sans text-[13px] font-medium text-stone-900',
          // The `md` container query lifts this to 14 px once the panel is
          // assembled (T019); kept out of Phase 1 to avoid reshaping the token
          // surface.
        )}
      >
        {mainLabel(state)}
      </span>
      {showSub ? (
        <span
          data-testid="shutter-label-sub"
          className="font-mono text-[11px] text-amber-700"
          role="text"
        >
          {subText}
        </span>
      ) : null}
    </div>
  );
}
