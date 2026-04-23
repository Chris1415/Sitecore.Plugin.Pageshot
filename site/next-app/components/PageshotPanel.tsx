'use client';

/**
 * T019 + T024b + T029 — `<PageshotPanel>` top-level Shutterbug composition.
 *
 * T029 extension: the panel now supports multi-viewport capture. The editor
 * can enable Mobile, Desktop, or both via the <ViewportToggle>. On Capture:
 * PageShot fires one fetch per selected viewport (in parallel), and on
 * `ready` renders one polaroid per capture, stacked vertically, each with
 * its own Copy + Download pills. A single viewport produces a single polaroid
 * (the v1 UX unchanged).
 *
 * If any viewport fails → panel goes to `error` with the first failure's
 * envelope; partial successes are dropped. Retry re-runs the whole set.
 *
 * Source of truth for layout: POC v2 + § 4c-4. State machine: `use-panel-state`.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';

import {
  ANNOUNCEMENTS,
  LiveRegion,
  LiveRegionProvider,
  useAnnounce,
} from './LiveRegion';
import { ActionPill } from './ActionPill';
import { InlineMessage } from './InlineMessage';
import { PolaroidCard } from './PolaroidCard';
import { Shutter, type ShutterState } from './Shutter';
import { ShutterLabel } from './ShutterLabel';
import { useCopyImage } from './use-copy-image';
import { useDownloadImage } from './use-download-image';
import { useOpenImage } from './use-open-image';
import { useElapsedTime } from './use-elapsed';
import {
  usePanelState,
  type Capture,
  type PanelErrorCode,
} from './use-panel-state';
import { usePagesContext } from './providers/marketplace';
import {
  ViewportToggle,
  VIEWPORT_LABELS,
  type Viewport,
} from './ViewportToggle';
import { HeightToggle, type HeightPreset } from './HeightToggle';
import { trimBottomPadding } from '../lib/trim-image';

// -----------------------------------------------------------------------------
// Status-line copy (§ 4c-4 "Status line copy")
// -----------------------------------------------------------------------------

const STATUS_COPY = {
  idle: {
    title: 'Ready when you are.',
    hint: 'Shows the last saved version of this page.',
  },
  capturing: {
    title: 'Catching it\u2026',
    hint: 'Shows the last saved version of this page.',
  },
  ready: {
    title: 'Got it.',
    hint: 'Shows the last saved version of this page.',
  },
  error: {
    title: "Didn\u2019t quite catch that.",
    hint: "We couldn't reach the page this time.",
  },
} as const;

const EMPTY_PREVIEW_COPY = 'Tap Capture to catch this page.';

type ScreenshotEnvelope =
  | { ok: true; image: string }
  | {
      ok: false;
      error: { code: PanelErrorCode; message: string };
    };

export interface PageshotPanelProps {
  fetchImpl?: typeof fetch;
}

// -----------------------------------------------------------------------------
// Inner body — rendered inside the LiveRegionProvider so announcements work.
// -----------------------------------------------------------------------------

function PageshotPanelBody({ fetchImpl }: PageshotPanelProps) {
  const pages = usePagesContext();
  const [state, dispatch] = usePanelState();
  const announce = useAnnounce();

  const [viewports, setViewports] = useState<Viewport[]>(['desktop']);
  const [height, setHeight] = useState<HeightPreset>('large');

  // Focus refs. `firstCopyRef` receives the Copy pill from the FIRST capture
  // block after ready — mount it below via a callback so the CaptureBlock
  // stays ignorant of panel-level focus concerns.
  const shutterRef = useRef<HTMLButtonElement | null>(null);
  const firstCopyRef = useRef<HTMLButtonElement | null>(null);
  const retryRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLElement | null>(null);

  const mountAnnouncedRef = useRef<boolean>(false);
  const mountFocusedRef = useRef<boolean>(false);

  const hasValidContext = !!pages?.pageId;

  // ---- Mount announcement + auto-focus Shutter ---------------------------
  useEffect(() => {
    if (!hasValidContext) return;
    if (!mountAnnouncedRef.current) {
      mountAnnouncedRef.current = true;
      announce(ANNOUNCEMENTS.readyToCapture);
    }
    if (!mountFocusedRef.current) {
      mountFocusedRef.current = true;
      const id = setTimeout(() => {
        shutterRef.current?.focus();
      }, 0);
      return () => clearTimeout(id);
    }
    return undefined;
  }, [announce, hasValidContext]);

  // ---- Elapsed counter ---------------------------------------------------
  const capturingStartedAt =
    state.kind === 'capturing' ? state.startedAt : null;
  const elapsedSeconds = useElapsedTime(capturingStartedAt);

  const lastAnnouncedElapsedRef = useRef<number | null>(null);
  useEffect(() => {
    if (elapsedSeconds === null) {
      lastAnnouncedElapsedRef.current = null;
      return;
    }
    if (lastAnnouncedElapsedRef.current !== elapsedSeconds) {
      lastAnnouncedElapsedRef.current = elapsedSeconds;
      announce(ANNOUNCEMENTS.stillCapturing(elapsedSeconds));
    }
  }, [announce, elapsedSeconds]);

  // ---- Post-transition announcements + focus moves -----------------------
  const prevKindRef = useRef<typeof state.kind | null>(null);
  useEffect(() => {
    const prev = prevKindRef.current;
    prevKindRef.current = state.kind;
    if (prev === state.kind) return;

    if (state.kind === 'ready') {
      announce(ANNOUNCEMENTS.screenshotReady);
      const id = setTimeout(() => {
        firstCopyRef.current?.focus({ preventScroll: true });
      }, 0);
      return () => clearTimeout(id);
    }
    if (state.kind === 'error') {
      announce(ANNOUNCEMENTS.captureFailed(state.code));
      const id = setTimeout(() => {
        retryRef.current?.focus({ preventScroll: true });
      }, 0);
      return () => clearTimeout(id);
    }
    if (state.kind === 'capturing') {
      announce(ANNOUNCEMENTS.capturingStarted);
    }
    return undefined;
  }, [announce, state]);

  // ---- Escape handler ----------------------------------------------------
  useEffect(() => {
    const node = panelRef.current;
    if (!node) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        shutterRef.current?.focus();
      }
    };
    node.addEventListener('keydown', handler);
    return () => node.removeEventListener('keydown', handler);
  }, [hasValidContext]);

  // ---- Capture flow ------------------------------------------------------
  const issueCapture = useCallback(async () => {
    if (!pages?.pageId) return;
    const pageId = pages.pageId;
    const siteName = pages.siteName ?? '';
    const pageName = pages.pageName ?? '';
    const selected = viewports.length > 0 ? viewports : (['desktop'] as const);

    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      dispatch({ type: 'capture', startedAt: Date.now() });
      dispatch({
        type: 'failed',
        code: 'network',
        message: 'Check your connection, then try again.',
      });
      return;
    }

    dispatch({ type: 'capture', startedAt: Date.now() });

    const doFetch = fetchImpl ?? globalThis.fetch;

    try {
      const results = await Promise.all(
        selected.map(async (viewport) => {
          const response = await doFetch(
            `/api/screenshot/${encodeURIComponent(pageId)}?viewport=${viewport}&height=${height}`,
          );
          const body = (await response.json()) as ScreenshotEnvelope;
          return { viewport, body };
        }),
      );

      const firstFailure = results.find((r) => r.body.ok === false);
      if (firstFailure && firstFailure.body.ok === false) {
        dispatch({
          type: 'failed',
          code: firstFailure.body.error.code,
          message: firstFailure.body.error.message,
        });
        return;
      }

      const capturedAt = new Date();
      // Auto-trim trailing whitespace/background padding. The Agent API
      // returns an image of exactly the requested height, so shorter pages
      // come back with solid-color padding at the bottom. `trimBottomPadding`
      // detects that and crops it out. Failure modes (no canvas, no padding
      // detected, too-aggressive trim) return the original bytes unchanged.
      const trimmedBodies = await Promise.all(
        results.map(async (r) => {
          if (r.body.ok !== true) throw new Error('unreachable');
          const imageBase64 = await trimBottomPadding(r.body.image);
          return { viewport: r.viewport, imageBase64 };
        }),
      );
      const captures: Capture[] = trimmedBodies.map((r) => ({
        viewport: r.viewport,
        imageBase64: r.imageBase64,
        siteName,
        pageName,
        capturedAt,
      }));

      dispatch({ type: 'resolved', captures });
    } catch {
      dispatch({
        type: 'failed',
        code: 'network',
        message: 'Check your connection, then try again.',
      });
    }
  }, [dispatch, fetchImpl, height, pages, viewports]);

  const handleRetryPress = useCallback(() => {
    void issueCapture();
  }, [issueCapture]);

  const handleShutterPress = useCallback(() => {
    void issueCapture();
  }, [issueCapture]);

  // ---- Derived view props ------------------------------------------------
  const statusKey: keyof typeof STATUS_COPY =
    state.kind === 'capturing'
      ? 'capturing'
      : state.kind === 'ready'
        ? 'ready'
        : state.kind === 'error'
          ? 'error'
          : 'idle';

  const shutterState: ShutterState = (() => {
    if (state.kind === 'capturing') {
      return elapsedSeconds !== null ? 'capturing-slow' : 'capturing';
    }
    return 'idle';
  })();

  // ---- Loading state -----------------------------------------------------
  if (!hasValidContext) {
    return (
      <main
        ref={(el) => {
          panelRef.current = el;
        }}
        className="p-6"
      >
        <p className="text-sm text-muted-foreground">Loading page context&hellip;</p>
      </main>
    );
  }

  return (
    <main
      ref={(el) => {
        panelRef.current = el;
      }}
      aria-label="PageShot capture panel"
      className="flex min-h-full flex-col gap-5 bg-background p-5 font-sans text-foreground @container/panel"
    >
      <header className="flex items-center gap-2">
        <span
          data-testid="wordmark"
          className="flex items-center gap-2 text-sm font-semibold tracking-tight text-foreground"
        >
          PageShot
        </span>
      </header>

      <section
        data-testid="status-line"
        aria-label="Panel status"
        className="flex flex-col gap-1 text-foreground"
      >
        <p
          data-testid="status-title"
          className="text-[18px] font-semibold leading-[1.25]"
        >
          {STATUS_COPY[statusKey].title}
        </p>
        <p
          data-testid="status-hint"
          className="text-[13px] leading-[1.45] text-muted-foreground"
        >
          {STATUS_COPY[statusKey].hint}
        </p>
      </section>

      <ViewportToggle
        value={viewports}
        onChange={setViewports}
        disabled={state.kind === 'capturing'}
      />

      <HeightToggle
        value={height}
        onChange={setHeight}
        disabled={state.kind === 'capturing'}
      />

      <section
        data-testid="hero"
        className="flex flex-col items-center gap-2 py-2"
      >
        <ShutterWithButtonRef
          buttonRef={shutterRef}
          state={shutterState}
          elapsedSeconds={elapsedSeconds ?? undefined}
          onPress={handleShutterPress}
        />
        <ShutterLabel
          state={shutterState}
          elapsedSeconds={elapsedSeconds ?? undefined}
        />
      </section>

      {state.kind === 'idle' || state.kind === 'capturing' ? (
        <div
          data-testid="empty-preview"
          className="rounded-2xl border border-dashed border-border bg-muted/60 p-6 text-center text-sm text-muted-foreground"
        >
          {EMPTY_PREVIEW_COPY}
        </div>
      ) : null}

      {state.kind === 'ready' ? (
        <div data-testid="captures-stack" className="flex flex-col gap-5">
          {state.captures.map((capture, index) => (
            <CaptureBlock
              key={capture.viewport}
              capture={capture}
              copyRef={index === 0 ? firstCopyRef : undefined}
            />
          ))}
        </div>
      ) : null}

      {state.kind === 'error' ? (
        <>
          <PolaroidCard kind="error" code={state.code} />
          <div data-testid="action-bar" className="flex flex-row gap-2">
            <ActionPillWithButtonRef
              buttonRef={retryRef}
              variant="retry"
              state="idle"
              onPress={handleRetryPress}
            />
          </div>
        </>
      ) : null}

      <LiveRegion />
    </main>
  );
}

// ---------------------------------------------------------------------------
// Per-capture block — one polaroid + Copy + Download, scoped to a single
// viewport's image. Each block owns its own useCopyImage / useDownloadImage
// hook instance so the two viewports don't share clipboard / download state.
// ---------------------------------------------------------------------------

interface CaptureBlockProps {
  capture: Capture;
  copyRef?: React.MutableRefObject<HTMLButtonElement | null>;
}

function CaptureBlock({ capture, copyRef }: CaptureBlockProps) {
  const announce = useAnnounce();
  const [expanded, setExpanded] = useState<boolean>(false);
  const {
    available: clipboardAvailable,
    status: copyStatus,
    deniedMessage,
    copy: copyImage,
  } = useCopyImage(capture.imageBase64);

  const { download: downloadImage } = useDownloadImage({
    imageBase64: capture.imageBase64,
    siteName: capture.siteName,
    pageName: capture.pageName,
    capturedAt: capture.capturedAt,
  });

  const { open: openImage } = useOpenImage(capture.imageBase64);

  const prevCopyStatusRef = useRef<typeof copyStatus>(copyStatus);
  useEffect(() => {
    const prev = prevCopyStatusRef.current;
    prevCopyStatusRef.current = copyStatus;
    if (prev !== 'copied' && copyStatus === 'copied') {
      announce(ANNOUNCEMENTS.copiedToClipboard);
    }
  }, [announce, copyStatus]);

  const handleCopyPress = useCallback(() => {
    void copyImage();
  }, [copyImage]);

  const handleDownloadPress = useCallback(async () => {
    announce(ANNOUNCEMENTS.downloadStarted);
    await downloadImage();
  }, [announce, downloadImage]);

  const handleOpenPress = useCallback(() => {
    openImage();
  }, [openImage]);

  const copyPillState = (() => {
    if (copyStatus === 'copied') return 'success';
    if (copyStatus === 'denied') return 'denied';
    if (!clipboardAvailable) return 'disabled';
    return 'idle';
  })();

  const clipboardDenied =
    copyStatus === 'denied' || copyStatus === 'unsupported';

  return (
    <div
      data-testid={`capture-block-${capture.viewport}`}
      className="flex flex-col gap-3"
    >
      <div className="flex items-center justify-between px-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        <span>{VIEWPORT_LABELS[capture.viewport]}</span>
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          aria-pressed={expanded}
          aria-label={
            expanded
              ? `Collapse ${VIEWPORT_LABELS[capture.viewport]} preview`
              : `Expand ${VIEWPORT_LABELS[capture.viewport]} preview to full page`
          }
          data-testid={`expand-toggle-${capture.viewport}`}
          className={[
            'flex items-center gap-1 rounded-full px-2 py-0.5 font-medium normal-case tracking-normal transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background',
            expanded
              ? 'bg-primary text-inverse-text'
              : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
          ].join(' ')}
        >
          {expanded ? (
            <Minimize2 aria-hidden="true" className="h-3 w-3" />
          ) : (
            <Maximize2 aria-hidden="true" className="h-3 w-3" />
          )}
          <span>{expanded ? 'Collapse' : 'Expand'}</span>
        </button>
      </div>
      <PolaroidCard
        kind="ready"
        imageBase64={capture.imageBase64}
        siteName={capture.siteName}
        pageName={capture.pageName}
        capturedAt={capture.capturedAt}
        expanded={expanded}
      />
      <div
        data-testid={`action-bar-${capture.viewport}`}
        className="flex flex-row flex-wrap gap-2"
      >
        <ActionPillWithButtonRef
          buttonRef={copyRef}
          variant="copy"
          state={copyPillState}
          onPress={handleCopyPress}
        />
        <ActionPillWithButtonRef
          variant="download"
          state="idle"
          onPress={handleDownloadPress}
        />
        <ActionPillWithButtonRef
          variant="open"
          state="idle"
          onPress={handleOpenPress}
        />
      </div>
      <InlineMessage visible={clipboardDenied} tone="warn">
        {deniedMessage}
      </InlineMessage>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Ref-capturing wrappers (T024b).
// ---------------------------------------------------------------------------

interface ShutterWithButtonRefProps {
  buttonRef: React.MutableRefObject<HTMLButtonElement | null>;
  state: ShutterState;
  elapsedSeconds?: number;
  onPress: () => void;
}

function ShutterWithButtonRef(props: ShutterWithButtonRefProps) {
  const { buttonRef, state, elapsedSeconds, onPress } = props;
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    buttonRef.current = wrapRef.current?.querySelector('button') ?? null;
  });

  return (
    <div
      ref={(el) => {
        wrapRef.current = el;
      }}
    >
      <Shutter state={state} elapsedSeconds={elapsedSeconds} onPress={onPress} />
    </div>
  );
}

interface ActionPillWithButtonRefProps {
  buttonRef?: React.MutableRefObject<HTMLButtonElement | null>;
  variant: 'copy' | 'download' | 'open' | 'retry';
  state: 'idle' | 'success' | 'disabled' | 'denied';
  onPress: () => void;
}

function ActionPillWithButtonRef(props: ActionPillWithButtonRefProps) {
  const { buttonRef, variant, state, onPress } = props;
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!buttonRef) return;
    buttonRef.current = wrapRef.current?.querySelector('button') ?? null;
  });

  return (
    <div
      ref={(el) => {
        wrapRef.current = el;
      }}
      className={variant === 'copy' ? 'flex-none' : 'flex-1'}
    >
      <ActionPill variant={variant} state={state} onPress={onPress} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Public export.
// ---------------------------------------------------------------------------

export function PageshotPanel(props: PageshotPanelProps = {}) {
  return (
    <LiveRegionProvider>
      <PageshotPanelBody {...props} />
    </LiveRegionProvider>
  );
}

export type { ScreenshotEnvelope };
