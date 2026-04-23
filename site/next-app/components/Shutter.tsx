'use client';

/**
 * T014b — `<Shutter>` hero button — Blok redesign pass.
 *
 * The 112 × 112 px circular hero button stays — only its colour language
 * changes. Amber-500 fill → Blok `bg-primary` (Sitecore brand token); amber-200
 * aperture ring → muted primary; amber-400 focus ring → Blok `ring-ring`. The
 * press-spring and bloom keyframes are kept in globals.css so the camera-click
 * feel remains intact; they are motion tokens, not brand tokens, and Blok does
 * not ship equivalents.
 *
 * Props (per § 4 T014b):
 *   - `state`            — "idle" | "capturing" | "capturing-slow" | "disabled"
 *   - `elapsedSeconds?`  — rendered by `<ShutterLabel>` (T015), kept on the
 *                          contract so the outer panel can thread it through.
 *   - `onPress`          — fired on click (and implicitly on Enter / Space).
 *
 * Accessibility (§ 4c-4 + § 4 T014b):
 *   - `aria-label`       = "Capture screenshot" (idle / disabled) or
 *                          "Capturing screenshot" (capturing / capturing-slow).
 *   - `aria-busy="true"` while capturing.
 *   - `:focus-visible`   — Blok ring-ring offset from bg-background.
 *   - Reduced motion     — `(prefers-reduced-motion: reduce)` suppresses the
 *                          `animate-shutter-press` class and the bloom overlay.
 */

import { Aperture, Camera } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { cn } from '@/lib/utils';

export type ShutterState =
  | 'idle'
  | 'capturing'
  | 'capturing-slow'
  | 'disabled';

export interface ShutterProps {
  state: ShutterState;
  elapsedSeconds?: number;
  onPress: () => void;
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState<boolean>(() => {
    if (typeof window === 'undefined' || !window.matchMedia) {
      return false;
    }
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) {
      return;
    }
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    const listener = (event: MediaQueryListEvent) => setReduced(event.matches);
    mql.addEventListener?.('change', listener);
    return () => mql.removeEventListener?.('change', listener);
  }, []);

  return reduced;
}

export function Shutter(props: ShutterProps) {
  const { state, onPress } = props;
  const reducedMotion = usePrefersReducedMotion();
  const [pressPulse, setPressPulse] = useState<boolean>(false);
  const [bloomActive, setBloomActive] = useState<boolean>(false);
  const pressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bloomTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (pressTimerRef.current) clearTimeout(pressTimerRef.current);
      if (bloomTimerRef.current) clearTimeout(bloomTimerRef.current);
    };
  }, []);

  const isCapturing = state === 'capturing' || state === 'capturing-slow';
  const isDisabled = state === 'disabled';

  const handleClick = useCallback(() => {
    if (isDisabled) return;
    if (!reducedMotion) {
      setPressPulse(true);
      setBloomActive(true);
      if (pressTimerRef.current) clearTimeout(pressTimerRef.current);
      if (bloomTimerRef.current) clearTimeout(bloomTimerRef.current);
      pressTimerRef.current = setTimeout(() => setPressPulse(false), 420);
      bloomTimerRef.current = setTimeout(() => setBloomActive(false), 420);
    }
    onPress();
  }, [isDisabled, onPress, reducedMotion]);

  const label = isCapturing ? 'Capturing screenshot' : 'Capture screenshot';

  return (
    <div className="relative flex h-36 w-36 items-center justify-center">
      {/* Bloom overlay — absolutely positioned sibling of the button.
          Under reduced-motion we render no animation class; the div stays
          inert (opacity 0). */}
      <div
        data-testid="shutter-bloom"
        aria-hidden="true"
        className={cn(
          'pointer-events-none absolute inset-0 rounded-full',
          'bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.95)_0%,rgba(255,255,255,0.5)_35%,rgba(255,255,255,0)_70%)]',
          'opacity-0',
          bloomActive && !reducedMotion && 'animate-shutter-bloom',
        )}
      />
      <button
        type="button"
        onClick={handleClick}
        disabled={isDisabled}
        aria-label={label}
        aria-busy={isCapturing ? 'true' : undefined}
        className={cn(
          // Base: 112 px circle, Blok primary hero, no native outline.
          'relative flex h-28 w-28 items-center justify-center rounded-full',
          'bg-primary text-primary-foreground',
          'shadow-md ring-4 ring-primary-background',
          'transition-[transform,background-color,box-shadow] duration-150',
          'focus:outline-none',
          // Focus-visible Blok ring offset from panel background.
          'focus-visible:ring-4 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          // Hover / active — disabled state overrides below.
          !isDisabled && 'hover:bg-primary-hover hover:ring-primary-background-active',
          !isDisabled && !reducedMotion && 'active:scale-[0.92]',
          isCapturing && 'cursor-progress',
          isDisabled && 'bg-muted cursor-not-allowed !shadow-none !ring-0',
          // Press spring — only when reduced-motion is OFF.
          pressPulse && !reducedMotion && 'animate-shutter-press',
        )}
      >
        {isCapturing ? (
          <span
            data-testid="shutter-icon-aperture"
            className={cn(
              'flex h-11 w-11 items-center justify-center',
              !reducedMotion && 'animate-spin',
            )}
            aria-hidden="true"
          >
            <Aperture className="h-11 w-11" strokeWidth={2} />
          </span>
        ) : (
          <span
            data-testid="shutter-icon-camera"
            className="flex h-11 w-11 items-center justify-center"
            aria-hidden="true"
          >
            <Camera className="h-7 w-7" strokeWidth={2} />
          </span>
        )}
      </button>
    </div>
  );
}
