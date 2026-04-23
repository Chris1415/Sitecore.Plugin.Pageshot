/**
 * `/api/download` — iframe-sandbox-safe download endpoint.
 *
 * The Sitecore Pages iframe sandbox doesn't include `allow-downloads`, so
 * client-side blob-URL downloads (`<a download>`, window.open on a blob)
 * are blocked inside the iframe context. This route exists to bounce
 * downloads through a server-side path that returns the PNG with
 * `Content-Disposition: attachment`, which some browsers honor as a file
 * save even when the iframe sandbox would otherwise block it.
 *
 * The expected client flow:
 *   1. The panel has already obtained a (trimmed) base64 PNG in React state.
 *   2. On Download click, the client builds a hidden <form method="POST"
 *      target="_blank"> with `image=<base64>` + `filename=<sanitized>` and
 *      calls `form.submit()`.
 *   3. The form submission opens in a new browsing context (target=_blank),
 *      POSTs to this route, and the browser receives a PNG response with
 *      attachment headers — triggering a file save.
 *
 * Why POST, not GET: a full-page base64 can be 1-5 MB, well past any
 * reasonable URL length. POST bodies have no practical size limit in the
 * App Router's Node runtime.
 *
 * Security notes:
 *   - No authentication needed: the client already holds the bytes. This
 *     route is a pass-through formatter, not a data source. Anyone POSTing
 *     base64 gets their own base64 back as a PNG — not a privileged op.
 *   - Filename sanitization: strip anything outside `[\w.-]` and cap at
 *     200 chars, preserving the `.png` extension where possible.
 *   - Cache-control: no-store, since each response is the user's own data.
 */

export const runtime = 'nodejs';

function sanitizeFilename(raw: string): string {
  const cleaned = raw.replace(/[^\w.\-]/g, '_').slice(0, 200);
  return cleaned || 'pageshot.png';
}

export async function POST(req: Request): Promise<Response> {
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return new Response('Invalid form body', { status: 400 });
  }

  const image = formData.get('image');
  const filename = formData.get('filename');
  if (typeof image !== 'string' || typeof filename !== 'string') {
    return new Response('Missing image or filename', { status: 400 });
  }

  // Decode base64 → bytes. Reject malformed payloads loudly.
  let bytes: Uint8Array;
  try {
    bytes = Uint8Array.from(Buffer.from(image, 'base64'));
    if (bytes.length === 0) throw new Error('empty');
  } catch {
    return new Response('Invalid base64', { status: 400 });
  }

  const safeFilename = sanitizeFilename(filename);

  return new Response(
    new Blob([bytes as unknown as BlobPart], { type: 'image/png' }),
    {
      status: 200,
      headers: {
        'content-type': 'image/png',
        'content-disposition': `attachment; filename="${safeFilename}"`,
        'cache-control': 'no-store, no-cache, must-revalidate',
      },
    },
  );
}
