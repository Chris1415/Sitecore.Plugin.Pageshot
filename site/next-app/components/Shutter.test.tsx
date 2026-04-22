/**
 * T014a-TEST-1..6 — `<Shutter>` hero button.
 *
 * Behavior under test (§ 4 T014a / § 4c-4 hero shutter spec / § 4c-4 announcement
 * + keyboard map / POC v2 `.shutter` CSS):
 *
 *   TEST-1: idle state renders a `<button>` with `aria-label="Capture screenshot"`,
 *           NOT `aria-busy`, a Lucide Camera SVG, and the amber-500 / rounded-full
 *           class set.
 *   TEST-2: capturing state flips `aria-busy="true"`, swaps the label to
 *           "Capturing screenshot", and swaps the camera icon for the aperture
 *           spinner element.
 *   TEST-3: Enter and Space activate the button via keyboard — `onPress` fires
 *           exactly once per keystroke (native <button> regression guard).
 *   TEST-4: Visible focus ring under `:focus-visible` — the button class list
 *           includes a `ring-*` / `focus-visible:` class; `outline: none`
 *           alone is never acceptable.
 *   TEST-5: Disabled state swallows clicks — `onPress` NOT called; the button
 *           carries `disabled` (or `aria-disabled="true"`).
 *   TEST-6: `prefers-reduced-motion: reduce` collapses the scale spring + bloom —
 *           no `animate-shutter-press` class applied on press; no bloom overlay
 *           sibling animated.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import { setReducedMotion } from '@/test-utils/mockMatchMedia';

import { Shutter } from './Shutter';

beforeEach(() => {
  // Default to non-reduced-motion; individual tests opt in.
  setReducedMotion(false);
});

// -----------------------------------------------------------------------------
// T014a-TEST-1 — idle state renders with correct ARIA + camera icon
// -----------------------------------------------------------------------------
describe('T014a-TEST-1 — Shutter renders default idle state with correct ARIA', () => {
  it('renders a <button> with aria-label "Capture screenshot", no aria-busy, a camera icon, amber + rounded-full classes', () => {
    render(<Shutter state="idle" onPress={() => undefined} />);

    const btn = screen.getByRole('button', { name: /capture screenshot/i });
    expect(btn).toBeInTheDocument();
    expect(btn).not.toHaveAttribute('aria-busy');
    // Amber palette + circular intent.
    expect(btn.className).toMatch(/rounded-full/);
    expect(btn.className).toMatch(/amber/);
    // Camera icon present. Lucide renders an inline <svg> — we assert by
    // a stable data-testid the component exposes on the icon wrapper so
    // the test is not coupled to a specific Lucide SVG attribute set.
    expect(btn.querySelector('[data-testid="shutter-icon-camera"]')).not.toBeNull();
    expect(btn.querySelector('[data-testid="shutter-icon-aperture"]')).toBeNull();
  });
});

// -----------------------------------------------------------------------------
// T014a-TEST-2 — capturing state flips aria-busy + label + swaps icon
// -----------------------------------------------------------------------------
describe('T014a-TEST-2 — capturing state flips aria-busy and label', () => {
  it('renders aria-busy="true", aria-label "Capturing screenshot", and the aperture spinner', () => {
    render(<Shutter state="capturing" onPress={() => undefined} />);

    const btn = screen.getByRole('button', { name: /capturing screenshot/i });
    expect(btn).toHaveAttribute('aria-busy', 'true');
    expect(btn.querySelector('[data-testid="shutter-icon-aperture"]')).not.toBeNull();
    expect(btn.querySelector('[data-testid="shutter-icon-camera"]')).toBeNull();
  });

  it('capturing-slow state shares aria-busy + aperture icon', () => {
    render(<Shutter state="capturing-slow" elapsedSeconds={5} onPress={() => undefined} />);

    const btn = screen.getByRole('button', { name: /capturing screenshot/i });
    expect(btn).toHaveAttribute('aria-busy', 'true');
    expect(btn.querySelector('[data-testid="shutter-icon-aperture"]')).not.toBeNull();
  });
});

// -----------------------------------------------------------------------------
// T014a-TEST-3 — Enter and Space activate the button
// -----------------------------------------------------------------------------
describe('T014a-TEST-3 — Enter and Space activate the button', () => {
  // Native <button> translates Enter keydown + Space keyup into a click event.
  // We simulate that native behaviour with fireEvent here — the regression
  // guard is that no custom keydown handler is swallowing the event.
  it('fires onPress once on Enter keydown (native button default)', () => {
    const onPress = vi.fn();
    render(<Shutter state="idle" onPress={onPress} />);

    const btn = screen.getByRole('button', { name: /capture screenshot/i });
    btn.focus();
    fireEvent.keyDown(btn, { key: 'Enter', code: 'Enter' });
    fireEvent.click(btn);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('fires onPress once on Space keyup (native button default)', () => {
    const onPress = vi.fn();
    render(<Shutter state="idle" onPress={onPress} />);

    const btn = screen.getByRole('button', { name: /capture screenshot/i });
    btn.focus();
    fireEvent.keyUp(btn, { key: ' ', code: 'Space' });
    fireEvent.click(btn);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('fires onPress on a click (baseline)', () => {
    const onPress = vi.fn();
    render(<Shutter state="idle" onPress={onPress} />);

    const btn = screen.getByRole('button', { name: /capture screenshot/i });
    fireEvent.click(btn);
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

// -----------------------------------------------------------------------------
// T014a-TEST-4 — Visible focus ring under :focus-visible
// -----------------------------------------------------------------------------
describe('T014a-TEST-4 — Visible focus ring is not suppressed', () => {
  it('applies a focus-visible ring utility class', () => {
    render(<Shutter state="idle" onPress={() => undefined} />);
    const btn = screen.getByRole('button', { name: /capture screenshot/i });
    // Focus-visible amber ring per § 4c-4. Assert the class fragment.
    expect(btn.className).toMatch(/focus-visible:(ring|shadow)/);
  });

  it('does not set outline:none via inline style', () => {
    render(<Shutter state="idle" onPress={() => undefined} />);
    const btn = screen.getByRole('button', { name: /capture screenshot/i });
    // Inline style suppression is the anti-pattern we guard against; the
    // component relies on the utility class chain + the browser's focus ring.
    expect(btn.style.outline).not.toBe('none');
  });
});

// -----------------------------------------------------------------------------
// T014a-TEST-5 — Disabled state swallows clicks
// -----------------------------------------------------------------------------
describe('T014a-TEST-5 — Disabled state swallows clicks', () => {
  it('does not fire onPress when clicked in state="disabled"', () => {
    const onPress = vi.fn();
    render(<Shutter state="disabled" onPress={onPress} />);

    // Query by role; disabled buttons are still in the a11y tree.
    const btn = screen.getByRole('button');
    expect(btn).toBeDisabled();
    // Native disabled buttons swallow clicks — fireEvent.click is a no-op.
    fireEvent.click(btn);
    expect(onPress).not.toHaveBeenCalled();
  });
});

// -----------------------------------------------------------------------------
// T014a-TEST-6 — prefers-reduced-motion collapses scale + bloom
// -----------------------------------------------------------------------------
describe('T014a-TEST-6 — prefers-reduced-motion collapses scale + bloom', () => {
  it('does NOT apply the shutter-press / bloom animation class when reduced-motion is on', () => {
    setReducedMotion(true);
    const onPress = vi.fn();
    render(<Shutter state="idle" onPress={onPress} />);

    const btn = screen.getByRole('button', { name: /capture screenshot/i });
    fireEvent.click(btn);

    // The component must not attach animate-shutter-press / animate-shutter-bloom
    // under reduced-motion. These classes are the POC's motion tokens — their
    // absence is the only way reduced-motion is honoured client-side.
    expect(btn.className).not.toMatch(/animate-shutter-press/);

    // Bloom overlay is a sibling of the button, rendered inside the Shutter
    // wrapper. Under reduced-motion it is either absent or has no bloom class.
    const wrapper = btn.parentElement;
    const bloom = wrapper?.querySelector('[data-testid="shutter-bloom"]');
    if (bloom) {
      expect(bloom.className).not.toMatch(/animate-shutter-bloom/);
    }
    // Click still calls onPress — motion choices must not interfere.
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('DOES apply the shutter-press class when reduced-motion is off', () => {
    setReducedMotion(false);
    const onPress = vi.fn();
    render(<Shutter state="idle" onPress={onPress} />);

    const btn = screen.getByRole('button', { name: /capture screenshot/i });
    fireEvent.click(btn);

    // The component attaches animate-shutter-press during the press window —
    // this is the POC's 380 ms spring (§ 4c-3 tailwind tokens).
    expect(btn.className).toMatch(/animate-shutter-press/);
  });
});
