/**
 * T013a-TEST-1..6 — Panel state-machine reducer (post-T029 multi-viewport).
 *
 * Behavior under test:
 *   - Reducer transitions between `idle | capturing | ready | error`.
 *   - `resolved` now carries `captures: Array<Capture>`. Single-viewport case
 *     is a length-1 array; multi-viewport is length-N (T029 extension).
 *   - Invalid transitions are no-ops.
 */

import { describe, it, expect } from 'vitest';
import { act, renderHook } from '@testing-library/react';

import {
  initialPanelState,
  panelStateReducer,
  usePanelState,
  type Capture,
  type PanelEvent,
  type PanelState,
} from './use-panel-state';

function makeCapture(overrides: Partial<Capture> = {}): Capture {
  return {
    viewport: 'desktop',
    imageBase64: 'BASE64BYTES',
    siteName: 'acme',
    pageName: 'Home',
    capturedAt: new Date('2026-04-22T09:14:00'),
    ...overrides,
  };
}

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
describe('T013a-TEST-2 — capturing -> ready with captures array', () => {
  it('transitions from capturing to ready carrying a single-viewport capture', () => {
    const capturing: PanelState = { kind: 'capturing', startedAt: 1000 };
    const capture = makeCapture();

    const next = panelStateReducer(capturing, {
      type: 'resolved',
      captures: [capture],
    });

    expect(next).toEqual({ kind: 'ready', captures: [capture] });
    expect(next).not.toHaveProperty('startedAt');
  });

  it('transitions from capturing to ready carrying two viewports stacked', () => {
    const capturing: PanelState = { kind: 'capturing', startedAt: 1000 };
    const mobile = makeCapture({
      viewport: 'mobile',
      imageBase64: 'M_BYTES',
    });
    const desktop = makeCapture({
      viewport: 'desktop',
      imageBase64: 'D_BYTES',
    });

    const next = panelStateReducer(capturing, {
      type: 'resolved',
      captures: [mobile, desktop],
    });

    expect(next.kind).toBe('ready');
    if (next.kind !== 'ready') throw new Error('unreachable');
    expect(next.captures).toEqual([mobile, desktop]);
  });
});

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
describe('T013a-TEST-4 — ready -> capturing replaces the previous image (FR-11)', () => {
  it('clears captures from state when a new capture starts from ready', () => {
    const ready: PanelState = {
      kind: 'ready',
      captures: [makeCapture({ imageBase64: 'IMAGEBYTES123' })],
    };
    const next = panelStateReducer(ready, { type: 'capture', startedAt: 9999 });

    expect(next).toEqual({ kind: 'capturing', startedAt: 9999 });
    expect(next).not.toHaveProperty('captures');
    expect(JSON.stringify(next)).not.toContain('IMAGEBYTES123');
  });
});

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
describe('T013a-TEST-6 — invalid transitions are no-ops', () => {
  it('returns the same state reference when `resolved` is dispatched from idle', () => {
    const event: PanelEvent = {
      type: 'resolved',
      captures: [makeCapture()],
    };
    const next = panelStateReducer(initialPanelState, event);
    expect(next).toBe(initialPanelState);
  });

  it('returns the same state reference when `resolved` is dispatched from error', () => {
    const errorState: PanelState = {
      kind: 'error',
      code: 'not_found',
      message: 'Save it first',
    };
    const next = panelStateReducer(errorState, {
      type: 'resolved',
      captures: [makeCapture()],
    });
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

  it('returns the same state reference when `resolved` has zero captures', () => {
    const capturing: PanelState = { kind: 'capturing', startedAt: 1000 };
    const next = panelStateReducer(capturing, {
      type: 'resolved',
      captures: [],
    });
    expect(next).toBe(capturing);
  });
});

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
        captures: [makeCapture()],
      });
    });
    expect(result.current[0].kind).toBe('ready');
  });
});
