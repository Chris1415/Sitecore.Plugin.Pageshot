/**
 * Client-side whitespace / padding auto-trim.
 *
 * Why this exists (T029 dogfood): the Agent API's `/screenshot` endpoint has
 * no `fullPage=true` toggle. `height` is the exact output-image height —
 * shorter pages get padded at the bottom with the site's background color.
 * Picking a "big enough" height preset (Large/Full) reliably captures the
 * whole page but produces a long strip of padding below the real content.
 *
 * This module strips that trailing padding. It:
 *
 *   1. Loads the PNG into an `HTMLImageElement`.
 *   2. Samples the bottom-left + bottom-right pixels. If they don't match
 *      (within tolerance), there's no obvious single-color padding — return
 *      the original image untouched.
 *   3. Scans rows bottom → top, sampling ~20 points across each row. The
 *      first row that contains a pixel differing from the padding color by
 *      more than `tolerance` is the last content row.
 *   4. If a trim is found and it's substantive (> 2% of height, and the
 *      trimmed height is still ≥ 100 px), crops the canvas and re-encodes
 *      as PNG.
 *
 * Safety guards keep this from accidentally over-trimming a page with a
 * genuinely solid-color bottom section (e.g. a footer with a CTA on a
 * uniform background). The 2% threshold means small trims are skipped; the
 * 100 px floor prevents the function from ever returning a tiny sliver.
 *
 * When the browser has no canvas context (SSR / test env), the function
 * returns the original base64 unchanged — never throws.
 */

type RGB = readonly [number, number, number];

function getPixel(
  data: Uint8ClampedArray,
  width: number,
  x: number,
  y: number,
): RGB {
  const idx = (y * width + x) * 4;
  return [data[idx]!, data[idx + 1]!, data[idx + 2]!];
}

function pixelsClose(a: RGB, b: RGB, tol: number): boolean {
  return (
    Math.abs(a[0] - b[0]) <= tol &&
    Math.abs(a[1] - b[1]) <= tol &&
    Math.abs(a[2] - b[2]) <= tol
  );
}

async function loadImage(
  src: string,
  timeoutMs = 5000,
): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const timer = setTimeout(() => {
      reject(new Error('image load timeout'));
    }, timeoutMs);
    img.onload = () => {
      clearTimeout(timer);
      resolve(img);
    };
    img.onerror = () => {
      clearTimeout(timer);
      reject(new Error('image load failed'));
    };
    img.src = src;
  });
}

/**
 * Probe for a working 2D canvas context. jsdom (used by Vitest) creates
 * `<canvas>` elements but `getContext('2d')` returns `null` unless the
 * `canvas` npm package is installed. Returning null here lets callers
 * short-circuit the trim cleanly in tests without hanging on image loads.
 */
function canvas2dSupported(): boolean {
  try {
    return document.createElement('canvas').getContext('2d') !== null;
  } catch {
    return false;
  }
}

export interface TrimOptions {
  /** Per-channel RGB delta considered "same color". Default 8. */
  colorTolerance?: number;
  /** Row-sampling step — smaller = more precise but slower. Default 20 samples per row. */
  samplesPerRow?: number;
  /** Skip the trim if it would remove less than this fraction of height. Default 0.02. */
  minFractionToTrim?: number;
  /** Never trim below this pixel height. Default 100. */
  minResultHeight?: number;
}

/**
 * Returns a PNG base64 (no data-URL prefix) with trailing padding removed.
 * On any failure — unloadable image, no canvas context, no detectable
 * padding, trim too small, result too short — returns the input unchanged.
 */
export async function trimBottomPadding(
  base64Png: string,
  opts: TrimOptions = {},
): Promise<string> {
  if (typeof document === 'undefined') return base64Png;
  if (!canvas2dSupported()) return base64Png;

  const {
    colorTolerance = 8,
    samplesPerRow = 20,
    minFractionToTrim = 0.02,
    minResultHeight = 100,
  } = opts;

  let img: HTMLImageElement;
  try {
    img = await loadImage(`data:image/png;base64,${base64Png}`);
  } catch {
    return base64Png;
  }

  const width = img.naturalWidth;
  const height = img.naturalHeight;
  if (width < 2 || height < minResultHeight) return base64Png;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return base64Png;
  ctx.drawImage(img, 0, 0);

  let imageData: ImageData;
  try {
    imageData = ctx.getImageData(0, 0, width, height);
  } catch {
    // Tainted canvas (cross-origin content, etc.) — cannot read pixels.
    return base64Png;
  }
  const data = imageData.data;

  const bottomLeft = getPixel(data, width, 0, height - 1);
  const bottomRight = getPixel(data, width, width - 1, height - 1);
  if (!pixelsClose(bottomLeft, bottomRight, colorTolerance)) {
    return base64Png;
  }
  const paddingColor: RGB = bottomLeft;

  const step = Math.max(1, Math.floor(width / samplesPerRow));

  let lastContentRow = -1;
  for (let y = height - 1; y >= minResultHeight - 1; y--) {
    let rowHasContent = false;
    for (let x = 0; x < width; x += step) {
      const p = getPixel(data, width, x, y);
      if (!pixelsClose(p, paddingColor, colorTolerance)) {
        rowHasContent = true;
        break;
      }
    }
    if (rowHasContent) {
      lastContentRow = y;
      break;
    }
  }

  if (lastContentRow < 0) return base64Png;

  const trimmedHeight = lastContentRow + 1;
  if (trimmedHeight < minResultHeight) return base64Png;
  if (trimmedHeight >= Math.floor(height * (1 - minFractionToTrim))) {
    return base64Png;
  }

  const out = document.createElement('canvas');
  out.width = width;
  out.height = trimmedHeight;
  const outCtx = out.getContext('2d');
  if (!outCtx) return base64Png;
  outCtx.drawImage(canvas, 0, 0);

  const dataUrl = out.toDataURL('image/png');
  const prefix = 'data:image/png;base64,';
  return dataUrl.startsWith(prefix) ? dataUrl.slice(prefix.length) : base64Png;
}
