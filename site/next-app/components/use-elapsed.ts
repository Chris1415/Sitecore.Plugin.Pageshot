'use client';

/**
 * Elapsed seconds since `startedAt`, but only past the 5s threshold — below it
 * the hook returns null and the sub-line is not rendered at all. No `Date.now()`
 * at render time. See docs/build-decisions.md#elapsed-threshold.
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
