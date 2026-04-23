'use client';

/**
 * T018b — `<ActionPill>` Copy / Download / Retry pill — Blok redesign pass.
 *
 * Replaces the Shutterbug amber-tinted custom pill with the Blok `<Button>`
 * primitive (shadcn/radix-nova). All functional behaviour (success auto-revert
 * timers, disabled semantics, keyboard activation, data-testid icon swaps,
 * denied shake one-shot) is preserved — only the visual surface changes.
 *
 * Visual mapping (Blok → Shutterbug replacement):
 *   - idle           → Button variant="outline"  colorScheme="neutral"
 *   - hover/pressed  → inherited from Blok outline+neutral (neutral-bg, neutral-bg-active)
 *   - focus-visible  → Blok `focus-visible:ring-primary` (from base Button)
 *   - success        → Button variant="outline" colorScheme="success" + Check icon
 *   - disabled       → Button disabled attribute (Blok flattens opacity)
 *   - denied         → still applies `animate-shake` keyframe (kept in globals.css)
 *   - retry          → Button variant="default" colorScheme="primary"
 *
 * Shape kept identical to § 4c-4: `h-10 rounded-full`, `flex-none min-w-24`
 * for copy / `flex-1` for download+retry, consistent icon + label spacing.
 *
 * Props, exports, and data-testid values are unchanged — the component's
 * public API is stable across the redesign.
 */

import { Check, Copy, Download, RefreshCw } from 'lucide-react';
import { useEffect, useRef, useState, type ComponentType } from 'react';

import { Button } from '@/components/ui/button';
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
    // Retry does not have a success window in v1 — a successful retry
    // transitions the parent panel to `capturing` then `ready`, at which point
    // the Retry pill is replaced by Copy + Download. Define a zero window so
    // the effect is a no-op if a caller ever flips `state="success"` here.
    idleLabel: 'Retry',
    successLabel: 'Retry',
    successRevertMs: 0,
    IconIdle: RefreshCw,
    iconTestId: 'action-pill-icon-refresh-cw',
  },
};

export function ActionPill(props: ActionPillProps) {
  const { variant, state = 'idle', onPress } = props;
  const cfg = VARIANTS[variant];

  // Internal success-revert latch. When the parent flips `state="success"`,
  // the pill shows the success label for the variant's window, then reverts
  // to the idle label even if the parent keeps `state="success"`.
  const [reverted, setReverted] = useState<boolean>(false);
  const revertTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (state === 'success' && cfg.successRevertMs > 0) {
      if (revertTimerRef.current) clearTimeout(revertTimerRef.current);
      revertTimerRef.current = setTimeout(() => {
        setReverted(true);
        revertTimerRef.current = null;
      }, cfg.successRevertMs);
      return () => {
        if (revertTimerRef.current) {
          clearTimeout(revertTimerRef.current);
          revertTimerRef.current = null;
        }
      };
    }
    if (revertTimerRef.current) {
      clearTimeout(revertTimerRef.current);
      revertTimerRef.current = null;
    }
    return undefined;
  }, [state, cfg.successRevertMs]);

  // Reset the `reverted` latch when the parent exits `success`.
  useEffect(() => {
    if (state !== 'success' && reverted) {
      const id = setTimeout(() => setReverted(false), 0);
      return () => clearTimeout(id);
    }
    return undefined;
  }, [state, reverted]);

  const showingSuccess = state === 'success' && !reverted;
  const isDisabled = state === 'disabled' || state === 'denied';
  const label = showingSuccess ? cfg.successLabel : cfg.idleLabel;

  const IconComponent = showingSuccess ? Check : cfg.IconIdle;
  const iconTestId = showingSuccess ? 'action-pill-icon-check' : cfg.iconTestId;

  // Blok variant + colorScheme mapping.
  // Retry is the hero error-recovery CTA → default+primary.
  // Copy/Download are secondary actions → outline+neutral, flipping to
  // outline+success on the success flash.
  const bokVariant = variant === 'retry' ? 'default' : 'outline';
  const bokColorScheme = (() => {
    if (variant === 'retry') return 'primary';
    if (showingSuccess) return 'success';
    return 'neutral';
  })();

  return (
    <Button
      type="button"
      variant={bokVariant}
      colorScheme={bokColorScheme}
      onClick={() => {
        if (isDisabled) return;
        onPress();
      }}
      disabled={isDisabled}
      aria-disabled={isDisabled ? 'true' : undefined}
      data-variant={variant}
      data-state={state}
      className={cn(
        // Blok `Button` defaults to a taller size; § 4c-4 calls for h-10
        // pill-shape. Override here to match the historical ActionPill footprint
        // while keeping all Blok base utilities (focus ring, typography, svg).
        'h-10 rounded-full text-sm font-medium',
        // Flex sizing hints — Copy is `flex-none min-w-24`, Download/Retry
        // are `flex-1` per § 4c-4.
        variant === 'copy' && 'min-w-24 flex-none',
        (variant === 'download' || variant === 'retry') && 'flex-1',
        // Denied: one-shot shake keyframe then lock to disabled.
        state === 'denied' && 'animate-shake',
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
    </Button>
  );
}
