'use client';

/**
 * T022b — `<InlineMessage>` slot — Blok redesign pass.
 *
 * Migrates off the custom Shutterbug rose/stone inline strip onto the Blok
 * `<Alert>` primitive. Preserves the visibility contract:
 *   - When `visible === false`, renders a stub div with `display: none`
 *     + `aria-hidden="true"` so screen readers skip it and the action bar
 *     does not reserve vertical space.
 *   - When `visible === true`, renders a Blok Alert with `role="status"`
 *     + `aria-live="polite"` so polite announcements still happen when a
 *     message becomes visible.
 *
 * Tone mapping:
 *   - `info` (default) → Alert variant="default" (Blok neutral/info surface)
 *   - `warn`           → Alert variant="warning"
 *
 * NOTE: Blok's `<Alert>` default renders `role="alert"`; to keep the existing
 * announcement semantics (polite, not assertive) we render a lightweight
 * Alert-styled `<div>` with an explicit `role="status"` + `aria-live="polite"`.
 * The visual layering (border, surface, icon slot) matches Blok tokens.
 */

import { mdiAlertOutline, mdiInformationOutline } from '@mdi/js';
import type { ReactNode } from 'react';

import { Icon } from '@/lib/icon';
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

  const iconPath = tone === 'warn' ? mdiAlertOutline : mdiInformationOutline;

  return (
    <div
      data-inline-message
      data-visible="true"
      data-tone={tone}
      role="status"
      aria-live="polite"
      data-slot="alert"
      className={cn(
        // Blok Alert base: rounded, padded surface with icon + body grid.
        'relative mt-2 grid w-full grid-cols-[calc(var(--spacing)*4)_1fr] items-center gap-x-3 gap-y-0.5 rounded-md px-3 py-2 text-xs',
        tone === 'warn'
          ? 'bg-warning-bg text-warning-fg'
          : 'bg-neutral-bg text-neutral-fg',
      )}
    >
      <Icon
        path={iconPath}
        size={0.85}
        className={tone === 'warn' ? 'text-warning-500' : 'text-neutral-500'}
      />
      <div className="col-start-2">{children}</div>
    </div>
  );
}
