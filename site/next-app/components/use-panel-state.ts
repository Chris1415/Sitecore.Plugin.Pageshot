/**
 * T013b — PageShot panel state machine + `usePanelState()` hook.
 *
 * Source of truth: `PanelState` discriminated union from § 4c-6 of the task
 * breakdown (copied from PRD § 10) and the transition bullets in § 4 T013b.
 *
 * States:
 *   - `idle`       — nothing to show; waiting for a capture press.
 *   - `capturing`  — upstream request in flight; `startedAt` is a `Date.now()`
 *                    timestamp used by the elapsed-time controller (T016b).
 *   - `ready`      — we have a base64 PNG + the page/site names + capturedAt.
 *   - `error`      — the route handler returned `{ ok: false, error }`; we copy
 *                    `code` + `message` verbatim (§ 4 T013b bullet 3 — the copy
 *                    strings flow through to PolaroidCard's error variant).
 *
 * Events (per § 4 T013b):
 *   - `capture`  — user pressed Shutter. Valid from `idle`, `ready`, `error`.
 *                  From `ready` the previous image is dropped (FR-11).
 *                  From `error` this is the Retry path.
 *   - `resolved` — `/api/screenshot/[pageId]` returned `{ ok: true, image }`.
 *                  Only valid from `capturing`.
 *   - `failed`   — `/api/screenshot/[pageId]` returned `{ ok: false, error }`.
 *                  Only valid from `capturing`.
 *
 * Invalid transitions are no-ops — the reducer returns the same state
 * reference so React's bail-out short-circuits re-renders and a stray event
 * (e.g. a stale `resolved` after the user retried) cannot corrupt state.
 */

'use client';

import { useReducer, type Dispatch } from 'react';

/** Error codes mirror the server-route envelope in § 4c-6. */
export type PanelErrorCode =
  | 'auth'
  | 'not_found'
  | 'upstream_unavailable'
  | 'network'
  | 'unknown';

/**
 * `PanelState` discriminated union — PRD § 10 / task-breakdown § 4c-6.
 *
 * `elapsedSeconds` inside `capturing` is owned by T016b — the reducer leaves
 * it undefined at transition-time; the elapsed-time controller merges its
 * tick into this shape without going through an event.
 */
export type PanelState =
  | { kind: 'idle' }
  | { kind: 'capturing'; startedAt: number; elapsedSeconds?: number }
  | {
      kind: 'ready';
      imageBase64: string;
      siteName: string;
      pageName: string;
      capturedAt: Date;
    }
  | {
      kind: 'error';
      code: PanelErrorCode;
      message: string;
    };

/** Events the panel dispatches into the reducer. */
export type PanelEvent =
  | { type: 'capture'; startedAt: number }
  | {
      type: 'resolved';
      image: string;
      siteName: string;
      pageName: string;
      capturedAt: Date;
    }
  | { type: 'failed'; code: PanelErrorCode; message: string };

/** Canonical idle state — exported so tests and consumers agree on shape. */
export const initialPanelState: PanelState = { kind: 'idle' };

/**
 * Pure reducer. The four transitions are the only legal moves; any other
 * (state, event) pair returns the input state reference unchanged — React
 * will bail out and the UI will not re-render.
 */
export function panelStateReducer(
  state: PanelState,
  event: PanelEvent,
): PanelState {
  switch (event.type) {
    case 'capture': {
      // Valid from idle, ready, or error. Transition always yields a fresh
      // capturing state with the event's `startedAt`. Any previous payload
      // (ready.imageBase64, error.message) is discarded — this is FR-11 for
      // the ready case and a clean slate for Retry from error.
      if (
        state.kind === 'idle' ||
        state.kind === 'ready' ||
        state.kind === 'error'
      ) {
        return { kind: 'capturing', startedAt: event.startedAt };
      }
      // Already capturing — ignore duplicate press. (Shutter guards this with
      // `disabled` anyway, but defence in depth.)
      return state;
    }
    case 'resolved': {
      if (state.kind !== 'capturing') {
        // Stale event (e.g. second network response arriving after user
        // retried). No-op.
        return state;
      }
      return {
        kind: 'ready',
        imageBase64: event.image,
        siteName: event.siteName,
        pageName: event.pageName,
        capturedAt: event.capturedAt,
      };
    }
    case 'failed': {
      if (state.kind !== 'capturing') {
        return state;
      }
      return {
        kind: 'error',
        code: event.code,
        message: event.message,
      };
    }
    default: {
      // Exhaustiveness check — if a new event type is added, TS flags this.
      const _exhaustive: never = event;
      void _exhaustive;
      return state;
    }
  }
}

/**
 * React hook wrapping `useReducer` with the panel reducer. Returns the
 * current state and a dispatch function — callers use the standard tuple
 * pattern.
 */
export function usePanelState(): [PanelState, Dispatch<PanelEvent>] {
  return useReducer(panelStateReducer, initialPanelState);
}
