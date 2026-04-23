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

  // In-flight guard as a ref so `download` can stay stable — if we keyed off
  // `status` we'd recreate the callback on every transition, which ripples
  // into every consumer effect that depends on `download`.
  const downloadingRef = useRef<boolean>(false);

  const revertTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (revertTimerRef.current) clearTimeout(revertTimerRef.current);
    };
  }, []);

  const download = useCallback<UseDownloadImageResult['download']>(async () => {
    if (downloadingRef.current) return;
    downloadingRef.current = true;

    setStatus('downloading');

    const bytes = base64ToBytes(imageBase64);
    const buffer = bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset + bytes.byteLength,
    ) as ArrayBuffer;
    const blob = new Blob([buffer], { type: 'image/png' });

    const url = URL.createObjectURL(blob);
    const filename = buildScreenshotFilename(siteName, pageName, capturedAt);

    // Classic download: synthesize <a download={filename}> and click it.
    // This is the canonical pattern — it will start working inside the
    // Sitecore Pages iframe once the host adds `allow-downloads` to the
    // iframe's sandbox attribute (committed to Sitecore, expected soon).
    //
    // Until then, editors who need an immediate workaround use the "Open"
    // action pill, which `window.open`s the blob URL in a new tab where
    // the browser can handle the PNG (right-click → Save Image As).
    //
    // Revoke deferred 60s so even slow disks finish writing before the
    // blob URL is invalidated.
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.rel = 'noopener';
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();

    setTimeout(() => {
      if (anchor.parentNode) anchor.parentNode.removeChild(anchor);
      URL.revokeObjectURL(url);
    }, 60_000);

    setStatus('downloaded');
    downloadingRef.current = false;

    // Auto-revert the "downloaded" label after the § 4c-4 1.4 s window.
    if (revertTimerRef.current) clearTimeout(revertTimerRef.current);
    revertTimerRef.current = setTimeout(() => {
      setStatus('idle');
      revertTimerRef.current = null;
    }, 1400);
  }, [imageBase64, siteName, pageName, capturedAt]);

  return { status, download };
}
