'use client';

/**
 * T018b — `<ActionPill>` Copy / Download / Retry pill.
 *
 * Visual source of truth: `products/pageshot/pocs/poc-v2/index.html`
 * `.action-pill` block. Copy + state timings come from § 4c-4.
 *
 * Props (per § 4 T018b):
 *   - `variant`   — "copy" | "download" | "retry". Drives the icon + default
 *                   label + the success auto-revert window (Copy = 1.8 s,
 *                   Download = 1.4 s).
 *   - `state`     — "idle" | "success" | "disabled" | "denied". Default "idle".
 *   - `onPress`   — fired on click (and native Enter / Space keyboard
 *                   activation on the underlying <button>).
 *
 * Behaviour (§ 4c-4):
 *   - Base:          `h-10 rounded-full border border-stone-300 bg-white px-4
 *                     text-sm font-medium text-stone-900`.
 *   - Hover:         `bg-amber-50 border-amber-300`.
 *   - Focus-visible: `ring-2 ring-amber-400 ring-offset-2
 *                     ring-offset-amber-50`.
 *   - Pressed:       `bg-amber-100`.
 *   - Success:       `bg-amber-50 border-amber-300 text-amber-700` + Check
 *                    icon prepended. Label morphs to "Copied" / "Saved"; after
 *                    1.8 s / 1.4 s the pill reverts to idle (internal timer;
 *                    parent can re-drive the success prop at any time).
 *   - Disabled:      `opacity-50 cursor-not-allowed`.
 *   - Denied         (Copy only — applied by T020b): `animate-shake` keyframe
 *                    once, then lock to disabled.
 *   - Retry variant: `border-amber-400 text-amber-700` default (replaces
 *                    Download in error state).
 */

import { Check, Copy, Download, RefreshCw } from 'lucide-react';
import { useEffect, useRef, useState, type ComponentType } from 'react';

import { cn } from '@/lib/utils';

export type ActionPillVariant = 'copy' | 'download' | 'retry';
export type ActionPillState = 'idle' | 'success' | 'disabled' | 'denied';

export interface ActionPillProps {
  variant: ActionPillVariant;
  state?: ActionPillState;
  onPress: () => void;
}

/** Per-variant default labels, success labels, icons, and success windows. */
interface VariantConfig {
  idleLabel: string;
  successLabel: string;
  successRevertMs: number;
  IconIdle: ComponentType<{ className?: string; strokeWidth?: number }>;
  iconTestId: string;
}

const VARIANTS: Record<ActionPillVariant, VariantConfig> = {
  copy: {
    idleLabel: 'Copy',
    successLabel: 'Copied',
    successRevertMs: 1800,
    IconIdle: Copy,
    iconTestId: 'action-pill-icon-copy',
  },
  download: {
    idleLabel: 'Download',
    successLabel: 'Saved',
    successRevertMs: 1400,
    IconIdle: Download,
    iconTestId: 'action-pill-icon-download',
  },
  retry: {
    idleLabel: 'Retry',
    // Retry does not have a success window in v1 — a successful retry
    // transitions the parent panel to `capturing` then `ready`, at which point
    // the Retry pill is replaced by Copy + Download. Define a zero window so
    // the effect is a no-op if a caller ever flips `state="success"` here.
    successLabel: 'Retry',
    successRevertMs: 0,
    IconIdle: RefreshCw,
    iconTestId: 'action-pill-icon-refresh-cw',
  },
};

export function ActionPill(props: ActionPillProps) {
  const { variant, state = 'idle', onPress } = props;
  const cfg = VARIANTS[variant];

  // Internal success latch: when the parent flips `state="success"`, we show
  // the success label for the variant's window, then revert to the idle label
  // even if the parent keeps `state="success"` (the parent may not re-render
  // before the window elapses; this matches the POC behaviour).
  const [successActive, setSuccessActive] = useState<boolean>(false);
  const revertTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (state === 'success' && cfg.successRevertMs > 0) {
      setSuccessActive(true);
      if (revertTimerRef.current) clearTimeout(revertTimerRef.current);
      revertTimerRef.current = setTimeout(() => {
        setSuccessActive(false);
      }, cfg.successRevertMs);
    } else if (state !== 'success') {
      setSuccessActive(false);
      if (revertTimerRef.current) {
        clearTimeout(revertTimerRef.current);
        revertTimerRef.current = null;
      }
    }
    return () => {
      if (revertTimerRef.current) {
        clearTimeout(revertTimerRef.current);
        revertTimerRef.current = null;
      }
    };
  }, [state, cfg.successRevertMs]);

  const showingSuccess = state === 'success' && successActive;
  const isDisabled = state === 'disabled' || state === 'denied';
  const label = showingSuccess ? cfg.successLabel : cfg.idleLabel;

  const IconComponent = showingSuccess ? Check : cfg.IconIdle;
  const iconTestId = showingSuccess ? 'action-pill-icon-check' : cfg.iconTestId;

  return (
    <button
      type="button"
      onClick={() => {
        if (isDisabled) return;
        onPress();
      }}
      disabled={isDisabled}
      aria-disabled={isDisabled ? 'true' : undefined}
      data-variant={variant}
      data-state={state}
      className={cn(
        // Base pill.
        'inline-flex h-10 items-center justify-center gap-2 rounded-full border px-4',
        'text-sm font-medium',
        // Focus-visible amber ring offset from amber-50.
        'focus:outline-none',
        'focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 focus-visible:ring-offset-amber-50',
        // Default border + surface per variant (retry gets the amber accent).
        variant === 'retry'
          ? 'border-amber-400 bg-white text-amber-700'
          : 'border-stone-300 bg-white text-stone-900',
        // Hover + pressed — only when not disabled.
        !isDisabled && 'hover:bg-amber-50 hover:border-amber-300 active:bg-amber-100',
        // Success visual override: amber-50 surface + amber-700 text + amber
        // border.
        showingSuccess && 'border-amber-300 bg-amber-50 text-amber-700',
        // Disabled: flat opacity + cursor.
        isDisabled && 'opacity-50 cursor-not-allowed',
        // Denied: one-shot shake keyframe then lock to disabled (applied
        // alongside the disabled styling when state==='denied').
        state === 'denied' && 'animate-shake',
        // Flex sizing hints baked into variant — Copy is `flex-none min-w-24`,
        // Download/Retry are `flex-1` per § 4c-4. These are layout hints the
        // parent `<div class="flex">` inherits; pills can also be rendered
        // standalone without these taking effect.
        variant === 'copy' && 'min-w-24 flex-none',
        (variant === 'download' || variant === 'retry') && 'flex-1',
      )}
    >
      <span
        data-testid={iconTestId}
        className="flex h-[15px] w-[15px] items-center justify-center"
        aria-hidden="true"
      >
        <IconComponent className="h-[15px] w-[15px]" strokeWidth={2} />
      </span>
      <span>{label}</span>
    </button>
  );
}
