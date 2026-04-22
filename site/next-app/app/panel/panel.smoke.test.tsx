import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render } from '@testing-library/react';

/**
 * T004-TEST-1 — Shutterbug Tailwind tokens compile.
 *
 * jsdom does not apply stylesheet rules against markup the way a real browser
 * does, so asserting the exact `getComputedStyle(el).boxShadow` after mounting
 * a component is unreliable — it will return '' regardless of whether the
 * Tailwind utility resolves. We take two complementary checks instead:
 *
 *   1. Render a component that uses the Shutterbug utility classes. We assert
 *      that React mounts without throwing and that every expected class lands
 *      on the rendered element — React throwing is what a "missing class"
 *      would look like at runtime (it would not — invalid Tailwind classes are
 *      silent in production — but we still want the render to succeed as a
 *      base sanity check).
 *   2. Read `app/globals.css` at test time and assert that every token the UI
 *      layer relies on is declared in the `@theme inline` block. Tailwind v4
 *      resolves `shadow-<name>` and `animate-<name>` utilities against the
 *      `--shadow-<name>` and `--animate-<name>` tokens, so if they are listed
 *      in the stylesheet, the utilities will be generated at build time. This
 *      is the compile-check contract T004-TEST-1 asks for.
 */

const GLOBALS_CSS = readFileSync(resolve(__dirname, '..', 'globals.css'), 'utf8');

const UTILITIES = [
  'shadow-shutter',
  'shadow-polaroid',
  'animate-shutter-bloom',
  'animate-shutter-press',
  'animate-shake',
];

describe('Shutterbug Tailwind tokens (T004-TEST-1)', () => {
  it('renders a component that references every Shutterbug utility', () => {
    const { container } = render(
      <div data-testid="tokens">
        <div className="shadow-shutter">shutter</div>
        <div className="shadow-polaroid">polaroid</div>
        <div className="animate-shutter-bloom">bloom</div>
        <div className="animate-shutter-press">press</div>
        <div className="animate-shake">shake</div>
      </div>,
    );
    const root = container.querySelector('[data-testid="tokens"]');
    expect(root).not.toBeNull();
    for (const cls of UTILITIES) {
      const match = root?.querySelector(`.${cls}`);
      expect(match, `expected rendered tree to contain .${cls}`).not.toBeNull();
    }
  });

  it('defines --shadow-shutter and --shadow-polaroid in @theme inline', () => {
    expect(GLOBALS_CSS).toMatch(/--shadow-shutter:\s*0 10px 30px -8px rgb\(245 158 11 \/ 0\.35\)/);
    expect(GLOBALS_CSS).toMatch(/--shadow-polaroid:\s*0 20px 40px -12px rgb\(120 53 15 \/ 0\.22\)/);
  });

  it('defines --animate-shutter-bloom, --animate-shutter-press, --animate-shake in @theme inline', () => {
    expect(GLOBALS_CSS).toMatch(/--animate-shutter-bloom:\s*bloom 200ms ease-out/);
    expect(GLOBALS_CSS).toMatch(/--animate-shutter-press:\s*shutter-press 380ms/);
    expect(GLOBALS_CSS).toMatch(/--animate-shake:\s*shake 80ms ease-in-out/);
  });

  it('declares the three named @keyframes (shake, bloom, shutter-press)', () => {
    expect(GLOBALS_CSS).toMatch(/@keyframes shake\b/);
    expect(GLOBALS_CSS).toMatch(/@keyframes bloom\b/);
    expect(GLOBALS_CSS).toMatch(/@keyframes shutter-press\b/);
  });
});
