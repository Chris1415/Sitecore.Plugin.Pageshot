/**
 * T013a-TEST-1..6 — Panel state-machine reducer.
 *
 * Behavior under test (§ 4c-6 `PanelState` type / § 4 T013b / PRD § 10 union):
 *   - Reducer transitions between `idle | capturing | ready | error`.
 *   - Events (per § 4 T013b bullets):
 *       * `capture` — idle → capturing / ready → capturing (replaces image, FR-11) /
 *                     error → capturing (Retry).
 *       * `resolved` — capturing → ready with the image payload.
 *       * `failed`   — capturing → error, copying `code` + `message` verbatim (no rewrite).
 *   - Invalid transitions are no-ops (e.g. `resolved` from `idle` or `error`).
 *   - `usePanelState()` returns `[state, dispatch]` and the initial state is
 *     `initialPanelState`, i.e. `{ kind: 'idle' }`.
 *
 * Source of truth: `PanelState` union in § 4c-6 of the task breakdown and the
 * transition bullets in § 4 T013b.
 */

import { describe, it, expect } from 'vitest';
import { act, renderHook } from '@testing-library/react';

import {
  initialPanelState,
  panelStateReducer,
  usePanelState,
  type PanelEvent,
  type PanelState,
} from './use-panel-state';

// -----------------------------------------------------------------------------
// T013a-TEST-1 — idle → capturing records `startedAt`
// -----------------------------------------------------------------------------
describe('T013a-TEST-1 — idle -> capturing records startedAt', () => {
  it('transitions from idle to capturing and preserves startedAt from the event', () => {
    const next = panelStateReducer(initialPanelState, {
      type: 'capture',
      startedAt: 123,
    });

    expect(next).toEqual({ kind: 'capturing', startedAt: 123 });
  });
});

// -----------------------------------------------------------------------------
// T013a-TEST-2 — capturing → ready with image payload
// -----------------------------------------------------------------------------
describe('T013a-TEST-2 — capturing -> ready with image payload', () => {
  it('transitions from capturing to ready and carries the image + siteName + pageName + capturedAt', () => {
    const capturedAt = new Date('2026-04-22T09:14:00');
    const capturing: PanelState = { kind: 'capturing', startedAt: 1000 };

    const next = panelStateReducer(capturing, {
      type: 'resolved',
      image: 'BASE64BYTES',
      siteName: 'acme',
      pageName: 'Home',
      capturedAt,
    });

    expect(next).toEqual({
      kind: 'ready',
      imageBase64: 'BASE64BYTES',
      siteName: 'acme',
      pageName: 'Home',
      capturedAt,
    });
    // startedAt does not survive — the next state is a different discriminant.
    expect(next).not.toHaveProperty('startedAt');
  });
});

// -----------------------------------------------------------------------------
// T013a-TEST-3 — capturing → error copies `code` + `message` verbatim
// -----------------------------------------------------------------------------
describe('T013a-TEST-3 — capturing -> error copies code + message verbatim', () => {
  it('preserves the error envelope `code` and `message` without rewriting', () => {
    const capturing: PanelState = { kind: 'capturing', startedAt: 1000 };

    const next = panelStateReducer(capturing, {
      type: 'failed',
      code: 'not_found',
      message: 'Save it first',
    });

    expect(next).toEqual({
      kind: 'error',
      code: 'not_found',
      message: 'Save it first',
    });
  });
});

// -----------------------------------------------------------------------------
// T013a-TEST-4 — ready → capturing replaces previous image (FR-11)
// -----------------------------------------------------------------------------
describe('T013a-TEST-4 — ready -> capturing replaces the previous image (FR-11)', () => {
  it('clears imageBase64 from state when a new capture starts from ready', () => {
    const ready: PanelState = {
      kind: 'ready',
      imageBase64: 'IMAGEBYTES123',
      siteName: 'acme',
      pageName: 'Home',
      capturedAt: new Date('2026-04-22T09:14:00'),
    };

    const next = panelStateReducer(ready, { type: 'capture', startedAt: 9999 });

    expect(next).toEqual({ kind: 'capturing', startedAt: 9999 });
    // Previous image is gone — neither the property nor the bytes survive.
    expect(next).not.toHaveProperty('imageBase64');
    expect(JSON.stringify(next)).not.toContain('IMAGEBYTES123');
  });
});

// -----------------------------------------------------------------------------
// T013a-TEST-5 — error → capturing on Retry
// -----------------------------------------------------------------------------
describe('T013a-TEST-5 — error -> capturing on Retry', () => {
  it('transitions from error back to capturing on a new capture event', () => {
    const errorState: PanelState = {
      kind: 'error',
      code: 'upstream_unavailable',
      message: 'Try again in a moment.',
    };

    const next = panelStateReducer(errorState, {
      type: 'capture',
      startedAt: 4242,
    });

    expect(next).toEqual({ kind: 'capturing', startedAt: 4242 });
  });
});

// -----------------------------------------------------------------------------
// T013a-TEST-6 — Invalid transitions are no-ops
// -----------------------------------------------------------------------------
describe('T013a-TEST-6 — invalid transitions are no-ops', () => {
  it('returns the same state reference when `resolved` is dispatched from idle', () => {
    const event: PanelEvent = {
      type: 'resolved',
      image: 'A',
      siteName: 'acme',
      pageName: 'Home',
      capturedAt: new Date(),
    };
    const next = panelStateReducer(initialPanelState, event);

    // No crash, same state.
    expect(next).toBe(initialPanelState);
  });

  it('returns the same state reference when `resolved` is dispatched from error', () => {
    const errorState: PanelState = {
      kind: 'error',
      code: 'not_found',
      message: 'Save it first',
    };
    const event: PanelEvent = {
      type: 'resolved',
      image: 'A',
      siteName: 'acme',
      pageName: 'Home',
      capturedAt: new Date(),
    };

    const next = panelStateReducer(errorState, event);

    expect(next).toBe(errorState);
  });

  it('returns the same state reference when `failed` is dispatched from idle', () => {
    const next = panelStateReducer(initialPanelState, {
      type: 'failed',
      code: 'unknown',
      message: 'Something went wrong.',
    });
    expect(next).toBe(initialPanelState);
  });
});

// -----------------------------------------------------------------------------
// usePanelState() hook smoke — the reducer hooked into React useReducer.
// -----------------------------------------------------------------------------
describe('usePanelState() hook wiring', () => {
  it('starts in the initial idle state and dispatches through transitions', () => {
    const { result } = renderHook(() => usePanelState());
    const [initial] = result.current;
    expect(initial).toEqual(initialPanelState);
    expect(initial.kind).toBe('idle');

    act(() => {
      const [, dispatch] = result.current;
      dispatch({ type: 'capture', startedAt: 100 });
    });
    expect(result.current[0]).toEqual({ kind: 'capturing', startedAt: 100 });

    act(() => {
      const [, dispatch] = result.current;
      dispatch({
        type: 'resolved',
        image: 'X',
        siteName: 's',
        pageName: 'p',
        capturedAt: new Date('2026-04-22T00:00:00'),
      });
    });
    expect(result.current[0].kind).toBe('ready');
  });
});
