/**
 * Panel state machine: idle / capturing / ready (an array of captures, one per
 * viewport) / error. Invalid transitions return the SAME state reference so
 * React's bail-out short-circuits the re-render, and a failure drops in-flight
 * partial captures rather than stitching them.
 * See docs/build-decisions.md#state-machine-noop.
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
