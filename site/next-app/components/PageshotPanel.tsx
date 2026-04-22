'use client';

/**
 * T019 + T024b — `<PageshotPanel>` top-level Shutterbug composition.
 *
 * T019 delivered the layout + state-machine + server-fetch + hook wiring.
 * T024b adds the keyboard + focus map (§ 4c-4 "Keyboard & focus map"):
 *
 *   - On panel mount with valid pages.context → shutter.focus() once.
 *   - On capturing → ready  → copyButton.focus({ preventScroll: true }).
 *   - On capturing → error  → retryButton.focus({ preventScroll: true }).
 *   - On Escape anywhere inside the panel (keydown) → shutter.focus().
 *   - Enter / Space activate the focused button via native <button> handling.
 *   - Tab order = DOM order (ensured by the layout — Shutter → Copy →
 *     Download in ready; Shutter → Retry in error).
 *
 * Layout source of truth: POC v2 (`products/pageshot/pocs/poc-v2/index.html`).
 * Copy source of truth:   § 4c-4 of the task breakdown.
 * State machine:          `usePanelState` (T013b).
 * Auxiliary hooks:        `useElapsedTime` (T016b), `useCopyImage` (T020b),
 *                         `useDownloadImage` (T021b).
 * Server route:           `app/api/screenshot/[pageId]/route.ts` (T011b).
 * Announcer:              `<LiveRegion>` + `useAnnounce` (T023b).
 *
 * Responsibilities delivered here (§ 4 T019 + T025):
 *   1. Read `usePagesContext()` → `{ pageId, siteName, pageName }`. When
 *      `pageId` is missing, render a small "waiting for page context" line.
 *      The Shutterbug UI only makes sense once a page is loaded.
 *   2. Compose header → status line → hero (Shutter + label) → empty preview
 *      OR Polaroid → action bar → inline message → sr-only LiveRegion.
 *      Top-to-bottom order matches POC v2; Tab order = DOM order per § 4c-4.
 *   3. Drive the state machine:
 *        Shutter click → dispatch({ type: 'capture', startedAt: Date.now() })
 *                     → fetch(`/api/screenshot/${pageId}`)
 *                     → on `{ ok: true }`  dispatch({ type: 'resolved', ... })
 *                     → on `{ ok: false }` dispatch({ type: 'failed', ... })
 *      AC-5.4 short-circuit: if `navigator.onLine === false`, dispatch
 *      `failed` with `{ code: 'network' }` without issuing fetch.
 *   4. Announcement catalogue (§ 4c-4 "Announcement catalogue"):
 *        - mount with valid pageId → `readyToCapture`
 *        - idle → capturing        → `capturingStarted`
 *        - capturing past 5 s      → `stillCapturing(n)` once per second
 *        - capturing → ready       → `screenshotReady`
 *        - capturing → error       → `captureFailed(code)`
 *        - copy success            → `copiedToClipboard`
 *        - download click          → `downloadStarted`
 *
 * § 4c-1 boundary: every browser-API call (fetch, clipboard, download anchor)
 * is guarded so SSR renders do not crash; secrets stay server-side — this
 * component never reads `SITECORE_DEPLOY_*`.
 */

import { useCallback, useEffect, useRef } from 'react';

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
import { useElapsedTime } from './use-elapsed';
import { usePanelState, type PanelErrorCode } from './use-panel-state';
import { usePagesContext } from './providers/marketplace';

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

// Server-route envelope shape (matches § 4c-6 exactly).
type ScreenshotEnvelope =
  | { ok: true; image: string }
  | {
      ok: false;
      error: { code: PanelErrorCode; message: string };
    };

// -----------------------------------------------------------------------------
// Public prop types — the panel only really needs pages.context, but we allow
// parents to inject a fetch override for tests that prefer not to touch
// globalThis.fetch.
// -----------------------------------------------------------------------------

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

  // ---- Refs for keyboard + focus map (T024b) ------------------------------
  // `shutterRef` / `copyRef` / `downloadRef` / `retryRef` point to the native
  // <button> elements rendered by the wrapper components. The wrappers
  // (ShutterWithRef / ActionPillWithRef, defined below) capture the inner
  // button via querySelector in a post-commit effect.
  const shutterRef = useRef<HTMLButtonElement | null>(null);
  const copyRef = useRef<HTMLButtonElement | null>(null);
  const downloadRef = useRef<HTMLButtonElement | null>(null);
  const retryRef = useRef<HTMLButtonElement | null>(null);
  // Panel root — hosts the Escape keydown handler so any focused inner
  // element returns focus to the Shutter without per-element wiring.
  const panelRef = useRef<HTMLElement | null>(null);

  // Track whether the mount announcement has already fired. The panel may
  // re-render many times before pages.context lands; `readyToCapture` should
  // fire exactly once when a valid pageId first appears.
  const mountAnnouncedRef = useRef<boolean>(false);
  const mountFocusedRef = useRef<boolean>(false);

  const hasValidContext = !!pages?.pageId;

  // ---- Mount announcement + auto-focus Shutter (T024b-TEST-1) -------------
  useEffect(() => {
    if (!hasValidContext) return;
    if (!mountAnnouncedRef.current) {
      mountAnnouncedRef.current = true;
      announce(ANNOUNCEMENTS.readyToCapture);
    }
    if (!mountFocusedRef.current) {
      mountFocusedRef.current = true;
      // Defer to a microtask so the Shutter's inner <button> ref is attached
      // by the ref-capturing wrapper before we call focus().
      const id = setTimeout(() => {
        shutterRef.current?.focus();
      }, 0);
      return () => clearTimeout(id);
    }
    return undefined;
  }, [announce, hasValidContext]);

  // ---- Elapsed counter (T016b + catalogue "stillCapturing(n)") ------------
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

  // ---- Post-transition announcements + focus moves (catalogue 2/4/7 +
  //      T024b-TEST-2/3) -------------------------------------------------
  const prevKindRef = useRef<typeof state.kind | null>(null);
  useEffect(() => {
    const prev = prevKindRef.current;
    prevKindRef.current = state.kind;
    if (prev === state.kind) return;

    if (state.kind === 'ready') {
      announce(ANNOUNCEMENTS.screenshotReady);
      // Focus Copy — the first actionable pill in ready state. Defer to a
      // microtask so React has committed the action-bar buttons and their
      // refs have been captured by ActionPillWithRef.
      const id = setTimeout(() => {
        copyRef.current?.focus({ preventScroll: true });
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

  // ---- Panel-level Escape handler (T024b-TEST-4) --------------------------
  // Any keydown bubbling up from inside <PageshotPanel> with key==='Escape'
  // refocuses the Shutter. This is panel-root wiring so no per-element
  // handlers are needed.
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

  // ---- Capture flow -------------------------------------------------------
  const issueCapture = useCallback(async () => {
    if (!pages?.pageId) return;
    const pageId = pages.pageId;
    const siteName = pages.siteName ?? '';
    const pageName = pages.pageName ?? '';

    // AC-5.4 client-side offline short-circuit.
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

    try {
      const doFetch = fetchImpl ?? globalThis.fetch;
      const response = await doFetch(
        `/api/screenshot/${encodeURIComponent(pageId)}`,
      );
      let body: ScreenshotEnvelope;
      try {
        body = (await response.json()) as ScreenshotEnvelope;
      } catch {
        dispatch({
          type: 'failed',
          code: 'unknown',
          message: 'Try again in a moment.',
        });
        return;
      }

      if (body.ok === true) {
        dispatch({
          type: 'resolved',
          image: body.image,
          siteName,
          pageName,
          capturedAt: new Date(),
        });
        return;
      }

      const err = body.error;
      dispatch({
        type: 'failed',
        code: err.code,
        message: err.message,
      });
    } catch {
      dispatch({
        type: 'failed',
        code: 'network',
        message: 'Check your connection, then try again.',
      });
    }
  }, [dispatch, fetchImpl, pages]);

  // ---- Copy action (T020b + catalogue "copiedToClipboard") ----------------
  const readyImage = state.kind === 'ready' ? state.imageBase64 : '';
  const {
    available: clipboardAvailable,
    status: copyStatus,
    deniedMessage,
    copy: copyImage,
  } = useCopyImage(readyImage);

  const prevCopyStatusRef = useRef<typeof copyStatus>(copyStatus);
  useEffect(() => {
    const prev = prevCopyStatusRef.current;
    prevCopyStatusRef.current = copyStatus;
    if (prev !== 'copied' && copyStatus === 'copied') {
      announce(ANNOUNCEMENTS.copiedToClipboard);
    }
  }, [announce, copyStatus]);

  // ---- Download action (T021b + catalogue "downloadStarted") --------------
  const downloadCapturedAt =
    state.kind === 'ready' ? state.capturedAt : new Date(0);
  const downloadSite = state.kind === 'ready' ? state.siteName : '';
  const downloadPage = state.kind === 'ready' ? state.pageName : '';
  const { download: downloadImage } = useDownloadImage({
    imageBase64: readyImage,
    siteName: downloadSite,
    pageName: downloadPage,
    capturedAt: downloadCapturedAt,
  });

  const handleDownloadPress = useCallback(async () => {
    if (state.kind !== 'ready') return;
    announce(ANNOUNCEMENTS.downloadStarted);
    await downloadImage();
  }, [announce, downloadImage, state.kind]);

  const handleCopyPress = useCallback(() => {
    if (state.kind !== 'ready') return;
    void copyImage();
  }, [copyImage, state.kind]);

  const handleRetryPress = useCallback(() => {
    void issueCapture();
  }, [issueCapture]);

  const handleShutterPress = useCallback(() => {
    void issueCapture();
  }, [issueCapture]);

  // ---- Derived view props -------------------------------------------------
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

  const copyPillState = (() => {
    if (state.kind !== 'ready') return 'disabled';
    if (copyStatus === 'copied') return 'success';
    if (copyStatus === 'denied') return 'denied';
    if (!clipboardAvailable) return 'disabled';
    return 'idle';
  })();

  const downloadPillState = state.kind === 'ready' ? 'idle' : 'disabled';

  // ---- Loading state when pages.context hasn't arrived yet ----------------
  if (!hasValidContext) {
    return (
      <main
        ref={(el) => {
          panelRef.current = el;
        }}
        className="p-6"
      >
        <p className="text-sm text-stone-600">Loading page context&hellip;</p>
      </main>
    );
  }

  const clipboardDenied =
    copyStatus === 'denied' || copyStatus === 'unsupported';

  return (
    <main
      ref={(el) => {
        panelRef.current = el;
      }}
      aria-label="PageShot capture panel"
      className="flex min-h-full flex-col gap-5 bg-amber-50 p-5 font-sans text-stone-900 @container/panel"
    >
      <header className="flex items-center gap-2">
        <span
          data-testid="wordmark"
          className="flex items-center gap-2 text-sm font-semibold tracking-tight"
        >
          PageShot
        </span>
      </header>

      <section
        data-testid="status-line"
        aria-label="Panel status"
        className="flex flex-col gap-1 text-stone-900"
      >
        <p
          data-testid="status-title"
          className="text-[18px] font-semibold leading-[1.25]"
        >
          {STATUS_COPY[statusKey].title}
        </p>
        <p
          data-testid="status-hint"
          className="text-[13px] leading-[1.45] text-stone-600"
        >
          {STATUS_COPY[statusKey].hint}
        </p>
      </section>

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
          className="rounded-2xl border border-dashed border-stone-300 bg-white/60 p-6 text-center text-sm text-stone-600"
        >
          {EMPTY_PREVIEW_COPY}
        </div>
      ) : null}

      {state.kind === 'ready' ? (
        <PolaroidCard
          kind="ready"
          imageBase64={state.imageBase64}
          siteName={state.siteName}
          pageName={state.pageName}
          capturedAt={state.capturedAt}
        />
      ) : null}

      {state.kind === 'error' ? (
        <PolaroidCard kind="error" code={state.code} />
      ) : null}

      <div
        data-testid="action-bar"
        className="flex flex-row gap-2 @xs/panel:flex-col"
      >
        {state.kind === 'error' ? (
          <ActionPillWithButtonRef
            buttonRef={retryRef}
            variant="retry"
            state="idle"
            onPress={handleRetryPress}
          />
        ) : (
          <>
            <ActionPillWithButtonRef
              buttonRef={copyRef}
              variant="copy"
              state={copyPillState}
              onPress={handleCopyPress}
            />
            <ActionPillWithButtonRef
              buttonRef={downloadRef}
              variant="download"
              state={downloadPillState}
              onPress={handleDownloadPress}
            />
          </>
        )}
      </div>

      <InlineMessage visible={clipboardDenied} tone="warn">
        {deniedMessage}
      </InlineMessage>

      <LiveRegion />
    </main>
  );
}

// ---------------------------------------------------------------------------
// Ref-capturing wrappers (T024b).
//
// The existing `<Shutter>` + `<ActionPill>` components do not accept a ref
// prop — extending their public signatures would ripple through five tests
// and tightly couple focus management to the leaf components. Instead, we
// wrap each with a thin component that renders the leaf inside a <div>,
// locates the leaf's inner <button> in a post-commit effect, and writes it
// into the parent's ref. The panel's focus-transition effects read from
// these refs.
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
    // Run on every render so state transitions that swap the inner DOM
    // (e.g. capturing → ready flips the icon) keep the button ref current.
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
  buttonRef: React.MutableRefObject<HTMLButtonElement | null>;
  variant: 'copy' | 'download' | 'retry';
  state: 'idle' | 'success' | 'disabled' | 'denied';
  onPress: () => void;
}

function ActionPillWithButtonRef(props: ActionPillWithButtonRefProps) {
  const { buttonRef, variant, state, onPress } = props;
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
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
// Public export — wraps the body in the LiveRegionProvider so child calls to
// `useAnnounce()` resolve to the same announcement bus.
// ---------------------------------------------------------------------------

export function PageshotPanel(props: PageshotPanelProps = {}) {
  return (
    <LiveRegionProvider>
      <PageshotPanelBody {...props} />
    </LiveRegionProvider>
  );
}

// Named re-export so integration tests can mock the server contract shape.
export type { ScreenshotEnvelope };
