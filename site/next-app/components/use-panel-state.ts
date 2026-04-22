/**
 * T013b + T029 — PageShot panel state machine + `usePanelState()` hook.
 *
 * POST-MVP (T029): the `ready` state now carries an array of captures — one
 * per viewport the editor asked PageShot to render. Single-viewport case is
 * a length-1 array; multi-viewport stacks polaroids below each other.
 *
 * States:
 *   - `idle`       — nothing to show; waiting for a capture press.
 *   - `capturing`  — upstream request(s) in flight; `startedAt` is a
 *                    `Date.now()` timestamp for the elapsed-time controller.
 *   - `ready`      — `captures: Array<Capture>`, one element per viewport.
 *                    The panel renders each as its own polaroid + actions.
 *   - `error`      — the route handler returned `{ ok: false, error }`; we copy
 *                    `code` + `message` verbatim. Any in-flight partial
 *                    captures are dropped — Retry re-runs the whole set.
 *
 * Events:
 *   - `capture`  — user pressed Shutter. Valid from `idle`, `ready`, `error`.
 *   - `resolved` — all viewport fetches succeeded; carries `captures`.
 *                  Only valid from `capturing`.
 *   - `failed`   — at least one fetch returned `{ ok: false }`; carries the
 *                  first failure's code + message. Only valid from `capturing`.
 *
 * Invalid transitions are no-ops — reducer returns the same state reference
 * so React's bail-out short-circuits re-renders.
 */

'use client';

import { useReducer, type Dispatch } from 'react';

import type { Viewport } from './ViewportToggle';

/** Error codes mirror the server-route envelope in § 4c-6. */
export type PanelErrorCode =
  | 'auth'
  | 'not_found'
  | 'upstream_unavailable'
  | 'network'
  | 'unknown';

/** One capture result — one polaroid in the ready UI. */
export interface Capture {
  viewport: Viewport;
  imageBase64: string;
  siteName: string;
  pageName: string;
  capturedAt: Date;
}

export type PanelState =
  | { kind: 'idle' }
  | { kind: 'capturing'; startedAt: number; elapsedSeconds?: number }
  | {
      kind: 'ready';
      captures: Capture[];
    }
  | {
      kind: 'error';
      code: PanelErrorCode;
      message: string;
    };

export type PanelEvent =
  | { type: 'capture'; startedAt: number }
  | { type: 'resolved'; captures: Capture[] }
  | { type: 'failed'; code: PanelErrorCode; message: string };

export const initialPanelState: PanelState = { kind: 'idle' };

export function panelStateReducer(
  state: PanelState,
  event: PanelEvent,
): PanelState {
  switch (event.type) {
    case 'capture': {
      if (
        state.kind === 'idle' ||
        state.kind === 'ready' ||
        state.kind === 'error'
      ) {
        return { kind: 'capturing', startedAt: event.startedAt };
      }
      return state;
    }
    case 'resolved': {
      if (state.kind !== 'capturing') return state;
      if (event.captures.length === 0) return state;
      return { kind: 'ready', captures: event.captures };
    }
    case 'failed': {
      if (state.kind !== 'capturing') return state;
      return {
        kind: 'error',
        code: event.code,
        message: event.message,
      };
    }
    default: {
      const _exhaustive: never = event;
      void _exhaustive;
      return state;
    }
  }
}

export function usePanelState(): [PanelState, Dispatch<PanelEvent>] {
  return useReducer(panelStateReducer, initialPanelState);
}
