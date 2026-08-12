'use client';

/**
 * Clipboard hook. `available` is false at mount when `ClipboardItem` is
 * undefined, so the parent can disable Copy from the outset; a denial is
 * STICKY for the session with no auto-revert.
 * See docs/build-decisions.md#copy-denied-sticky.
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
