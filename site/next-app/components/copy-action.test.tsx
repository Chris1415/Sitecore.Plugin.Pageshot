/**
 * T020a-TEST-1..4 — Copy-to-clipboard action + denied fallback.
 *
 * Behavior under test (§ 4 T020a / § 4c-4 / FR-08 / AC-2.2 / AC-2.4 / R-3 /
 * POC v2 Copy pill):
 *
 *   TEST-1: successful copy writes a single-element array to
 *           `navigator.clipboard.write`. The element is a `ClipboardItem`
 *           containing an `image/png` Blob. The Blob's first 8 bytes match
 *           the PNG magic number `\x89 P N G \r \n \x1A \n` = hex
 *           `89 50 4E 47 0D 0A 1A 0A` (§ 4c-4 "PNG magic bytes").
 *   TEST-2: after resolution the hook's `status` transitions to `"copied"`
 *           for 1.8 s, then reverts to `"idle"`. (Parent wires this into
 *           `<ActionPill state="success">`.)
 *   TEST-3: permission denied (`DOMException('NotAllowedError')` / generic
 *           rejection) transitions `status` to `"denied"` and exposes
 *           `deniedMessage` = EXACT "Clipboard access was blocked. Use
 *           Download instead." The denied state is sticky for the session.
 *   TEST-4: `global.ClipboardItem` undefined → hook returns
 *           `{ available: false, status: 'unsupported' }` so the parent can
 *           disable Copy from the outset and surface the same inline message.
 *
 * The hook under test (`useCopyImage`) exposes:
 *   ```
 *   const { available, status, deniedMessage, copy } = useCopyImage(imageBase64);
 *   // available:       boolean — false when ClipboardItem is undefined at module init
 *   // status:          "idle" | "copying" | "copied" | "denied" | "unsupported"
 *   // deniedMessage:   stable string constant ("Clipboard access was blocked. Use Download instead.")
 *   // copy():          () => Promise<void> — no-op when !available
 *   ```
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

import { installClipboard } from '@/test-utils/mockClipboard';

import { useCopyImage } from './use-copy-image';

// A 1 px × 1 px transparent PNG, base64-encoded. This gives us a Blob with
// valid PNG magic bytes (the 8-byte header is mandatory for any PNG file).
const ONE_PX_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

const PNG_MAGIC_BYTES = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

let installed: ReturnType<typeof installClipboard> | null = null;

beforeEach(() => {
  vi.useRealTimers();
});

afterEach(() => {
  if (installed) {
    installed.restore();
    installed = null;
  }
  vi.useRealTimers();
});

// -----------------------------------------------------------------------------
// T020a-TEST-1 — Successful copy writes ClipboardItem with correct blob type
//                + PNG magic bytes.
// -----------------------------------------------------------------------------
describe('T020a-TEST-1 — Successful copy writes ClipboardItem with correct blob type + PNG magic bytes', () => {
  it('calls clipboard.write with [ClipboardItem({ "image/png": blob })] and the blob starts with 89 50 4E 47 0D 0A 1A 0A', async () => {
    installed = installClipboard({ mode: 'ok' });

    const { result } = renderHook(() => useCopyImage(ONE_PX_PNG_BASE64));
    await act(async () => {
      await result.current.copy();
    });

    expect(installed.write).toHaveBeenCalledTimes(1);
    const args = installed.write.mock.calls[0];
    const items = args[0] as ClipboardItem[];
    expect(Array.isArray(items)).toBe(true);
    expect(items.length).toBe(1);

    const item = items[0];
    // `ClipboardItem` exposes its declared types via `.types` and returns the
    // blob via `.getType(type)`. The component promises a single
    // `image/png` entry.
    expect(item.types).toContain('image/png');
    const blob = await item.getType('image/png');
    expect(blob.type).toBe('image/png');

    // PNG magic-bytes assertion. Read the first 8 bytes and compare to the
    // literal PNG header `\x89 P N G \r \n \x1A \n`.
    const ab = await blob.arrayBuffer();
    const bytes = new Uint8Array(ab.slice(0, 8));
    for (let i = 0; i < PNG_MAGIC_BYTES.length; i++) {
      expect(bytes[i]).toBe(PNG_MAGIC_BYTES[i]);
    }
  });
});

// -----------------------------------------------------------------------------
// T020a-TEST-2 — status transitions idle → copying → copied → idle after 1.8 s
// -----------------------------------------------------------------------------
describe('T020a-TEST-2 — status transitions idle → copying → copied → idle after 1.8 s', () => {
  it('flips to "copied" on resolution and reverts to "idle" after 1800 ms', async () => {
    installed = installClipboard({ mode: 'ok' });

    // Fake ONLY setTimeout / clearTimeout — leaves Promise microtasks
    // (including the clipboard.write() resolution) on the real scheduler
    // so `await copy()` completes without also draining the 1800 ms
    // revert timer.
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });

    const { result } = renderHook(() => useCopyImage(ONE_PX_PNG_BASE64));
    expect(result.current.status).toBe('idle');

    await act(async () => {
      await result.current.copy();
    });

    expect(result.current.status).toBe('copied');

    // Advance past the § 4c-4 auto-revert window.
    await act(async () => {
      vi.advanceTimersByTime(1800);
    });
    expect(result.current.status).toBe('idle');
  });
});

// -----------------------------------------------------------------------------
// T020a-TEST-3 — Permission denied → status='denied' + message + sticky
// -----------------------------------------------------------------------------
describe('T020a-TEST-3 — Permission denied → status=\'denied\' + message + sticky', () => {
  it('transitions status to "denied", exposes the exact § 4c-4 denied message, and stays denied on subsequent copy() calls', async () => {
    installed = installClipboard({ mode: 'denied' });

    const { result } = renderHook(() => useCopyImage(ONE_PX_PNG_BASE64));
    await act(async () => {
      await result.current.copy();
    });

    expect(result.current.status).toBe('denied');
    expect(result.current.deniedMessage).toBe(
      'Clipboard access was blocked. Use Download instead.',
    );

    // Sticky: a second copy() attempt must not flip us back to `idle` and
    // must not re-trigger clipboard.write (we lock to denied after the first
    // rejection per R-3).
    const priorCalls = installed.write.mock.calls.length;
    await act(async () => {
      await result.current.copy();
    });
    expect(result.current.status).toBe('denied');
    expect(installed.write.mock.calls.length).toBe(priorCalls);

    // Wait to make sure no auto-revert timer fires on the denied state.
    await waitFor(() => {
      expect(result.current.status).toBe('denied');
    });
  });
});

// -----------------------------------------------------------------------------
// T020a-TEST-4 — ClipboardItem undefined → available=false + unsupported
// -----------------------------------------------------------------------------
describe('T020a-TEST-4 — ClipboardItem undefined → available=false + unsupported', () => {
  it('reports available=false + status="unsupported" + the same denied message when ClipboardItem is missing', async () => {
    installed = installClipboard({ mode: 'unavailable' });

    const { result } = renderHook(() => useCopyImage(ONE_PX_PNG_BASE64));
    expect(result.current.available).toBe(false);
    expect(result.current.status).toBe('unsupported');
    expect(result.current.deniedMessage).toBe(
      'Clipboard access was blocked. Use Download instead.',
    );

    // copy() is a no-op in this mode — clipboard.write must not be called.
    await act(async () => {
      await result.current.copy();
    });
    expect(installed.write).not.toHaveBeenCalled();
    expect(result.current.status).toBe('unsupported');
  });
});
