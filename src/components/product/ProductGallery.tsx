"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { Star, Leaf, ArrowRight, Play } from "lucide-react";
import { formatPrice } from "@/lib/format";
import { resolveIcon } from "./featureIcons";
import type { StoreProduct } from "@/lib/storefront";

/** One slide. A video carries its own poster so the thumbnail strip and the
 * slide itself can be drawn without loading any video bytes. */
type GalleryItem =
  | { kind: "image"; url: string }
  | { kind: "video"; url: string; poster: string };

/** Anything uploaded by an admin is served by our own /api/media route, and
 * the Next image optimizer cannot fetch it -- it answers 404 for those URLs,
 * which is what turned uploaded imagery into broken thumbnails. Those objects
 * are already stored at a sane size and served immutable, so they are passed
 * through untouched; only remote stock photography is optimized. */
function isUploadedMedia(url: string): boolean {
  return url.startsWith("/api/media/");
}

/** How long a still image holds the screen before the gallery moves on. */
const IMAGE_DWELL_MS = 2000;

/** A clip normally sets its own pace -- the gallery advances when it ends.
 * This is the backstop for one the browser refused to autoplay, so a blocked
 * video cannot strand the carousel on a single slide forever. */
const STALLED_VIDEO_DWELL_MS = 6000;

export default function ProductGallery({ product }: { product: StoreProduct }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);

  const gallery = useMemo<GalleryItem[]>(() => {
    // Real uploaded images now, so the strip reflects what the admin actually
    // added rather than repeating one picture five times.
    const images = product.images.length > 0 ? product.images : [product.image];

    // Defaulted because product JSON is served out of KV: for the few seconds
    // after a deploy the cache still holds entries written before videos
    // existed, and those have no `videos` key at all.
    const clips = product.videos ?? [];

    // Clips lead: a demo video is the thing worth seeing first, and the admin
    // already chose the order.
    return [
      ...clips.map((video) => ({
        kind: "video" as const,
        url: video.url,
        poster: video.poster,
      })),
      ...images.map((url) => ({ kind: "image" as const, url })),
    ];
  }, [product.images, product.image, product.videos]);

  const count = gallery.length;

  /** Scrolls the track, which is what actually moves the carousel -- the
   * active index follows from the scroll position rather than driving it, so
   * a finger swipe and a click end up in exactly the same state. */
  const goTo = useCallback(
    (index: number) => {
      const track = trackRef.current;
      if (!track || count === 0) return;

      const wrapped = ((index % count) + count) % count;
      track.scrollTo({ left: wrapped * track.clientWidth, behavior: "smooth" });
    },
    [count]
  );

  const handleScroll = () => {
    const track = trackRef.current;
    if (!track || track.clientWidth === 0) return;

    const index = Math.round(track.scrollLeft / track.clientWidth);
    setActiveIndex((current) => (current === index ? current : index));
  };

  // The clip on screen plays itself; every other one is stopped so nothing
  // keeps playing out of sight. Muted because that is the only kind of
  // autoplay a browser allows unprompted -- the controls let a shopper turn
  // the sound on.
  useEffect(() => {
    videoRefs.current.forEach((video, index) => {
      if (!video) return;

      if (index === activeIndex) {
        video.muted = true;
        video.currentTime = 0;
        void video.play().catch(() => {
          /* Blocked: the dwell timer below moves the gallery along instead. */
        });
      } else {
        video.pause();
      }
    });
  }, [activeIndex]);

  // Automatic advance. A still gets a fixed spell on screen; a clip is left to
  // finish, because sliding away mid-playback is the one thing that would make
  // an auto-advancing gallery worse than a static one.
  useEffect(() => {
    if (count < 2) return;

    const dwell =
      gallery[activeIndex]?.kind === "video" ? STALLED_VIDEO_DWELL_MS : IMAGE_DWELL_MS;

    const timer = setTimeout(() => {
      const video = videoRefs.current[activeIndex];
      // Still running: `onEnded` will take it from here.
      if (video && !video.paused && !video.ended) return;
      goTo(activeIndex + 1);
    }, dwell);

    return () => clearTimeout(timer);
  }, [activeIndex, count, gallery, goTo]);

  return (
    <div>
      <div className="relative overflow-hidden bg-gradient-to-br from-brand-darkest via-emerald-950 to-neutral-900 px-4 pt-4 pb-4 text-white">
        <Leaf className="absolute -right-6 top-6 h-28 w-28 rotate-12 text-white/5" />
        <Leaf className="absolute -left-8 bottom-10 h-24 w-24 -rotate-12 text-white/5" />

        {product.bestSeller && (
          <span className="relative z-10 inline-flex items-center gap-1 rounded-full bg-brand px-2.5 py-1 text-[10px] font-bold">
            <Star className="h-3 w-3 fill-white" />
            BEST SELLER
          </span>
        )}

        {/* Scroll-snap rather than a carousel library: it gives native, smooth
            touch swiping for free, and the browser handles the physics. */}
        <div
          ref={trackRef}
          onScroll={handleScroll}
          className="relative z-10 mt-2 flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain rounded-xl bg-black/30 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {gallery.map((item, index) => (
            <div key={item.url} className="relative aspect-[4/3] w-full shrink-0 snap-center">
              {item.kind === "video" ? (
                <video
                  ref={(element) => {
                    videoRefs.current[index] = element;
                  }}
                  src={item.url}
                  poster={item.poster}
                  controls
                  muted
                  playsInline
                  // Only the slide in view is worth fetching; the rest sit as
                  // a poster until they are reached.
                  preload={index === activeIndex ? "auto" : "none"}
                  onEnded={() => goTo(index + 1)}
                  // Contained, not cropped: a clip filmed upright would
                  // otherwise lose its top and bottom to a 4:3 frame.
                  className="h-full w-full bg-black object-contain"
                />
              ) : (
                <Image
                  src={item.url}
                  alt={product.name}
                  fill
                  sizes="(max-width: 448px) 100vw, 448px"
                  className="object-cover"
                  priority={index === 0}
                  unoptimized={isUploadedMedia(item.url)}
                />
              )}
            </div>
          ))}
        </div>

        {count > 1 && (
          <div className="relative z-10 mt-2.5 flex justify-center gap-1.5">
            {gallery.map((item, index) => (
              <button
                key={`dot-${item.url}`}
                type="button"
                onClick={() => goTo(index)}
                aria-label={`Show item ${index + 1} of ${count}`}
                className={`h-1.5 rounded-full transition-all ${
                  index === activeIndex ? "w-4 bg-white" : "w-1.5 bg-white/30"
                }`}
              />
            ))}
          </div>
        )}

        {(product.brand || product.heroHeadline || product.heroSubtitle) && (
          <div className="relative z-10 mt-3">
            {product.brand && (
              <p className="text-[11px] font-bold uppercase tracking-widest text-brand-light">
                {product.brand}
              </p>
            )}
            {product.heroHeadline && (
              <p className="mt-1 text-xl font-extrabold leading-tight">
                {product.heroHeadline}
              </p>
            )}
            {product.heroSubtitle && (
              <p className="mt-1 text-[11px] text-white/60">{product.heroSubtitle}</p>
            )}
          </div>
        )}

        {product.features && product.features.length > 0 && (
          <div className="relative z-10 mt-3 flex flex-wrap gap-1.5">
            {product.features.map((feature) => {
              const FeatureIcon = resolveIcon(feature.icon);
              return (
                <span
                  key={feature.label}
                  className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-1 text-[10px] font-medium"
                >
                  <FeatureIcon className="h-3 w-3" />
                  {feature.label}
                </span>
              );
            })}
          </div>
        )}

        <div className="relative z-10 mt-3 flex items-end justify-between">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-extrabold">{formatPrice(product.price)}</span>
            {product.discountPercent > 0 && (
              <>
                <span className="text-sm text-white/50 line-through">
                  {formatPrice(product.oldPrice)}
                </span>
                <span className="rounded-md bg-accent-red px-1.5 py-0.5 text-[10px] font-bold">
                  {product.discountPercent}% OFF
                </span>
              </>
            )}
          </div>

          {count > 1 && (
            <button
              type="button"
              onClick={() => goTo(activeIndex + 1)}
              aria-label="Next item"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-brand-darkest"
            >
              <ArrowRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {count > 1 && (
        <div className="flex gap-2 overflow-x-auto bg-white px-4 py-2.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {gallery.map((item, index) => (
            <button
              key={item.url}
              type="button"
              onClick={() => goTo(index)}
              aria-label={item.kind === "video" ? "Play product video" : "Show product image"}
              className={`relative h-12 w-12 shrink-0 overflow-hidden rounded-lg border-2 bg-neutral-100 ${
                index === activeIndex ? "border-brand" : "border-transparent"
              }`}
            >
              <Image
                src={item.kind === "video" ? item.poster : item.url}
                alt={product.name}
                fill
                sizes="48px"
                className="object-cover"
                unoptimized={isUploadedMedia(item.kind === "video" ? item.poster : item.url)}
              />
              {item.kind === "video" && (
                <span className="absolute inset-0 flex items-center justify-center bg-black/30">
                  <Play className="h-4 w-4 fill-white text-white" />
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
