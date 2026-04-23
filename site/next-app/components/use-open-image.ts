'use client';

/**
 * `useOpenImage()` — opens a captured PNG in a new tab.
 *
 * Exists as a workaround for the Sitecore Pages iframe sandbox lacking
 * `allow-downloads`: while the "Download" action will silently no-op inside
 * the iframe until the host adds that sandbox token, `window.open` on a
 * blob URL opens the PNG in a real top-level browsing context where the
 * browser either downloads it directly or renders it inline for right-click
 * → Save Image As. Requires `allow-popups` in the iframe sandbox.
 *
 * When the host adds `allow-downloads`, the "Open" button may become
 * redundant with "Download" — keep or retire based on feedback.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

export type OpenStatus = 'idle' | 'opening' | 'opened' | 'blocked';

export interface UseOpenImageResult {
  status: OpenStatus;
  open: () => void;
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function useOpenImage(imageBase64: string): UseOpenImageResult {
  const [status, setStatus] = useState<OpenStatus>('idle');

  // In-flight guard tracked via ref so the callback stays stable across
  // status transitions (same rationale as `useDownloadImage`).
  const openingRef = useRef<boolean>(false);

  const revertTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (revertTimerRef.current) clearTimeout(revertTimerRef.current);
    };
  }, []);

  const open = useCallback<UseOpenImageResult['open']>(() => {
    if (openingRef.current) return;
    openingRef.current = true;
    setStatus('opening');

    const bytes = base64ToBytes(imageBase64);
    const buffer = bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset + bytes.byteLength,
    ) as ArrayBuffer;
    const blob = new Blob([buffer], { type: 'image/png' });

    const url = URL.createObjectURL(blob);
    const newWin = window.open(url, '_blank', 'noopener,noreferrer');

    setStatus(newWin ? 'opened' : 'blocked');
    openingRef.current = false;

    if (revertTimerRef.current) clearTimeout(revertTimerRef.current);
    revertTimerRef.current = setTimeout(() => {
      setStatus('idle');
      revertTimerRef.current = null;
    }, 1400);

    // Defer revoke so the new tab has time to read the blob.
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 60_000);
  }, [imageBase64]);

  return { status, open };
}
