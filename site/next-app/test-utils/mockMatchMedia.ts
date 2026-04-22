import { vi } from 'vitest';

/**
 * matchMedia mock for a11y / reduced-motion tests.
 * Scaffolded in E1 (T002) so later RED tests in E4 (T014a, T017a, T025) can import by stable path.
 */
export function setReducedMotion(reduced: boolean): void {
  const mql: MediaQueryList = {
    matches: reduced,
    media: '(prefers-reduced-motion: reduce)',
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(() => false),
  };

  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: vi.fn((query: string) => ({ ...mql, media: query, matches: reduced && query.includes('reduce') })),
  });
}
