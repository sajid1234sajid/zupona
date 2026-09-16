import NextImage from "next/image";
import type { CSSProperties, ImgHTMLAttributes } from "react";
import { IMAGE_WIDTHS, MAX_IMAGE_WIDTH, isResizable, resizedSrc } from "@/lib/image";

/** A drop-in for `next/image` that actually resizes the shop's pictures.
 *
 * Every call site here used to import `next/image` directly, and for the two
 * sources this shop draws from that did nothing at all: vinext's shim hands a
 * remote URL with `fill` straight to a bare `<img src>` with no `srcSet`, and
 * `/_next/image` refuses an `/api/media/` path outright. The result was a
 * phone pulling a 553 KB upload into a 170 px tile.
 *
 * So for a source that can resize -- our own media route, or Unsplash -- this
 * renders the `<img>` itself with a real `srcSet`, and lets `sizes` do its
 * job. For anything else (local files under `public/`, data URIs) it defers to
 * `next/image`, which handles those correctly already.
 *
 * The props are `next/image`'s, so swapping the import is the whole change at
 * a call site. `unoptimized` is accepted and ignored: it was only ever there
 * to stop the optimizer 404ing on an upload, and nothing is asked of the
 * optimizer here. */

interface StoreImageProps
  extends Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "width" | "height" | "loading"> {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  /** Stretch to the positioned parent, as `next/image`'s `fill` does. */
  fill?: boolean;
  sizes?: string;
  quality?: number;
  /** Load this one immediately and early -- the hero, never a grid tile. */
  priority?: boolean;
  preload?: boolean;
  unoptimized?: boolean;
  className?: string;
  style?: CSSProperties;
}

/** A desktop viewport to resolve an unconditional `vw` against. Wide enough
 * that a laptop is covered, and the browser picks from the ladder anyway. */
const DESKTOP_VIEWPORT = 1536;

/** The widest this image is ever drawn, in CSS pixels, read out of `sizes`.
 *
 * `sizes` is a list of `(condition) length` pairs with a bare length last, so
 * a `vw` is resolved against the viewport its own condition allows -- 46vw
 * under `(max-width: 480px)` is 221 px, not 707. Guessing that wrong is how a
 * srcSet ends up offering a phone a 1440 px file it will never need. */
function widestDisplayWidth(sizes: string | undefined, width: number | undefined): number {
  if (!sizes) return width ?? MAX_IMAGE_WIDTH;

  let widest = 0;

  for (const entry of sizes.split(",")) {
    const text = entry.trim();
    const condition = /\(\s*max-width:\s*(\d+)px\s*\)/.exec(text);
    const viewport = condition ? Number(condition[1]) : DESKTOP_VIEWPORT;

    const vw = /(\d+(?:\.\d+)?)vw\s*$/.exec(text);
    if (vw) {
      widest = Math.max(widest, (Number(vw[1]) / 100) * viewport);
      continue;
    }

    const px = /(\d+(?:\.\d+)?)px\s*$/.exec(text);
    if (px) widest = Math.max(widest, Number(px[1]));
  }

  return widest || width || MAX_IMAGE_WIDTH;
}

export default function StoreImage({
  src,
  alt,
  width,
  height,
  fill,
  sizes,
  quality,
  priority,
  preload,
  unoptimized: _unoptimized,
  className,
  style,
  ...rest
}: StoreImageProps) {
  const eager = Boolean(priority || preload);

  if (!isResizable(src)) {
    return (
      <NextImage
        src={src}
        alt={alt}
        {...(fill ? { fill: true as const } : { width, height })}
        sizes={sizes}
        quality={quality}
        priority={priority}
        className={className}
        style={style}
        {...rest}
      />
    );
  }

  // Twice the drawn width, because `sizes` is in CSS pixels and a phone paints
  // two or three device pixels for each one.
  const ceiling = widestDisplayWidth(sizes, width) * 2;
  const candidates = IMAGE_WIDTHS.filter((candidate) => candidate <= ceiling);
  const ladder = candidates.length > 0 ? candidates : [IMAGE_WIDTHS[0]];
  const widest = ladder[ladder.length - 1];

  const fillStyle: CSSProperties | undefined = fill
    ? {
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        objectFit: "cover",
        ...style,
      }
    : style;

  return (
    /* The rule below points at next/image, which is exactly what this
       component exists to route around: handed an `/api/media/` or Unsplash
       URL it emits no srcSet at all, so the <img> built here is the smaller
       download, not the larger one. */
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={resizedSrc(src, widest)}
      srcSet={ladder.map((candidate) => `${resizedSrc(src, candidate)} ${candidate}w`).join(", ")}
      // Without `sizes` the browser assumes 100vw and picks the largest file
      // on the ladder, which would undo the whole point of building one.
      sizes={sizes ?? (fill ? "100vw" : `${widest}px`)}
      alt={alt}
      width={fill ? undefined : width}
      height={fill ? undefined : height}
      loading={eager ? "eager" : "lazy"}
      fetchPriority={eager ? "high" : undefined}
      decoding="async"
      className={className}
      style={fillStyle}
      {...rest}
    />
  );
}
