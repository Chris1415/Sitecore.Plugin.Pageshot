'use client';

/**
 * Post-MVP height preset selector (T029 dogfood extension) — Blok redesign pass.
 *
 * The Agent API's `/screenshot` endpoint treats `height` as the exact
 * output-image height (not a viewport hint, not a minimum). There's no
 * `fullPage` toggle. So the best we can do is let the editor pick a
 * height tall enough for their page. Four presets:
 *
 *   - small  =  800 px (API default; fits hero sections only)
 *   - medium = 2000 px (typical landing pages)
 *   - large  = 4000 px (long marketing pages — PageShot default)
 *   - full   = 8000 px (safely tall for nearly anything)
 *
 * Single-select radio group with roving tabindex. Keyboard (Left/Right,
 * Home/End) + click behaviour preserved; styling swapped from Shutterbug
 * amber/stone to Blok semantic tokens (primary for active, muted/accent
 * for the container + hover, ring-ring for focus).
 */

import { useCallback, useRef, type KeyboardEvent } from 'react';

import { cn } from '@/lib/utils';

export type HeightPreset = 'small' | 'medium' | 'large' | 'full';

export const HEIGHT_PRESET_PIXELS: Record<HeightPreset, number> = {
  small: 800,
  medium: 2000,
  large: 4000,
  full: 8000,
};

export const HEIGHT_PRESET_LABELS: Record<HeightPreset, string> = {
  small: 'Small',
  medium: 'Medium',
  large: 'Large',
  full: 'Full',
};

const ORDER: HeightPreset[] = ['small', 'medium', 'large', 'full'];

export interface HeightToggleProps {
  value: HeightPreset;
  onChange: (next: HeightPreset) => void;
  disabled?: boolean;
}

export function HeightToggle({
  value,
  onChange,
  disabled = false,
}: HeightToggleProps) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  const focusAt = useCallback((index: number) => {
    const el = refs.current[index];
    el?.focus();
  }, []);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
      if (disabled) return;
      const last = ORDER.length - 1;
      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
        event.preventDefault();
        const next = index === last ? 0 : index + 1;
        onChange(ORDER[next]!);
        focusAt(next);
        return;
      }
      if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
        event.preventDefault();
        const prev = index === 0 ? last : index - 1;
        onChange(ORDER[prev]!);
        focusAt(prev);
        return;
      }
      if (event.key === 'Home') {
        event.preventDefault();
        onChange(ORDER[0]!);
        focusAt(0);
        return;
      }
      if (event.key === 'End') {
        event.preventDefault();
        onChange(ORDER[last]!);
        focusAt(last);
        return;
      }
    },
    [disabled, focusAt, onChange],
  );

  return (
    <div
      role="radiogroup"
      aria-label="Capture height"
      data-testid="height-toggle"
      className="flex w-full gap-1 rounded-full border border-border bg-muted p-1 text-[13px]"
    >
      {ORDER.map((preset, index) => {
        const active = preset === value;
        return (
          <button
            key={preset}
            ref={(el) => {
              refs.current[index] = el;
            }}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={`${HEIGHT_PRESET_LABELS[preset]} (${HEIGHT_PRESET_PIXELS[preset]} px)`}
            data-testid={`height-${preset}`}
            tabIndex={active ? 0 : -1}
            disabled={disabled}
            onClick={() => onChange(preset)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={cn(
              'flex flex-1 items-center justify-center rounded-full px-2 py-1.5 font-medium transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background',
              'disabled:cursor-not-allowed disabled:opacity-60',
              active
                ? 'bg-primary text-inverse-text shadow-sm'
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
            )}
          >
            {HEIGHT_PRESET_LABELS[preset]}
          </button>
        );
      })}
    </div>
  );
}
