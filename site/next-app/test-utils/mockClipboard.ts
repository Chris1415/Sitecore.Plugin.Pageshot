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

/**
 * Minimal `ClipboardItem` polyfill for jsdom — just enough for the hook
 * under test. Real browsers return a Promise from `getType()`; we match that.
 * The constructor accepts a `{ [mime]: Blob | Promise<Blob> }` record.
 */
class FakeClipboardItem {
  public readonly types: readonly string[];
  private readonly entries: Record<string, Blob | Promise<Blob>>;

  constructor(items: Record<string, Blob | Promise<Blob>>) {
    this.entries = items;
    this.types = Object.keys(items);
  }

  async getType(type: string): Promise<Blob> {
    const entry = this.entries[type];
    if (!entry) {
      throw new Error(`No clipboard entry for type ${type}`);
    }
    return await entry;
  }
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
    // Explicitly remove the ClipboardItem constructor so the hook's
    // capability check reports `available: false`.
    Object.defineProperty(globalThis, 'ClipboardItem', {
      configurable: true,
      value: undefined,
    });
  } else {
    // Install the fake ClipboardItem constructor — jsdom does not ship one.
    Object.defineProperty(globalThis, 'ClipboardItem', {
      configurable: true,
      value: FakeClipboardItem as unknown as typeof ClipboardItem,
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
