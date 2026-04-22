/**
 * T021a-TEST-7 — Download-click action pipeline.
 *
 * Behavior under test (§ 4 T021b / PRD FR-09 / AC-3.2 / AC-3.4 / POC v2
 * Download pill):
 *
 *   TEST-7: clicking Download synthesizes an <a download={filename}> element,
 *           `URL.createObjectURL` is called once with a PNG blob whose first
 *           8 bytes match the PNG magic number, `.click()` is fired, and
 *           `URL.revokeObjectURL` is called once after click. Filename matches
 *           `buildScreenshotFilename` output.
 *
 *   The hook under test (`useDownloadImage`) exposes:
 *     ```
 *     const { status, download } = useDownloadImage({
 *       imageBase64, siteName, pageName, capturedAt,
 *     });
 *     ```
 *     - `status`   — "idle" | "downloading" | "downloaded"
 *     - `download()` — triggers the download; flips status to "downloaded"
 *                     for 1.4 s, then reverts to "idle".
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';

import { useDownloadImage } from './use-download-image';

// 1 px × 1 px transparent PNG, base64-encoded.
const ONE_PX_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

const PNG_MAGIC_BYTES = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

let originalCreateObjectURL: typeof URL.createObjectURL;
let originalRevokeObjectURL: typeof URL.revokeObjectURL;
let createdBlobs: Blob[] = [];
let createdUrls: string[] = [];
let revokedUrls: string[] = [];

beforeEach(() => {
  createdBlobs = [];
  createdUrls = [];
  revokedUrls = [];
  originalCreateObjectURL = URL.createObjectURL;
  originalRevokeObjectURL = URL.revokeObjectURL;

  URL.createObjectURL = vi.fn((blob: Blob) => {
    createdBlobs.push(blob);
    const url = `blob:mock-${createdBlobs.length}`;
    createdUrls.push(url);
    return url;
  });
  URL.revokeObjectURL = vi.fn((url: string) => {
    revokedUrls.push(url);
  });
});

afterEach(() => {
  URL.createObjectURL = originalCreateObjectURL;
  URL.revokeObjectURL = originalRevokeObjectURL;
  vi.useRealTimers();
});

// -----------------------------------------------------------------------------
// T021a-TEST-7 — Download click synthesizes <a download> and revokes URL
// -----------------------------------------------------------------------------
describe('T021a-TEST-7 — Download click synthesizes <a download> and revokes URL', () => {
  it('creates an object URL for a PNG blob, clicks a synthesized <a download=filename>, and revokes the URL', async () => {
    const capturedAt = new Date(2026, 3, 22, 9, 42, 0, 0); // April is month 3
    const { result } = renderHook(() =>
      useDownloadImage({
        imageBase64: ONE_PX_PNG_BASE64,
        siteName: 'acme',
        pageName: 'home',
        capturedAt,
      }),
    );

    // Spy on `HTMLAnchorElement.click` so we can assert the synthesized
    // element was activated exactly once with the expected `download` attr.
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function mockClick(this: HTMLAnchorElement) {
      // Assert the synthesized anchor has the correct `download` attribute
      // AT THE TIME click() is invoked — before the hook revokes the URL.
      expect(this.getAttribute('download')).toBe('acme_home_20260422-0942.png');
      expect(this.getAttribute('href')).toMatch(/^blob:mock-/);
    });

    await act(async () => {
      await result.current.download();
    });

    // createObjectURL called exactly once with a PNG blob.
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(createdBlobs.length).toBe(1);
    expect(createdBlobs[0].type).toBe('image/png');

    // PNG magic-bytes assertion.
    const ab = await createdBlobs[0].arrayBuffer();
    const bytes = new Uint8Array(ab.slice(0, 8));
    for (let i = 0; i < PNG_MAGIC_BYTES.length; i++) {
      expect(bytes[i]).toBe(PNG_MAGIC_BYTES[i]);
    }

    // Anchor click fired once.
    expect(clickSpy).toHaveBeenCalledTimes(1);

    // Revoke called once after click.
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1);
    expect(revokedUrls).toEqual(createdUrls);

    clickSpy.mockRestore();
  });

  it('flips status to "downloaded" and reverts to "idle" after 1400 ms', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });

    const capturedAt = new Date(2026, 3, 22, 9, 42, 0, 0);
    const { result } = renderHook(() =>
      useDownloadImage({
        imageBase64: ONE_PX_PNG_BASE64,
        siteName: 'acme',
        pageName: 'home',
        capturedAt,
      }),
    );
    expect(result.current.status).toBe('idle');

    await act(async () => {
      await result.current.download();
    });
    expect(result.current.status).toBe('downloaded');

    await act(async () => {
      vi.advanceTimersByTime(1400);
    });
    expect(result.current.status).toBe('idle');
  });
});
