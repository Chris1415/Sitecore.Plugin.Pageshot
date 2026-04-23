'use client';

/**
 * `<ThemeToggle>` — compact cycling button: auto → light → dark → auto.
 *
 * Sits in the panel header, opposite the PageShot wordmark. One click
 * advances to the next mode; the icon reflects the CURRENT mode (so the
 * user sees what's active, not what the next press will do).
 *
 * Accessibility: `<button>` with `aria-label` describing both the current
 * mode AND the action that will happen on press ("Theme: auto — click to
 * switch to light"). Keyboard-operable via Enter / Space natively.
 */

import { Monitor, Moon, Sun } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import type { ThemeMode } from './useThemeMode';

const CYCLE: Record<ThemeMode, ThemeMode> = {
  auto: 'light',
  light: 'dark',
  dark: 'auto',
};

const ICONS: Record<ThemeMode, LucideIcon> = {
  auto: Monitor,
  light: Sun,
  dark: Moon,
};

const LABELS: Record<ThemeMode, string> = {
  auto: 'Auto (system)',
  light: 'Light',
  dark: 'Dark',
};

export interface ThemeToggleProps {
  mode: ThemeMode;
  onChange: (next: ThemeMode) => void;
}

export function ThemeToggle({ mode, onChange }: ThemeToggleProps) {
  const Icon = ICONS[mode];
  const next = CYCLE[mode];
  return (
    <button
      type="button"
      data-testid="theme-toggle"
      data-mode={mode}
      aria-label={`Theme: ${LABELS[mode]} — click to switch to ${LABELS[next]}`}
      onClick={() => onChange(next)}
      className={[
        'flex h-7 w-7 items-center justify-center rounded-full',
        'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background',
        'transition-colors',
      ].join(' ')}
    >
      <Icon aria-hidden="true" className="h-4 w-4" />
    </button>
  );
}
