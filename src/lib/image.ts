/** Asking each image source for the size the page actually draws.
 *
 * Nothing on the storefront used to do this. `next/image` given a remote URL
 * and `fill` emits a bare `<img src>` with no `srcSet` at all -- that is what
 * vinext's shim does -- so every phone downloaded whatever width happened to
 * be baked into the database row: a 553 KB PNG behind a 170 px tile, a 412 KB
 * hero behind a 176 px slot. The `/_next/image` optimizer cannot rescue
 * either, because it only accepts same-origin *static* paths (a remote URL is
 * a 400, an `/api/media/` path a 404).
 *
 * So the resizing is asked of the source itself. Both sources the shop uses
 * can do it:
 *
 *  - `/api/media/...` -- our own R2 route, which resizes through the
 *    Cloudflare Images binding when it is given `?w=`.
 *  - `images.unsplash.com` -- an imgix CDN that resizes on `w`/`q`.
 *
 * Anything else (local files under `/`, data URIs, another host) is returned
 * untouched and left to `next/image`, which handles local files properly. */

/** Widths a source may be asked for.
 *
 * Kept short on purpose: every distinct width is a separate transform and a
 * separate cache entry, and the media route only honours widths on this list
 * so a crawler cannot walk `?w=1`..`?w=4000` and bill us for four thousand
 * transforms. The steps follow the real layouts -- category chips (64),
 * cart and wishlist rows (128), the two-column product grid (200/320),
 * gallery and hero (480-1440). */
export const IMAGE_WIDTHS = [64, 128, 200, 320, 480, 640, 828, 1080, 1440] as const;

export const MAX_IMAGE_WIDTH = IMAGE_WIDTHS[IMAGE_WIDTHS.length - 1];

/** Whether `width` is one this project is willing to generate. */
export function isAllowedWidth(width: number): boolean {
  return (IMAGE_WIDTHS as readonly number[]).includes(width);
}

/** The smallest allowed width that still covers `target`. */
function snapUp(target: number): number {
  return IMAGE_WIDTHS.find((candidate) => candidate >= target) ?? MAX_IMAGE_WIDTH;
}

function isUploadedMedia(url: string): boolean {
  return url.startsWith("/api/media/");
}

function isUnsplash(url: string): boolean {
  return url.startsWith("https://images.unsplash.com/");
}

/** True when this URL's source can resize, and is therefore worth a srcSet. */
export function isResizable(url: string): boolean {
  if (!url) return false;
  // An SVG has no pixel size to ask for and the Images binding will not
  // rasterise one here; serving it whole is already the right answer.
  if (url.split("?")[0].toLowerCase().endsWith(".svg")) return false;
  return isUploadedMedia(url) || isUnsplash(url);
}

/** The same image, asked for at `width` pixels across. */
export function resizedSrc(url: string, width: number): string {
  const snapped = snapUp(width);

  if (isUploadedMedia(url)) {
    return `${url}${url.includes("?") ? "&" : "?"}w=${snapped}`;
  }

  if (isUnsplash(url)) {
    // The stored URL already carries `w`, `q` and usually `fit=crop`. Only the
    // size and quality are rewritten, so a crop chosen for the photograph is
    // kept.
    const parsed = new URL(url);
    parsed.searchParams.set("auto", "format");
    parsed.searchParams.set("w", String(snapped));
    parsed.searchParams.set("q", "70");
    return parsed.toString();
  }

  return url;
}

/** A `srcSet` covering every width up to twice the largest the layout draws.
 *
 * Twice, because `sizes` is given in CSS pixels and a phone draws two or three
 * device pixels for each of them. Returns `undefined` for a source that cannot
 * resize, which is the signal to fall back to `next/image`. */
export function resizedSrcSet(url: string, maxDisplayWidth: number): string | undefined {
  if (!isResizable(url)) return undefined;

  const ceiling = snapUp(maxDisplayWidth * 2);
  const widths = IMAGE_WIDTHS.filter((width) => width <= ceiling);

  return widths.map((width) => `${resizedSrc(url, width)} ${width}w`).join(", ");
}
