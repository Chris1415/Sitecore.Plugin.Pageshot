/**
 * T021a-TEST-1..6 — `buildScreenshotFilename` sanitization helper.
 *
 * Contract (§ 4c-4 filename helper contract / PRD FR-09 / AC-3.2 / AC-3.3 /
 * AC-3.4):
 *
 *   signature: buildScreenshotFilename(siteName, pageName, capturedAt) → string
 *   steps:
 *     1. toLowerCase() both slugs.
 *     2. replace every run of non-[a-z0-9_-] with a single `-`.
 *     3. trim leading/trailing `-`.
 *     4. assemble `${siteSlug}_${pageSlug}_${YYYYMMDD}-${HHmm}.png` using
 *        LOCAL time (not UTC).
 *     5. if total length > 100, proportionally truncate siteSlug + pageSlug
 *        (preserve ≥ 1 char each) so the final string is ≤ 100 and the
 *        `.png` extension + timestamp suffix are preserved.
 *
 *   TEST-1: baseline ('acme','home',…) → 'acme_home_20260422-0942.png'.
 *   TEST-2: unicode + punctuation → lowercased, kebab, ASCII-only.
 *   TEST-3: emoji → '-'; runs collapsed; final matches /^[a-z0-9_-]+\.png$/.
 *   TEST-4: 200-char site + 200-char page → length ≤ 100, ends with '.png',
 *           timestamp preserved; both slugs kept proportional (≥ 1 char each).
 *   TEST-5: local time, not UTC — verified by passing a Date whose local HH:mm
 *           matches the expected timestamp regardless of TZ.
 *   TEST-6: minute-granularity collision — two calls within the same minute
 *           return an identical string.
 */

import { describe, it, expect } from 'vitest';

import { buildScreenshotFilename } from './filename';

// -----------------------------------------------------------------------------
// T021a-TEST-1 — baseline
// -----------------------------------------------------------------------------
describe('T021a-TEST-1 — Filename baseline', () => {
  it('formats a simple ASCII site + page + local timestamp as the § 4c-4 template', () => {
    const result = buildScreenshotFilename(
      'acme',
      'home',
      new Date('2026-04-22T09:42:00'),
    );
    expect(result).toBe('acme_home_20260422-0942.png');
  });
});

// -----------------------------------------------------------------------------
// T021a-TEST-2 — Unicode + punctuation → kebab, lowercased
// -----------------------------------------------------------------------------
describe('T021a-TEST-2 — Unicode + punctuation → "-"; output lowercased and kebab', () => {
  it('replaces non-[a-z0-9_-] chars with "-", lowercases, matches the full regex', () => {
    const result = buildScreenshotFilename(
      'Marketing Sïte!',
      'Home — Landing',
      new Date('2026-04-22T09:42:00'),
    );
    // Whole string must be lowercase kebab + _ separators + .png extension.
    expect(result).toMatch(/^[a-z0-9_-]+\.png$/);
    // Timestamp preserved verbatim.
    expect(result).toContain('_20260422-0942.png');
    // All letters lowercased.
    expect(result).toBe(result.toLowerCase());
    // Uppercase letters from input must be gone.
    expect(result).not.toMatch(/[A-Z]/);
    // Spaces, punctuation, non-ASCII chars collapsed into `-` runs.
    expect(result).not.toContain(' ');
    expect(result).not.toContain('!');
    expect(result).not.toContain('—');
    expect(result).not.toContain('ï');
    // No run of two or more `-` should remain (step 2 collapses runs).
    expect(result).not.toMatch(/--/);
  });
});

// -----------------------------------------------------------------------------
// T021a-TEST-3 — Emoji → "-"
// -----------------------------------------------------------------------------
describe('T021a-TEST-3 — Emoji → "-"', () => {
  it('replaces emoji with `-`, collapses runs, still matches the regex', () => {
    const result = buildScreenshotFilename(
      'acme 🚀',
      'home',
      new Date('2026-04-22T09:42:00'),
    );
    expect(result).toMatch(/^[a-z0-9_-]+\.png$/);
    expect(result).not.toMatch(/--/);
    expect(result).toContain('_20260422-0942.png');
  });
});

// -----------------------------------------------------------------------------
// T021a-TEST-4 — Overlong input truncates to ≤ 100 chars
// -----------------------------------------------------------------------------
describe('T021a-TEST-4 — Overlong input truncates to ≤ 100 chars, .png preserved, timestamp preserved', () => {
  it('caps length at 100 chars while preserving both ".png" and the timestamp', () => {
    const longSite = 'a'.repeat(200);
    const longPage = 'b'.repeat(200);
    const result = buildScreenshotFilename(
      longSite,
      longPage,
      new Date('2026-04-22T09:42:00'),
    );

    expect(result.length).toBeLessThanOrEqual(100);
    expect(result.endsWith('.png')).toBe(true);
    // Timestamp segment is preserved verbatim.
    expect(result).toContain('20260422-0942');
    // Both slugs contribute at least one character (proportional truncation
    // preserves ≥ 1 char each per § 4c-4 step 5).
    expect(result).toMatch(/^a+_b+_20260422-0942\.png$/);
  });
});

// -----------------------------------------------------------------------------
// T021a-TEST-5 — Local time (not UTC)
// -----------------------------------------------------------------------------
describe('T021a-TEST-5 — Local time (not UTC)', () => {
  it('uses the Date\'s local HH:mm, never UTC', () => {
    // Construct a Date that, when read via `getHours()` / `getMinutes()`
    // (local), yields 23:59 — regardless of the runner's timezone. We do this
    // by constructing the date from the same local wall-clock spec the
    // helper will read. The expected filename segment is `20260422-2359`.
    const d = new Date(2026, 3, 22, 23, 59, 0, 0); // month is 0-indexed (3 → April)
    const result = buildScreenshotFilename('s', 'p', d);
    expect(result).toBe('s_p_20260422-2359.png');
  });
});

// -----------------------------------------------------------------------------
// T021a-TEST-6 — Minute-granularity collision produces identical filename
// -----------------------------------------------------------------------------
describe('T021a-TEST-6 — Minute-granularity collision produces identical filename', () => {
  it('returns the identical string for two calls with the same site/page/minute', () => {
    const d1 = new Date('2026-04-22T09:42:15');
    const d2 = new Date('2026-04-22T09:42:58');
    const a = buildScreenshotFilename('acme', 'home', d1);
    const b = buildScreenshotFilename('acme', 'home', d2);
    expect(a).toBe(b);
  });
});
