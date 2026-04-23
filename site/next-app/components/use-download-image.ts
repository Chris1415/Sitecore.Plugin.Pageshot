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

    const filename = buildScreenshotFilename(siteName, pageName, capturedAt);

    // Primary path (Option 1): form POST to /api/download with target=_blank.
    // The server responds with Content-Disposition: attachment; filename=X,
    // which browsers honor as a file save even when the iframe sandbox is
    // missing `allow-downloads`. Form submissions receive more favorable
    // treatment than window.open or <a download> in restricted sandboxes
    // because they are first-class user-gesture navigations.
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = '/api/download';
    form.target = '_blank';
    form.enctype = 'application/x-www-form-urlencoded';
    form.style.display = 'none';

    const imageInput = document.createElement('input');
    imageInput.type = 'hidden';
    imageInput.name = 'image';
    imageInput.value = imageBase64;
    form.appendChild(imageInput);

    const filenameInput = document.createElement('input');
    filenameInput.type = 'hidden';
    filenameInput.name = 'filename';
    filenameInput.value = filename;
    form.appendChild(filenameInput);

    document.body.appendChild(form);
    form.submit();
    setTimeout(() => {
      if (form.parentNode) form.parentNode.removeChild(form);
    }, 10_000);

    // Secondary path (Option 2, fallback / belt-and-suspenders): open the
    // blob URL in a new tab. If the sandbox permits popups, the browser
    // renders the PNG inline and the user can right-click → Save Image As.
    // If the form POST above already triggered a download, the new tab
    // shows the same image in a second tab — minor UX noise, but the
    // primary download has already fired so no harm done.
    //
    // We keep revoke deferred 60s so the blob URL remains valid for the
    // new tab's save-image-as flow.
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank', 'noopener,noreferrer');

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
