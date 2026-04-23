/**
 * T016a-TEST-1..4 — `useElapsedTime` hook.
 *
 * Behavior under test (§ 4 T016b / § 4c-4 "elapsed-counter behaviour"):
 *   - The hook takes a `startedAt: number | null` timestamp (milliseconds,
 *     matching `Date.now()`). While `startedAt` is truthy, the hook ticks
 *     every 1 s and returns the integer number of elapsed seconds — but
 *     only once the 5-second threshold has been crossed. Before 5 s the
 *     hook returns `null` (the sub-line is not rendered).
 *   - When `startedAt` becomes `null` (the panel leaves `capturing`), the
 *     interval is cleared and the hook returns `null`.
 *   - Unmount clears the interval — `vi.getTimerCount()` is 0.
 *
 * The hook is intentionally decoupled from the panel state machine so the
 * 5-second threshold and the tick cadence can be unit-tested with fake timers
 * without dragging a DOM tree along. T016b's panel wiring composes this hook
 * with `<ShutterLabel>` to drive the "Still catching… {n} s" sub-line.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';

import { useElapsedTime } from './use-elapsed';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

// -----------------------------------------------------------------------------
// T016a-TEST-1 — Counter does NOT appear before 5 s
// -----------------------------------------------------------------------------
describe('T016a-TEST-1 — counter does NOT appear before 5 s', () => {
  it('returns null at 4 s / 4999 ms', () => {
    // Use an absolute startedAt anchored to the fake-clock origin (0).
    const startedAt = Date.now();
    const { result } = renderHook(() => useElapsedTime(startedAt));

    act(() => {
      vi.advanceTimersByTime(4000);
    });
    expect(result.current).toBeNull();

    act(() => {
      vi.advanceTimersByTime(999);
    });
    expect(result.current).toBeNull();
  });
});

// -----------------------------------------------------------------------------
// T016a-TEST-2 — Counter appears at exactly 5 s
// -----------------------------------------------------------------------------
describe('T016a-TEST-2 — counter appears at exactly 5 s', () => {
  it('returns 5 once 5000 ms have elapsed since startedAt', () => {
    const startedAt = Date.now();
    const { result } = renderHook(() => useElapsedTime(startedAt));

    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(result.current).toBe(5);
  });
});

// -----------------------------------------------------------------------------
// T016a-TEST-3 — Counter increments every second past 5 s
// -----------------------------------------------------------------------------
describe('T016a-TEST-3 — counter increments every second past 5 s', () => {
  it('returns 6, 7, 8 as time advances in 1 s steps', () => {
    const startedAt = Date.now();
    const { result } = renderHook(() => useElapsedTime(startedAt));

    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(result.current).toBe(5);

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current).toBe(6);

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current).toBe(7);

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current).toBe(8);
  });
});

// -----------------------------------------------------------------------------
// T016a-TEST-4 — Interval cleared on any transition out of capturing
// -----------------------------------------------------------------------------
describe('T016a-TEST-4 — interval is cleared when startedAt becomes null / unmount', () => {
  it('clears the interval when startedAt flips to null and returns null', () => {
    const startedAt: number = Date.now();
    const { result, rerender } = renderHook(
      (props: { startedAt: number | null }) => useElapsedTime(props.startedAt),
      { initialProps: { startedAt } as { startedAt: number | null } },
    );

    act(() => {
      vi.advanceTimersByTime(6000);
    });
    expect(result.current).toBe(6);

    // Flip startedAt to null (state left `capturing`).
    rerender({ startedAt: null });
    expect(result.current).toBeNull();

    // Advance another 5 s — no further ticks, no updates.
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(result.current).toBeNull();
  });

  it('clears the interval on unmount (no leaked timers)', () => {
    const startedAt = Date.now();
    const { unmount } = renderHook(() => useElapsedTime(startedAt));

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    const countBeforeUnmount = vi.getTimerCount();
    expect(countBeforeUnmount).toBeGreaterThan(0);

    unmount();

    expect(vi.getTimerCount()).toBe(0);
  });

  it('returns null and installs no timer when startedAt is null from the start', () => {
    renderHook(() => useElapsedTime(null));
    expect(vi.getTimerCount()).toBe(0);
  });
});
