import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render } from '@testing-library/react';

/**
 * T004-TEST-1 — PageShot Tailwind tokens compile (Blok redesign).
 *
 * Originally this test pinned the five Shutterbug tokens the panel depended
 * on. The Blok redesign removed the two Shutterbug-specific shadow tokens
 * (shutter + polaroid are now covered by Blok's shadow scale); the three
 * motion tokens remain because they animate shutter press, capture bloom,
 * and the denied-pill shake — Blok does not ship equivalents.
 *
 * jsdom does not apply stylesheet rules against markup the way a real browser
 * does, so asserting `getComputedStyle(el).boxShadow` is unreliable. We take
 * two complementary checks:
 *
 *   1. Render a component that uses the remaining motion utility classes.
 *      We assert that React mounts without throwing and that every expected
 *      class lands on the rendered element.
 *   2. Read `app/globals.css` at test time and assert that every motion
 *      token the UI layer relies on is declared in the `@theme inline`
 *      block. Tailwind v4 resolves `animate-<name>` utilities against the
 *      `--animate-<name>` tokens, so if they are listed in the stylesheet,
 *      the utilities will be generated at build time.
 */

const GLOBALS_CSS = readFileSync(resolve(__dirname, '..', 'globals.css'), 'utf8');

const UTILITIES = [
  'animate-shutter-bloom',
  'animate-shutter-press',
  'animate-shake',
];

describe('PageShot Tailwind tokens (T004-TEST-1, Blok redesign)', () => {
  it('renders a component that references every motion utility the panel still uses', () => {
    const { container } = render(
      <div data-testid="tokens">
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

  it('no longer defines the Shutterbug-specific --shadow-shutter / --shadow-polaroid declarations', () => {
    // The Blok redesign dropped these declarations from globals.css; this
    // assertion guards against accidental re-introduction by a future token
    // sweep. The regex matches a CSS custom-property declaration
    // (`--shadow-shutter:`) rather than a prose mention in a comment.
    expect(GLOBALS_CSS).not.toMatch(/--shadow-shutter\s*:/);
    expect(GLOBALS_CSS).not.toMatch(/--shadow-polaroid\s*:/);
  });

  it('declares the Blok semantic surface tokens the panel relies on', () => {
    // Panel surfaces (bg-background, text-foreground, bg-card, bg-muted,
    // bg-primary, text-muted-foreground, text-primary-foreground, border-
    // border) come from these theme variables. This assertion verifies the
    // registry theme is installed — not a specific value.
    expect(GLOBALS_CSS).toMatch(/--color-background:\s*var\(--background\)/);
    expect(GLOBALS_CSS).toMatch(/--color-primary:\s*var\(--primary\)/);
    expect(GLOBALS_CSS).toMatch(/--color-muted:\s*var\(--muted\)/);
  });
});
