'use client';

/**
 * T014b — `<Shutter>` hero button.
 *
 * Visual source of truth: `products/pageshot/pocs/poc-v2/index.html` `.shutter`
 * block (112 × 112 amber circle, aperture ring, 380 ms spring press, 200/420 ms
 * capture bloom). Copy source of truth: § 4c-4 of the task breakdown.
 *
 * Props (per § 4 T014b):
 *   - `state`            — "idle" | "capturing" | "capturing-slow" | "disabled"
 *   - `elapsedSeconds?`  — seconds visible on the label when state is
 *                          "capturing-slow"; rendered by `<ShutterLabel>` (T015),
 *                          not by this component, but kept on the contract so
 *                          the outer panel can thread it through.
 *   - `onPress`          — fired on click (and implicitly on native Enter /
 *                          Space keyboard activation).
 *
 * Accessibility (§ 4c-4 + § 4 T014b):
 *   - `aria-label`       = "Capture screenshot" (idle / disabled) or
 *                          "Capturing screenshot" (capturing / capturing-slow).
 *   - `aria-busy="true"` while capturing.
 *   - `:focus-visible`   — amber-400 ring offset 2 px from amber-50, never
 *                          suppressed (`focus-visible:ring-*` + `focus:outline-none`
 *                          is the Tailwind idiom; the outline-none applies
 *                          only when `:focus-visible` is already swapping to
 *                          the ring).
 *   - Reduced motion     — `(prefers-reduced-motion: reduce)` suppresses the
 *                          `animate-shutter-press` class and the bloom overlay's
 *                          `animate-shutter-bloom` class; both collapse to
 *                          static opacity per § 4c-4.
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

/**
 * Read `prefers-reduced-motion: reduce`. The initial value is resolved lazily
 * from `matchMedia` (never re-runs on re-render) so the effect only wires the
 * change listener — no setState-in-effect lint violation. Safe during SSR:
 * `window` is guarded by `typeof`.
 */
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
    // Motion tokens: under reduced-motion, never flip the spring / bloom
    // classes. The click still fires onPress — behaviour is unchanged.
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
          // Base: 112 px circle, amber-500 hero, no native outline (we swap
          // to a focus-visible ring below).
          'relative flex h-28 w-28 items-center justify-center rounded-full',
          'bg-amber-500 text-white',
          'shadow-shutter ring-4 ring-amber-200',
          'transition-[transform,background-color,box-shadow] duration-150',
          'focus:outline-none',
          // Focus-visible amber ring offset from amber-50 panel background.
          'focus-visible:ring-4 focus-visible:ring-amber-400 focus-visible:ring-offset-2 focus-visible:ring-offset-amber-50',
          // Hover / active — disabled state overrides below.
          !isDisabled && 'hover:bg-amber-600 hover:ring-amber-300',
          !isDisabled && !reducedMotion && 'active:scale-[0.92]',
          isCapturing && 'cursor-progress',
          isDisabled && 'bg-amber-200 cursor-not-allowed !shadow-none !ring-0',
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
