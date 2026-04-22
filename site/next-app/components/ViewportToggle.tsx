'use client';

/**
 * Post-MVP viewport selector (T029 dogfood extension).
 *
 * MULTI-SELECT: the editor can enable Mobile, Desktop, or both. When both are
 * selected, PageShot fires two captures and stacks two Polaroids below each
 * other — one per viewport (per PRD mid-dogfood extension request).
 *
 * Constraint: at least one viewport must remain selected. Clicking the only
 * active option is a no-op (returns the same selection unchanged).
 *
 * Each option is a toggle button with `aria-pressed`. Tab reaches each
 * button in DOM order; Enter/Space activates. Active = amber fill.
 */

import { Monitor, Smartphone } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type Viewport = 'mobile' | 'desktop';

export const VIEWPORT_DIMENSIONS: Record<
  Viewport,
  { width: number; height: number }
> = {
  mobile: { width: 375, height: 812 },
  desktop: { width: 1200, height: 800 },
};

export const VIEWPORT_LABELS: Record<Viewport, string> = {
  mobile: 'Mobile',
  desktop: 'Desktop',
};

export interface ViewportToggleProps {
  value: Viewport[];
  onChange: (next: Viewport[]) => void;
  disabled?: boolean;
}

const ORDER: Viewport[] = ['mobile', 'desktop'];
const ICONS: Record<Viewport, LucideIcon> = {
  mobile: Smartphone,
  desktop: Monitor,
};

export function ViewportToggle({
  value,
  onChange,
  disabled = false,
}: ViewportToggleProps) {
  const isActive = (v: Viewport) => value.includes(v);

  const toggle = (v: Viewport) => {
    if (disabled) return;
    if (isActive(v)) {
      // Refuse to deselect the only remaining selection — at least one
      // viewport must stay active or Capture has nothing to do.
      if (value.length <= 1) return;
      onChange(ORDER.filter((x) => x !== v && isActive(x)));
      return;
    }
    // Activating — preserve canonical order (mobile, desktop).
    onChange(ORDER.filter((x) => x === v || isActive(x)));
  };

  return (
    <div
      role="group"
      aria-label="Capture viewports"
      data-testid="viewport-toggle"
      className="flex w-full gap-1 rounded-full border border-stone-200/70 bg-white/60 p-1 text-sm"
    >
      {ORDER.map((v) => {
        const active = isActive(v);
        const Icon = ICONS[v];
        return (
          <button
            key={v}
            type="button"
            aria-pressed={active}
            aria-label={VIEWPORT_LABELS[v]}
            data-testid={`viewport-${v}`}
            disabled={disabled}
            onClick={() => toggle(v)}
            className={[
              'flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-1.5 font-medium transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-1 focus-visible:ring-offset-amber-50',
              'disabled:cursor-not-allowed disabled:opacity-60',
              active
                ? 'bg-amber-400 text-stone-900 shadow-sm'
                : 'text-stone-600 hover:bg-amber-50',
            ].join(' ')}
          >
            <Icon aria-hidden="true" className="h-4 w-4" />
            <span>{VIEWPORT_LABELS[v]}</span>
          </button>
        );
      })}
    </div>
  );
}
