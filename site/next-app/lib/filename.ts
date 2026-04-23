/**
 * T021b — `buildScreenshotFilename` helper.
 *
 * Source of truth: § 4c-4 "Filename helper contract" / PRD FR-09 + AC-3.2 +
 * AC-3.3 + AC-3.4.
 *
 * Signature:
 *   buildScreenshotFilename(siteName, pageName, capturedAt) → string
 *
 * Steps (verbatim from § 4c-4):
 *   1. toLowerCase() both slugs.
 *   2. Replace every run of non-[a-z0-9_-] bytes with a single `-`.
 *   3. Trim leading/trailing `-`.
 *   4. Assemble `${siteSlug}_${pageSlug}_${YYYYMMDD}-${HHmm}.png` using
 *      LOCAL time (the user's machine, per AC-3.4 — never UTC).
 *   5. If total length > 100, proportionally truncate siteSlug + pageSlug
 *      (each preserving ≥ 1 char) so the final string is ≤ 100 chars and
 *      the `.png` extension + timestamp segment are NEVER dropped.
 *
 * Collision handling at minute granularity is out of scope — two calls
 * within the same wall-clock minute with the same slugs return the same
 * filename (documented in T021a-TEST-6).
 */

/** Two-digit zero-padded integer for date formatting. */
function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

/** Apply § 4c-4 steps 1–3 to a single slug (site or page). */
function slugify(input: string, fallback: string): string {
  const lower = input.toLowerCase();
  // Replace any run of chars that are NOT in [a-z0-9_-] with a single `-`.
  const replaced = lower.replace(/[^a-z0-9_-]+/g, '-');
  // Collapse any remaining runs of `-` into a single `-` (step 3 defensive).
  const collapsed = replaced.replace(/-{2,}/g, '-');
  // Trim leading/trailing `-`.
  const trimmed = collapsed.replace(/^-+|-+$/g, '');
  // Fallback: if the slug is now empty OR contains only dashes (e.g. input
  // was all emoji / all punctuation), use a meaningful placeholder so the
  // filename reads cleanly (Mn2 fix — previous behavior produced
  // `acme_-_20260423-0830.png` for non-alphanumeric pageName).
  if (!trimmed || /^-+$/.test(trimmed)) return fallback;
  return trimmed;
}

/** Format a local `Date` as `YYYYMMDD-HHmm` per AC-3.4. */
function formatLocalTimestamp(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = pad2(d.getMonth() + 1);
  const dd = pad2(d.getDate());
  const hh = pad2(d.getHours());
  const mi = pad2(d.getMinutes());
  return `${yyyy}${mm}${dd}-${hh}${mi}`;
}

const MAX_FILENAME_LENGTH = 100;

export function buildScreenshotFilename(
  siteName: string,
  pageName: string,
  capturedAt: Date,
): string {
  const timestamp = formatLocalTimestamp(capturedAt);

  let siteSlug = slugify(siteName, 'site');
  let pageSlug = slugify(pageName, 'page');

  // Start with the naive assembly.
  let candidate = `${siteSlug}_${pageSlug}_${timestamp}.png`;
  if (candidate.length <= MAX_FILENAME_LENGTH) {
    return candidate;
  }

  // Step 5 — proportional truncation. Fixed overhead is the separators
  // (`_`, `_`, `.png`) + the timestamp segment. Everything that remains is
  // the "slug budget" we split proportionally between site + page.
  const fixedOverhead = 2 /* two underscores */ + timestamp.length + 4 /* ".png" */;
  const slugBudget = MAX_FILENAME_LENGTH - fixedOverhead;

  if (slugBudget < 2) {
    // Pathological: only enough room for a 1-char placeholder per slug.
    siteSlug = siteSlug.charAt(0) || '-';
    pageSlug = pageSlug.charAt(0) || '-';
    candidate = `${siteSlug}_${pageSlug}_${timestamp}.png`;
    return candidate;
  }

  const originalTotal = siteSlug.length + pageSlug.length;
  // Proportional split — each slug gets at least 1 char.
  const siteShare = Math.max(
    1,
    Math.floor((siteSlug.length / originalTotal) * slugBudget),
  );
  const pageShare = Math.max(1, slugBudget - siteShare);

  siteSlug = siteSlug.slice(0, siteShare);
  pageSlug = pageSlug.slice(0, pageShare);

  // Re-trim trailing `-` that the slice might have produced.
  siteSlug = siteSlug.replace(/-+$/g, '') || siteSlug.charAt(0) || 's';
  pageSlug = pageSlug.replace(/-+$/g, '') || pageSlug.charAt(0) || 'p';

  candidate = `${siteSlug}_${pageSlug}_${timestamp}.png`;
  return candidate;
}
