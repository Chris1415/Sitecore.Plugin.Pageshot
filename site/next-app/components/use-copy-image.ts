'use client';

/**
 * T020b — `useCopyImage()` clipboard hook.
 *
 * Source of truth: § 4 T020b / § 4c-4 copy catalogue / PRD FR-08 + AC-2.2 +
 * AC-2.4 + R-3.
 *
 * API:
 *   ```
 *   const { available, status, deniedMessage, copy } = useCopyImage(imageBase64);
 *   ```
 *
 * - `available`     — `false` at mount when `ClipboardItem` is `undefined`
 *                     (old browsers, locked-down contexts). Parents disable
 *                     the Copy pill from the outset in that case.
 * - `status`        — `"idle" | "copying" | "copied" | "denied" | "unsupported"`.
 *                     Drives the `<ActionPill>` state + any inline message
 *                     visibility.
 * - `deniedMessage` — stable string literal per § 4c-4: "Clipboard access was
 *                     blocked. Use Download instead." Exposed regardless of
 *                     current status so parents can render it by conditioning
 *                     on `status === 'denied' || status === 'unsupported'`.
 * - `copy()`        — decodes the base64 image into a PNG Blob, wraps it in
 *                     a `ClipboardItem({ 'image/png': blob })`, calls
 *                     `navigator.clipboard.write([item])`. On success flips
 *                     status to `"copied"` for 1.8 s, then back to `"idle"`.
 *                     On `DOMException` (or any rejection) flips to
 *                     `"denied"` — sticky for the session (no auto-revert,
 *                     per R-3). No-op when `!available`.
 *
 * The hook does not depend on React 19's use() API; it uses standard
 * `useState` + `useEffect` so the reducer is easy to reason about under
 * fake timers in tests.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

export type CopyStatus =
  | 'idle'
  | 'copying'
  | 'copied'
  | 'denied'
  | 'unsupported';

export interface UseCopyImageResult {
  available: boolean;
  status: CopyStatus;
  deniedMessage: string;
  copy: () => Promise<void>;
}

export const CLIPBOARD_DENIED_MESSAGE =
  'Clipboard access was blocked. Use Download instead.';

/** Decode base64 → Uint8Array without going through a DataURL round-trip. */
function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Check whether the browser exposes `ClipboardItem` constructor + the
 * `navigator.clipboard.write` method. Both are required for image copy.
 * Evaluated lazily inside the hook so tests can install the mock before the
 * first render.
 */
function clipboardItemAvailable(): boolean {
  return (
    typeof globalThis !== 'undefined' &&
    typeof (globalThis as { ClipboardItem?: unknown }).ClipboardItem !==
      'undefined' &&
    typeof navigator !== 'undefined' &&
    typeof navigator.clipboard?.write === 'function'
  );
}

export function useCopyImage(imageBase64: string): UseCopyImageResult {
  // Resolve capability once at mount — parents that pass a fresh base64
  // image over time should not flip availability back and forth mid-session.
  const [available] = useState<boolean>(() => clipboardItemAvailable());

  const [status, setStatus] = useState<CopyStatus>(() =>
    clipboardItemAvailable() ? 'idle' : 'unsupported',
  );

  // Ref so copy() sees the current value even when invoked rapidly from the
  // same render cycle (React batches setState within the same tick).
  const statusRef = useRef<CopyStatus>(status);
  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  const revertTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (revertTimerRef.current) clearTimeout(revertTimerRef.current);
    };
  }, []);

  const copy = useCallback<UseCopyImageResult['copy']>(async () => {
    if (!available) {
      // No-op — parent already shows the inline message.
      return;
    }
    // Sticky denied: once blocked, stay blocked for the session.
    if (statusRef.current === 'denied') {
      return;
    }
    if (statusRef.current === 'copying') {
      return;
    }

    setStatus('copying');
    try {
      const bytes = base64ToBytes(imageBase64);
      // `new Blob([bytes])` expects a `BlobPart[]`. Pass the underlying
      // ArrayBuffer (sliced to the bytes' length) so TS accepts the part and
      // jsdom + node Blob polyfills both read the full payload.
      const buffer = bytes.buffer.slice(
        bytes.byteOffset,
        bytes.byteOffset + bytes.byteLength,
      ) as ArrayBuffer;
      const blob = new Blob([buffer], { type: 'image/png' });
      const CtorItem = (globalThis as { ClipboardItem: typeof ClipboardItem })
        .ClipboardItem;
      const item = new CtorItem({ 'image/png': blob });
      await navigator.clipboard.write([item]);
      setStatus('copied');

      // Auto-revert the "copied" label after the § 4c-4 window.
      if (revertTimerRef.current) clearTimeout(revertTimerRef.current);
      revertTimerRef.current = setTimeout(() => {
        setStatus('idle');
      }, 1800);
    } catch {
      // Any rejection — permission denied, SecurityError, quota — transitions
      // to the sticky denied state. The message is identical in all cases
      // per § 4c-4 (the spec defines a single fallback message for this path).
      setStatus('denied');
      if (revertTimerRef.current) {
        clearTimeout(revertTimerRef.current);
        revertTimerRef.current = null;
      }
    }
  }, [available, imageBase64]);

  return {
    available,
    status,
    deniedMessage: CLIPBOARD_DENIED_MESSAGE,
    copy,
  };
}
