'use client';

/**
 * T021b — `useDownloadImage()` hook.
 *
 * Source of truth: § 4 T021b / § 4c-4 / PRD FR-09 + AC-3.2 + AC-3.3 + AC-3.4.
 *
 * API:
 *   ```
 *   const { status, download } = useDownloadImage({
 *     imageBase64, siteName, pageName, capturedAt,
 *   });
 *   ```
 *
 * - `status`   — "idle" | "downloading" | "downloaded".
 * - `download()` — decodes the base64 PNG to a Blob, creates an object URL,
 *                  synthesizes an `<a download={filename}>` element, clicks
 *                  it, then revokes the URL. Flips status to "downloaded"
 *                  for 1.4 s then back to "idle" (the § 4c-4 Download
 *                  auto-revert window).
 *
 * Filename is derived from `buildScreenshotFilename` — kept out-of-component
 * so the helper can be unit-tested independently (T021a).
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { buildScreenshotFilename } from '@/lib/filename';

export type DownloadStatus = 'idle' | 'downloading' | 'downloaded';

export interface UseDownloadImageParams {
  imageBase64: string;
  siteName: string;
  pageName: string;
  capturedAt: Date;
}

export interface UseDownloadImageResult {
  status: DownloadStatus;
  download: () => Promise<void>;
}

/** Decode base64 → Uint8Array without going through a DataURL round-trip. */
function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function useDownloadImage(
  params: UseDownloadImageParams,
): UseDownloadImageResult {
  const { imageBase64, siteName, pageName, capturedAt } = params;
  const [status, setStatus] = useState<DownloadStatus>('idle');

  const revertTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (revertTimerRef.current) clearTimeout(revertTimerRef.current);
    };
  }, []);

  const download = useCallback<UseDownloadImageResult['download']>(async () => {
    if (status === 'downloading') return;

    setStatus('downloading');

    const bytes = base64ToBytes(imageBase64);
    const buffer = bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset + bytes.byteLength,
    ) as ArrayBuffer;
    const blob = new Blob([buffer], { type: 'image/png' });

    const url = URL.createObjectURL(blob);
    const filename = buildScreenshotFilename(siteName, pageName, capturedAt);

    // Inside a sandboxed iframe (Sitecore Pages), the parent's sandbox must
    // include `allow-downloads` for <a download> to trigger. We can't set
    // that — only the host can. `window.open(url, '_blank')` escapes the
    // sandbox by opening a real top-level window; the browser then handles
    // the blob URL in that new context. If the browser's download mode
    // doesn't auto-save, the PNG renders inline in the new tab and the
    // user can right-click → Save Image As — preserving our filename via
    // the blob's object URL. Requires `allow-popups` in the iframe sandbox,
    // which the host has already allowed.
    //
    // Revoke is deferred 60s so the new-tab save dialog has time to complete
    // before the object URL becomes invalid.
    const newWin = window.open(url, '_blank', 'noopener,noreferrer');
    if (!newWin) {
      // Popup was blocked (sandbox without allow-popups, or user-level
      // blocker). Fall back to the anchor-click path so there's at least
      // a chance the sandbox permits download-anchors.
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      anchor.target = '_blank';
      anchor.rel = 'noopener';
      anchor.style.display = 'none';
      document.body.appendChild(anchor);
      anchor.click();
      setTimeout(() => {
        if (anchor.parentNode) anchor.parentNode.removeChild(anchor);
      }, 60_000);
    }

    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 60_000);

    setStatus('downloaded');

    // Auto-revert the "downloaded" label after the § 4c-4 1.4 s window.
    if (revertTimerRef.current) clearTimeout(revertTimerRef.current);
    revertTimerRef.current = setTimeout(() => {
      setStatus('idle');
      revertTimerRef.current = null;
    }, 1400);
  }, [imageBase64, siteName, pageName, capturedAt, status]);

  return { status, download };
}
