'use client';

/**
 * Post-MVP viewport selector (T029 dogfood extension) — Blok redesign pass.
 *
 * Replaces the custom amber/stone pill group with a Blok-tokened toggle-group
 * surface. No Blok `toggle-group` primitive is installed in this project
 * (registry lookup returned none), so the component remains a composition of
 * native `<button aria-pressed>` elements — now styled with Blok semantic
 * tokens so the panel respects light/dark mode and Sitecore brand colours.
 *
 * Behaviour (unchanged from the pre-redesign implementation):
 *   - Multi-select: mobile, desktop, or both may be active.
 *   - At-least-one invariant: clicking the only active option is a no-op.
 *   - Active order is canonical (mobile then desktop).
 *   - Full group is `aria-label="Capture viewports"`.
 *   - Each button keeps its `aria-pressed` + `aria-label` + `data-testid`.
 *
 * Tests cover the behaviour matrix; this file touches only the class chain.
 */

import { Monitor, Smartphone } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

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
      if (value.length <= 1) return;
      onChange(ORDER.filter((x) => x !== v && isActive(x)));
      return;
    }
    onChange(ORDER.filter((x) => x === v || isActive(x)));
  };

  return (
    <div
      role="group"
      aria-label="Capture viewports"
      data-testid="viewport-toggle"
      className={cn(
        'flex w-full gap-1 rounded-full border border-border bg-muted p-1 text-sm',
      )}
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
            className={cn(
              'flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-1.5 font-medium transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background',
              'disabled:cursor-not-allowed disabled:opacity-60',
              active
                ? 'bg-primary text-inverse-text shadow-sm'
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
            )}
          >
            <Icon aria-hidden="true" className="h-4 w-4" />
            <span>{VIEWPORT_LABELS[v]}</span>
          </button>
        );
      })}
    </div>
  );
}
