"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "@/components/ui/StoreImage";
import { Star, Play } from "lucide-react";
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
      {/* The photograph is the hero, not an inset beside a text column: the
          reference gives the whole card to the product and floats the copy
          over it. The scrim is what keeps that copy legible on a light photo,
          and the two white cards are the reference's own treatment -- dark
          green on white reads far better over imagery than translucent pills
          did. */}
      <div className="bg-white px-4 pt-3">
        <div className="relative aspect-[6/5] w-full overflow-hidden rounded-2xl bg-heading">
          {/* Every slide sits in one scroll-snap track filling the card, rather
              than a carousel library: it gives native, smooth touch swiping for
              free, and the browser handles the physics. Everything floated over
              it ignores the pointer, so a swipe that starts on the copy still
              moves the track and a clip's controls still take a tap. */}
          <div
            ref={trackRef}
            onScroll={handleScroll}
            className="absolute inset-0 flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {gallery.map((item, index) => (
              <div key={item.url} className="relative h-full w-full shrink-0 snap-center">
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
                    // otherwise lose its top and bottom to the frame.
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <>
                    <Image
                      src={item.url}
                      alt={product.name}
                      fill
                      sizes="(max-width: 448px) 100vw, 448px"
                      quality={90}
                      className="object-cover"
                      priority={index === 0}
                      unoptimized={isUploadedMedia(item.url)}
                    />
                    <span
                      aria-hidden
                      className="absolute inset-0 bg-gradient-to-l from-heading/85 via-heading/40 to-heading/5"
                    />
                  </>
                )}
              </div>
            ))}
          </div>

          {product.bestSeller && (
            <span className="pointer-events-none absolute left-3 top-3 z-10 inline-flex items-center gap-1.5 rounded-full bg-brand-dark px-3 py-1.5 text-[10.5px] font-bold text-white">
              <Star className="h-3.5 w-3.5 fill-white" />
              BEST SELLER
            </span>
          )}

          <div className="pointer-events-none absolute inset-y-3 right-3 z-10 flex w-[56%] flex-col justify-center gap-2 text-right text-white">
            {product.brand && (
              <p className="text-[12px] font-extrabold uppercase leading-none tracking-[0.12em]">
                {product.brand}
              </p>
            )}
            {product.heroHeadline && (
              <p className="text-[17px] font-extrabold leading-tight">{product.heroHeadline}</p>
            )}
            {product.heroSubtitle && (
              <p className="text-[11.5px] leading-tight text-brand-tint">{product.heroSubtitle}</p>
            )}

            {product.features && product.features.length > 0 && (
              <div className="mt-0.5 grid grid-cols-3 rounded-xl bg-white/95 px-1.5 py-2 text-center">
                {product.features.slice(0, 3).map((feature, index) => {
                  const FeatureIcon = resolveIcon(feature.icon);
                  return (
                    <span
                      key={feature.label}
                      className={`flex min-w-0 flex-col items-center gap-1 px-1 ${
                        index > 0 ? "border-l border-line" : ""
                      }`}
                    >
                      <FeatureIcon className="h-4 w-4 shrink-0 text-brand-dark" strokeWidth={2.25} />
                      <span className="text-[10px] font-semibold leading-tight text-brand-darkest">
                        {feature.label}
                      </span>
                    </span>
                  );
                })}
              </div>
            )}

            <div className="flex items-center justify-end gap-1.5 rounded-xl bg-white/95 px-2.5 py-2">
              <span className="text-[19px] font-extrabold leading-none text-brand-darkest">
                {formatPrice(product.price)}
              </span>
              {product.discountPercent > 0 && (
                <>
                  <span className="text-[11px] text-ink-faint line-through">
                    {formatPrice(product.oldPrice)}
                  </span>
                  <span className="rounded-full bg-brand px-1.5 py-0.5 text-[9.5px] font-bold text-white">
                    {product.discountPercent}% OFF
                  </span>
                </>
              )}
            </div>
          </div>

          <span className="pointer-events-none absolute bottom-3 right-3 z-10 rounded-full bg-heading/70 px-2.5 py-1 text-[10px] font-semibold text-white">
            {Math.min(activeIndex, count - 1) + 1}/{count}
          </span>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto bg-white px-4 py-2.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {gallery.map((item, index) => (
          <button
            key={item.url}
            type="button"
            onClick={() => goTo(index)}
            aria-label={item.kind === "video" ? "Play product video" : "Show product image"}
            className={`relative h-[60px] w-[60px] shrink-0 overflow-hidden rounded-xl border-2 bg-brand-mist ${
              index === activeIndex ? "border-brand" : "border-transparent"
            }`}
          >
            <Image
              src={item.kind === "video" ? item.poster : item.url}
              alt={product.name}
              fill
              sizes="60px"
              className="object-cover"
              unoptimized={isUploadedMedia(item.kind === "video" ? item.poster : item.url)}
            />
            {item.kind === "video" && (
              <span className="absolute inset-0 flex items-center justify-center bg-black/30">
                <Play className="h-5 w-5 fill-white text-white" />
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
