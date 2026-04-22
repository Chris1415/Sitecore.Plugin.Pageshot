import { vi } from 'vitest';

/**
 * Clipboard mock — swaps `navigator.clipboard.write` and/or removes `ClipboardItem`.
 * Fleshed out in T020a when Copy tests land. Stubbed here so the import path is stable.
 *
 * - mode 'ok'          — write resolves
 * - mode 'denied'      — write rejects with NotAllowedError
 * - mode 'unavailable' — ClipboardItem is undefined (old browsers / locked-down contexts)
 */
export type ClipboardMode = 'ok' | 'denied' | 'unavailable';

export interface InstalledClipboard {
  write: ReturnType<typeof vi.fn>;
  restore: () => void;
}

export function installClipboard({ mode }: { mode: ClipboardMode }): InstalledClipboard {
  const originalClipboard = navigator.clipboard;
  const originalClipboardItem = (globalThis as { ClipboardItem?: typeof ClipboardItem }).ClipboardItem;

  const write = vi.fn(async () => {
    if (mode === 'denied') {
      const err = new Error('permission denied');
      err.name = 'NotAllowedError';
      throw err;
    }
    return undefined;
  });

  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { write },
  });

  if (mode === 'unavailable') {
    Object.defineProperty(globalThis, 'ClipboardItem', {
      configurable: true,
      value: undefined,
    });
  }

  return {
    write,
    restore: () => {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: originalClipboard,
      });
      Object.defineProperty(globalThis, 'ClipboardItem', {
        configurable: true,
        value: originalClipboardItem,
      });
    },
  };
}
