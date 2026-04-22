'use client';

/**
 * T022b — `<InlineMessage>` slot.
 *
 * Source of truth: § 4c-4 copy block + § 4 T022b styling. The per-code error
 * title + subtitle + icon live inside `<PolaroidCard>`'s error variant (the
 * "error-in-polaroid" pattern); this component is the secondary copy slot,
 * used for the clipboard-denied fallback and any non-error hint shown below
 * the action bar.
 *
 * Props:
 *   - `visible`  — boolean. When false, the node is rendered with
 *                  `display: none` + `data-visible="false"` so it is hidden
 *                  from the a11y tree (screen readers do not announce hidden
 *                  content) AND layout is not reserved (the action bar does
 *                  not jump).
 *   - `tone?`    — 'info' | 'warn'. Default 'info'. Drives the border/surface
 *                  (no semantic change — still `role="status"` so polite
 *                  announcements work for both).
 *   - `children` — the text / nodes to render.
 *
 * Accessibility:
 *   - `role="status"` + `aria-live="polite"` — changes are announced politely
 *     once the node becomes visible.
 */

import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

export interface InlineMessageProps {
  visible: boolean;
  children: ReactNode;
  tone?: 'info' | 'warn';
}

export function InlineMessage({
  visible,
  children,
  tone = 'info',
}: InlineMessageProps) {
  // Hidden path: keep the node in the DOM but `display: none` so layout is
  // not reserved and the a11y tree ignores the content.
  if (!visible) {
    return (
      <div
        data-inline-message
        data-visible="false"
        style={{ display: 'none' }}
        aria-hidden="true"
      />
    );
  }

  return (
    <div
      data-inline-message
      data-visible="true"
      data-tone={tone}
      role="status"
      aria-live="polite"
      className={cn(
        'mt-2 rounded-lg border px-3 py-2 text-xs',
        tone === 'warn'
          ? 'border-rose-200 bg-rose-50 text-rose-700'
          : 'border-stone-200 bg-stone-50 text-stone-600',
      )}
    >
      {children}
    </div>
  );
}
