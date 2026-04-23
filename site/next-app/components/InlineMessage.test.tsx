/**
 * T022a-TEST-1..2 — `<InlineMessage>` slot for clipboard-denied + secondary
 * hints.
 *
 * Behavior under test (§ 4 T022a / § 4c-4 inline-message spec):
 *
 *   TEST-1: when `visible=true`, the node carries `role="status"` +
 *           `aria-live="polite"`, and the children are visible.
 *   TEST-2: when `visible=false`, the node is hidden from the a11y tree
 *           (display:none), so `getByRole('status')` does not find it and
 *           screen readers do not announce the hidden content.
 *
 * Note: § 4c-4 describes the error-in-polaroid variant (per-code title +
 * subtitle + icon) as part of `<PolaroidCard>` itself — that coverage lives
 * in `PolaroidCard.test.tsx`. `<InlineMessage>` is the separate copy slot for
 * secondary / denied-clipboard hints, used by T020b.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import { InlineMessage } from './InlineMessage';

// -----------------------------------------------------------------------------
// T022a-TEST-1 — visible state exposes role="status" + aria-live polite
// -----------------------------------------------------------------------------
describe('T022a-TEST-1 — Visible state exposes role="status" + aria-live polite', () => {
  it('renders the node with role="status", aria-live="polite", and children visible', () => {
    render(
      <InlineMessage visible>
        Clipboard access was blocked. Use Download instead.
      </InlineMessage>,
    );
    const node = screen.getByRole('status');
    expect(node).toBeInTheDocument();
    expect(node).toHaveAttribute('aria-live', 'polite');
    expect(node.textContent).toContain(
      'Clipboard access was blocked. Use Download instead.',
    );
    // Visible = not display:none.
    expect(node.getAttribute('data-visible')).toBe('true');
  });
});

// -----------------------------------------------------------------------------
// T022a-TEST-2 — hidden state hides from a11y tree
// -----------------------------------------------------------------------------
describe('T022a-TEST-2 — Hidden state hides from a11y tree', () => {
  it('does not expose the node via getByRole("status") when visible=false, and applies display:none', () => {
    render(
      <InlineMessage visible={false}>
        Clipboard access was blocked. Use Download instead.
      </InlineMessage>,
    );
    // Hidden via display:none — jsdom treats this as inaccessible to the
    // role query when the `hidden` option is false (its default).
    expect(screen.queryByRole('status')).toBeNull();

    // The node still exists in the DOM (so parent composition is stable) but
    // is hidden — we can find it by data attribute and assert display:none.
    const node = document.querySelector('[data-inline-message]') as HTMLElement | null;
    expect(node).not.toBeNull();
    expect(node?.getAttribute('data-visible')).toBe('false');
    expect(node?.style.display).toBe('none');
  });
});
