"use client";

/**
 * T025 — Page Context Panel route (`/panel`).
 *
 * Renders the real `<PageshotPanel>` composition under the layout's
 * `<MarketplaceProvider>`. This replaces the E2 placeholder that dumped
 * raw `pages.context` values.
 *
 * Resolution chain:
 *   - `app/layout.tsx` wraps every route in `<MarketplaceProvider>`, so
 *     `usePagesContext()` inside `<PageshotPanel>` resolves to the live SDK
 *     values (or null until the first `onSuccess` event).
 *   - `<PageshotPanel>` handles its own loading state ("Loading page
 *     context…") before pages.context arrives, then flips to the Shutterbug
 *     UI once a valid pageId is resolved.
 *
 * Client-only boundary: the Marketplace SDK uses `window.parent` +
 * postMessage and cannot run during SSR (`client.md § 8d`). `'use client'`
 * at the top of this file keeps the tree out of the server runtime.
 *
 * Server boundary (§ 4c-1): this page MUST NEVER read `SITECORE_DEPLOY_*`
 * env vars. All secret-bearing work happens in `app/api/screenshot/[pageId]/route.ts`;
 * this file only dispatches `fetch('/api/screenshot/<pageId>')` via the
 * panel, which the browser sends same-origin to the Next runtime.
 */

import { PageshotPanel } from "@/components/PageshotPanel";

export default function PanelPage() {
  return <PageshotPanel />;
}
