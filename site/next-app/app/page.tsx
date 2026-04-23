import Link from "next/link";

/**
 * PageShot landing route — the Marketplace custom-app surface is at `/panel`.
 * This page exists only so a bare navigation to the app root (e.g. during a
 * deploy smoke test) shows a short pointer instead of a 404.
 *
 * The Next scaffold shipped a Marketplace SDK demo tree here (Application
 * Context + ListLanguagesFromClientSdk with XMC). PageShot does not use that
 * demo — it was removed to (a) avoid shipping demo `console.log`s into
 * production, (b) shrink the panel bundle by dropping Collapsible + Badge +
 * XMC query plumbing the panel itself does not need.
 */
export default function PageshotIndex() {
  return (
    <main className="mx-auto max-w-xl p-8 text-sm leading-relaxed">
      <h1 className="text-lg font-semibold tracking-tight">PageShot</h1>
      <p className="mt-2 text-muted-foreground">
        The capture panel lives at{" "}
        <Link href="/panel" className="underline underline-offset-2">
          /panel
        </Link>
        . It is designed to be embedded inside a Sitecore Pages Marketplace
        iframe, so this root URL is rarely visited directly.
      </p>
    </main>
  );
}
