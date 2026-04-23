'use client';

/**
 * T016b — `useElapsedTime(startedAt)` hook.
 *
 * Returns the elapsed integer seconds since `startedAt`, but only once the
 * **5-second threshold** has been crossed. Before the threshold the hook
 * returns `null` — the panel's sub-line is not rendered at all (§ 4c-4).
 *
 * Contract:
 *   - `startedAt: number | null` — `Date.now()`-style timestamp, or null when
 *     the panel is not in `capturing`. When null, the hook installs no timer
 *     and returns null immediately.
 *   - Return `null` while `Date.now() - startedAt < 5000`.
 *   - Return `Math.floor((Date.now() - startedAt) / 1000)` once at/past 5 s.
 *   - Ticks every 1 s until `startedAt` flips to null or the hook unmounts.
 *
 * Coupling with the panel state machine (T013) is intentional:
 *   - The panel dispatches `capture` and stores `startedAt` in the
 *     `capturing` state.
 *   - The panel reads `useElapsedTime(state.kind === 'capturing' ? state.startedAt : null)`
 *     and maps a non-null return to the "capturing-slow" visual state
 *     (§ 4c-4 label map) and to the LiveRegion "Still capturing, N seconds."
 *     announcement (T023 — out of Phase 1 scope).
 *
 * Implementation note — the elapsed value is stored in a ref and a single
 * state cell holds the value we want to render. The interval callback
 * computes `Date.now() - startedAt` and calls the state setter with the
 * clamped output. Render is a pure read of that state, no `Date.now()` at
 * render time.
 */

import { useEffect, useState } from 'react';

const ELAPSED_THRESHOLD_MS = 5000;
const TICK_INTERVAL_MS = 1000;

export function useElapsedTime(startedAt: number | null): number | null {
  // `elapsedSeconds` is updated ONLY from the interval callback. For a fresh
  // capture window it starts at null (useState initializer) and only rises
  // once the threshold is crossed. For a subsequent capture window it may
  // still hold the previous window's last value — we handle that below in
  // render by gating on `startedAt` matching the window that produced the
  // value.
  const [tracked, setTracked] = useState<{
    startedAt: number;
    seconds: number;
  } | null>(null);

  useEffect(() => {
    if (startedAt === null) {
      return;
    }

    const tick = () => {
      const elapsed = Date.now() - startedAt;
      if (elapsed >= ELAPSED_THRESHOLD_MS) {
        setTracked({ startedAt, seconds: Math.floor(elapsed / 1000) });
      }
    };

    const id = setInterval(tick, TICK_INTERVAL_MS);
    return () => {
      clearInterval(id);
    };
  }, [startedAt]);

  // Render is a pure lookup: if the tracked value belongs to the current
  // capture window, return its seconds; otherwise return null. This avoids
  // calling `Date.now()` during render (react-hooks/purity) AND calling
  // setState in the effect body (react-hooks/set-state-in-effect) for the
  // null / window-reset paths.
  if (startedAt === null || tracked === null || tracked.startedAt !== startedAt) {
    return null;
  }
  return tracked.seconds;
}
