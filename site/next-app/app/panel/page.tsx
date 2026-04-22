"use client";

/**
 * T008 — Page Context Panel route (`/panel`).
 *
 * Scope: non-code scaffolding per task breakdown § 4 T008 and § 9 — this file
 * composes the already-wired MarketplaceProvider (`app/layout.tsx`) with a
 * placeholder body that proves the `pages.context` subscription is flowing
 * end-to-end. The real Shutterbug UI lands in E4 (T013b+), which swaps the
 * placeholder for `<PageshotPanel />`.
 *
 * Context resolution:
 *   - `MarketplaceProvider` is wrapped at the root layout (app/layout.tsx),
 *     so every route — including `/panel` — already has the client,
 *     appContext, and pages.context in scope.
 *   - `usePagesContext()` returns `null` until the SDK delivers the first
 *     `onSuccess` event. During that gap we render the "Loading page
 *     context…" line (T008 spec — minimal gap copy; v1 does not design a
 *     no-context skeleton per UI spec).
 *
 * Constraints honoured:
 *   - `'use client'` — the Marketplace SDK uses `window.parent` / postMessage
 *     and cannot run during SSR (`client.md § 8d`).
 *   - No Node runtime APIs; no env-var reads. The panel never touches
 *     `SITECORE_DEPLOY_CLIENT_*` — those are server-only (§ 4c-1).
 */

import {
  useMarketplaceClient,
  usePagesContext,
} from "@/components/providers/marketplace";

function PlaceholderPanel() {
  // `useMarketplaceClient()` throws outside the Provider — its presence proves
  // the Provider is actually in the tree and the SDK handshake resolved
  // before this component renders (per `MarketplaceProvider`'s gate on
  // `!client` / `!appContext`). We do not yet call anything on it; E3 owns
  // the screenshot fetch and E4 owns the UI wiring.
  useMarketplaceClient();
  const pages = usePagesContext();

  if (!pages) {
    return (
      <main className="p-6">
        <p className="text-sm text-stone-600">Loading page context…</p>
      </main>
    );
  }

  return (
    <main className="p-6 space-y-4">
      <header className="space-y-1">
        <h1 className="text-lg font-semibold">PageShot panel</h1>
        <p className="text-xs text-stone-500">
          E2 placeholder — E4 replaces this with the Shutterbug UI.
        </p>
      </header>
      <section
        aria-label="Live pages.context values"
        className="rounded-md border border-stone-200 bg-white/60 p-4 text-sm"
      >
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 font-mono text-xs">
          <dt className="text-stone-500">pageId</dt>
          <dd className="text-stone-900">{pages.pageId ?? "(none)"}</dd>
          <dt className="text-stone-500">siteName</dt>
          <dd className="text-stone-900">{pages.siteName ?? "(none)"}</dd>
          <dt className="text-stone-500">pageName</dt>
          <dd className="text-stone-900">{pages.pageName ?? "(none)"}</dd>
        </dl>
      </section>
    </main>
  );
}

export default function PanelPage() {
  return <PlaceholderPanel />;
}
