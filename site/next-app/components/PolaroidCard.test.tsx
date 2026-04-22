/**
 * T017a-TEST-1..5 — `<PolaroidCard>` ready + error variants.
 *
 * Behavior under test (§ 4 T017a / § 4c-4 Polaroid preview card / § 4c-4 error
 * card + error icon mapping / POC v2 `.polaroid` block):
 *
 *   TEST-1: ready variant renders an `<img>` with `src="data:image/png;base64,AAA"`
 *           and `alt` that mentions the page name, the site name, and the
 *           captured date/time.
 *   TEST-2: ready ledge shows `{siteName}/{pageName}` on the left and `HH:mm`
 *           local on the right; both carry the `truncate` class for overflow.
 *   TEST-3: error variant renders the exact § 4c-4 per-code title + subtitle
 *           for each of the five codes; title carries `text-rose-600` (NOT
 *           -500, per § 4.5 contrast); icon is `WifiOff` for `network`,
 *           `AlertCircle` for the other four.
 *   TEST-4: error ledge shows the FR-12 hint ("Shows the last saved version
 *           of this page.") in italic + centered.
 *   TEST-5: reduced-motion collapses the slide-up entrance to opacity only —
 *           no `translate-y-*` utility on the arrival wrapper.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';

import { setReducedMotion } from '@/test-utils/mockMatchMedia';

import { PolaroidCard } from './PolaroidCard';
import type { PanelErrorCode } from './use-panel-state';

beforeEach(() => {
  setReducedMotion(false);
});

// -----------------------------------------------------------------------------
// T017a-TEST-1 — Ready variant renders image with full alt text
// -----------------------------------------------------------------------------
describe('T017a-TEST-1 — Ready variant renders image with full alt text', () => {
  it('renders an <img> with data:image/png;base64 src and alt mentioning page, site, capturedAt', () => {
    render(
      <PolaroidCard
        kind="ready"
        imageBase64="AAA"
        siteName="acme"
        pageName="Home"
        capturedAt={new Date('2026-04-22T09:14:00')}
      />,
    );

    const img = screen.getByRole('img') as HTMLImageElement;
    expect(img.getAttribute('src')).toBe('data:image/png;base64,AAA');
    const alt = img.getAttribute('alt') ?? '';
    expect(alt).toMatch(/Home/);
    expect(alt).toMatch(/acme/);
    // The alt must reference the capturedAt — accept any date-ish substring
    // that includes the year and the HH:mm local time.
    expect(alt).toMatch(/2026/);
    expect(alt).toMatch(/09:14/);
  });
});

// -----------------------------------------------------------------------------
// T017a-TEST-2 — Ready ledge shows {site}/{page} + HH:mm local
// -----------------------------------------------------------------------------
describe('T017a-TEST-2 — Ready ledge shows {site}/{page} + HH:mm local', () => {
  it('renders the site/page on the left and the HH:mm local time on the right; both truncate', () => {
    render(
      <PolaroidCard
        kind="ready"
        imageBase64="AAA"
        siteName="acme"
        pageName="Home"
        capturedAt={new Date('2026-04-22T09:14:00')}
      />,
    );

    const ledge = screen.getByTestId('polaroid-ledge');
    expect(ledge).toBeInTheDocument();

    const sitePage = within(ledge).getByTestId('polaroid-ledge-site-page');
    expect(sitePage.textContent).toBe('acme/Home');
    expect(sitePage.className).toMatch(/truncate/);

    const time = within(ledge).getByTestId('polaroid-ledge-time');
    expect(time.textContent).toBe('09:14');
    expect(time.className).toMatch(/truncate/);
  });
});

// -----------------------------------------------------------------------------
// T017a-TEST-3 — Error variant renders per-code title + subtitle (table-driven)
// -----------------------------------------------------------------------------
describe('T017a-TEST-3 — Error variant renders per-code title + subtitle (table-driven)', () => {
  const cases: Array<{
    code: PanelErrorCode;
    title: string;
    subtitle: string;
    iconTestId: 'polaroid-error-icon-wifi-off' | 'polaroid-error-icon-alert-circle';
  }> = [
    {
      code: 'auth',
      title: 'Authentication failed.',
      subtitle: "Ask your administrator to check the app's credentials.",
      iconTestId: 'polaroid-error-icon-alert-circle',
    },
    {
      code: 'not_found',
      title: "We couldn't find that page.",
      subtitle: 'Save the page first, then try again.',
      iconTestId: 'polaroid-error-icon-alert-circle',
    },
    {
      code: 'upstream_unavailable',
      title: 'Screenshot service is unavailable.',
      subtitle: 'Try again in a moment.',
      iconTestId: 'polaroid-error-icon-alert-circle',
    },
    {
      code: 'network',
      title: 'You appear to be offline.',
      subtitle: 'Check your connection, then try again.',
      iconTestId: 'polaroid-error-icon-wifi-off',
    },
    {
      code: 'unknown',
      title: 'Something went wrong.',
      subtitle: 'Try again in a moment.',
      iconTestId: 'polaroid-error-icon-alert-circle',
    },
  ];

  it.each(cases)(
    'renders the § 4c-4 title + subtitle for code=$code with the correct icon',
    ({ code, title, subtitle, iconTestId }) => {
      const { unmount } = render(<PolaroidCard kind="error" code={code} />);

      // Title text must match exactly, and carry text-rose-600 (not -500).
      const titleEl = screen.getByTestId('polaroid-error-title');
      expect(titleEl.textContent).toBe(title);
      expect(titleEl.className).toMatch(/text-rose-600/);
      expect(titleEl.className).not.toMatch(/text-rose-500(\s|$)/);

      const subtitleEl = screen.getByTestId('polaroid-error-subtitle');
      expect(subtitleEl.textContent).toBe(subtitle);

      // Icon mapping per § 4c-4: WifiOff for network, AlertCircle otherwise.
      expect(screen.getByTestId(iconTestId)).toBeInTheDocument();
      unmount();
    },
  );
});

// -----------------------------------------------------------------------------
// T017a-TEST-4 — Error ledge shows FR-12 hint italic + centered
// -----------------------------------------------------------------------------
describe('T017a-TEST-4 — Error ledge shows FR-12 hint italic + centered', () => {
  it('renders the FR-12 hint in italic + center-aligned on the error ledge', () => {
    render(<PolaroidCard kind="error" code="not_found" />);
    const ledge = screen.getByTestId('polaroid-ledge');
    expect(ledge.textContent).toContain(
      'Shows the last saved version of this page.',
    );
    // Italic + center alignment classes per § 4c-4.
    expect(ledge.className).toMatch(/italic/);
    expect(ledge.className).toMatch(/text-center|justify-center/);
  });
});

// -----------------------------------------------------------------------------
// T017a-TEST-5 — Reduced motion collapses slide-up to opacity only
// -----------------------------------------------------------------------------
describe('T017a-TEST-5 — Reduced motion collapses slide-up to opacity only', () => {
  it('does not apply any translate-y-* utility on the arrival wrapper when reduced-motion is on', () => {
    setReducedMotion(true);
    render(
      <PolaroidCard
        kind="ready"
        imageBase64="AAA"
        siteName="acme"
        pageName="Home"
        capturedAt={new Date('2026-04-22T09:14:00')}
      />,
    );
    const root = screen.getByTestId('polaroid-root');
    expect(root.className).not.toMatch(/translate-y-/);
    // Opacity-only transition still allowed.
    expect(root.className).toMatch(/opacity/);
  });

  it('DOES apply a translate-y-* utility when reduced-motion is off', () => {
    setReducedMotion(false);
    render(
      <PolaroidCard
        kind="ready"
        imageBase64="AAA"
        siteName="acme"
        pageName="Home"
        capturedAt={new Date('2026-04-22T09:14:00')}
      />,
    );
    const root = screen.getByTestId('polaroid-root');
    // The arrival motion: starts at translate-y-2 (enter), animates to
    // translate-y-0. Either present is fine — we assert the token is in the
    // class chain at all.
    expect(root.className).toMatch(/translate-y-/);
  });
});
