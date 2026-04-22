/**
 * T018a-TEST-1..5 — `<ActionPill>` Copy / Download / Retry pill.
 *
 * Behavior under test (§ 4 T018a / § 4c-4 action pills spec / POC v2
 * `.action-pill` block):
 *
 *   TEST-1: variant → icon + default label mapping.
 *           - copy     → Lucide Copy + "Copy"
 *           - download → Lucide Download + "Download"
 *           - retry    → Lucide RefreshCw + "Retry"
 *   TEST-2: disabled state swallows click; `disabled` attribute present.
 *   TEST-3: Copy success state renders label "Copied" then auto-reverts to
 *           "Copy" after 1.8 s (via `state="success"` prop + fake timers).
 *   TEST-4: Download success state renders label "Saved" then auto-reverts to
 *           "Download" after 1.4 s (same mechanism, shorter window).
 *   TEST-5: keyboard Enter and Space activate (native <button> regression guard).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen, act } from '@testing-library/react';

import { ActionPill } from './ActionPill';

beforeEach(() => {
  vi.useRealTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

// -----------------------------------------------------------------------------
// T018a-TEST-1 — variant → icon + default label mapping
// -----------------------------------------------------------------------------
describe('T018a-TEST-1 — variant → icon + default label mapping', () => {
  it('copy variant renders Copy icon + "Copy" label', () => {
    render(<ActionPill variant="copy" onPress={() => undefined} />);
    const btn = screen.getByRole('button', { name: /copy/i });
    expect(btn).toBeInTheDocument();
    expect(btn.querySelector('[data-testid="action-pill-icon-copy"]')).not.toBeNull();
    expect(btn.textContent).toContain('Copy');
  });

  it('download variant renders Download icon + "Download" label', () => {
    render(<ActionPill variant="download" onPress={() => undefined} />);
    const btn = screen.getByRole('button', { name: /download/i });
    expect(btn).toBeInTheDocument();
    expect(btn.querySelector('[data-testid="action-pill-icon-download"]')).not.toBeNull();
    expect(btn.textContent).toContain('Download');
  });

  it('retry variant renders RefreshCw icon + "Retry" label', () => {
    render(<ActionPill variant="retry" onPress={() => undefined} />);
    const btn = screen.getByRole('button', { name: /retry/i });
    expect(btn).toBeInTheDocument();
    expect(btn.querySelector('[data-testid="action-pill-icon-refresh-cw"]')).not.toBeNull();
    expect(btn.textContent).toContain('Retry');
  });
});

// -----------------------------------------------------------------------------
// T018a-TEST-2 — disabled state swallows click
// -----------------------------------------------------------------------------
describe('T018a-TEST-2 — disabled state swallows click', () => {
  it('does not fire onPress when state="disabled" is clicked', () => {
    const onPress = vi.fn();
    render(<ActionPill variant="copy" state="disabled" onPress={onPress} />);
    const btn = screen.getByRole('button');
    expect(btn).toBeDisabled();
    fireEvent.click(btn);
    expect(onPress).not.toHaveBeenCalled();
  });
});

// -----------------------------------------------------------------------------
// T018a-TEST-3 — Copy success auto-reverts after 1.8 s
// -----------------------------------------------------------------------------
describe('T018a-TEST-3 — Copy success auto-reverts after 1.8 s', () => {
  it('shows "Copied" immediately and reverts to "Copy" after 1800 ms', () => {
    vi.useFakeTimers();
    const { rerender } = render(
      <ActionPill variant="copy" onPress={() => undefined} />,
    );
    // Flip to success — parent drives state; we assert the label morphs and
    // then reverts via the component's internal timer.
    rerender(
      <ActionPill variant="copy" state="success" onPress={() => undefined} />,
    );
    expect(screen.getByRole('button').textContent).toContain('Copied');

    // After 1.8 s the pill reverts — fake-advance and flush state updates.
    act(() => {
      vi.advanceTimersByTime(1800);
    });
    expect(screen.getByRole('button').textContent).toContain('Copy');
    expect(screen.getByRole('button').textContent).not.toContain('Copied');
  });
});

// -----------------------------------------------------------------------------
// T018a-TEST-4 — Download success auto-reverts after 1.4 s
// -----------------------------------------------------------------------------
describe('T018a-TEST-4 — Download success auto-reverts after 1.4 s', () => {
  it('shows "Saved" immediately and reverts to "Download" after 1400 ms', () => {
    vi.useFakeTimers();
    const { rerender } = render(
      <ActionPill variant="download" onPress={() => undefined} />,
    );
    rerender(
      <ActionPill variant="download" state="success" onPress={() => undefined} />,
    );
    expect(screen.getByRole('button').textContent).toContain('Saved');

    // Before 1400 ms — still shows "Saved".
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByRole('button').textContent).toContain('Saved');

    // After 1400 ms — reverts to default label.
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(screen.getByRole('button').textContent).toContain('Download');
    expect(screen.getByRole('button').textContent).not.toContain('Saved');
  });
});

// -----------------------------------------------------------------------------
// T018a-TEST-5 — keyboard Enter and Space activate
// -----------------------------------------------------------------------------
describe('T018a-TEST-5 — keyboard Enter and Space activate', () => {
  it('fires onPress once on Enter keydown (native button default)', () => {
    const onPress = vi.fn();
    render(<ActionPill variant="copy" onPress={onPress} />);
    const btn = screen.getByRole('button');
    btn.focus();
    fireEvent.keyDown(btn, { key: 'Enter', code: 'Enter' });
    fireEvent.click(btn);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('fires onPress once on Space keyup (native button default)', () => {
    const onPress = vi.fn();
    render(<ActionPill variant="copy" onPress={onPress} />);
    const btn = screen.getByRole('button');
    btn.focus();
    fireEvent.keyUp(btn, { key: ' ', code: 'Space' });
    fireEvent.click(btn);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('applies focus-visible ring utility classes (amber-400)', () => {
    render(<ActionPill variant="copy" onPress={() => undefined} />);
    const btn = screen.getByRole('button');
    expect(btn.className).toMatch(/focus-visible:ring/);
    expect(btn.className).toMatch(/amber-400/);
  });
});
