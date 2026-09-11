"use client";

import { useState } from "react";
import Image from "next/image";
import { Star, Play } from "lucide-react";
import { formatPrice } from "@/lib/format";
import { resolveIcon } from "./featureIcons";
import type { StoreProduct } from "@/lib/storefront";

/** One entry in the thumbnail strip. A video carries its own poster so the
 * strip can be drawn without loading any video bytes. */
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

export default function ProductGallery({ product }: { product: StoreProduct }) {
  const [activeIndex, setActiveIndex] = useState(0);

  // Real uploaded images now, so the thumbnail strip reflects what the admin
  // actually added rather than repeating one picture five times.
  const images = product.images.length > 0 ? product.images : [product.image];

  // Clips lead: a demo video is the thing worth seeing first, and the admin
  // already chose which one by ordering them.
  //
  // Defaulted because product JSON is served out of KV: for the few seconds
  // after a deploy the cache still holds entries written before videos
  // existed, and those have no `videos` key at all.
  const clips = product.videos ?? [];

  const gallery: GalleryItem[] = [
    ...clips.map((video) => ({
      kind: "video" as const,
      url: video.url,
      poster: video.poster,
    })),
    ...images.map((url) => ({ kind: "image" as const, url })),
  ];

  const active = gallery[Math.min(activeIndex, gallery.length - 1)];

  return (
    <div>
      {/* The photograph is the hero, not an inset beside a text column: the
          reference gives the whole card to the product and floats the copy
          over it. The scrim is what keeps that copy legible on a light photo,
          and the two white cards are the reference's own treatment -- dark
          green on white reads far better over imagery than translucent pills
          did. */}
      <div className="bg-white px-4 pt-3">
        <div className="relative aspect-[5/4] w-full overflow-hidden rounded-2xl bg-heading">
          {active.kind === "video" ? (
            <video
              // Keyed so switching clips swaps the element rather than
              // leaving the previous one paused mid-playback.
              key={active.url}
              src={active.url}
              poster={active.poster}
              controls
              playsInline
              preload="metadata"
              className="h-full w-full object-contain"
            />
          ) : (
            <>
              <Image
                src={active.url}
                alt={product.name}
                fill
                sizes="(max-width: 448px) 100vw, 448px"
                quality={90}
                className="object-cover"
                priority
                unoptimized={isUploadedMedia(active.url)}
              />
              <span
                aria-hidden
                className="absolute inset-0 bg-gradient-to-l from-heading/85 via-heading/40 to-heading/5"
              />
            </>
          )}

          {product.bestSeller && (
            <span className="absolute left-3 top-3 z-10 inline-flex items-center gap-1.5 rounded-full bg-brand-dark px-3 py-1.5 text-[10.5px] font-bold text-white">
              <Star className="h-3.5 w-3.5 fill-white" />
              BEST SELLER
            </span>
          )}

          <div className="absolute inset-y-3 right-3 z-10 flex w-[56%] flex-col justify-center gap-2 text-right text-white">
            {product.brand && (
              <p className="text-[12px] font-extrabold uppercase leading-none tracking-[0.12em]">
                {product.brand}
              </p>
            )}
            {product.heroHeadline && (
              <p className="text-[17px] font-extrabold leading-tight">{product.heroHeadline}</p>
            )}
            {product.heroSubtitle && (
              <p className="text-[11.5px] leading-tight text-white/85">{product.heroSubtitle}</p>
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
                      <span className="text-[8.5px] font-semibold leading-tight text-brand-darkest">
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

          <span className="absolute bottom-3 right-3 z-10 rounded-full bg-heading/70 px-2.5 py-1 text-[10px] font-semibold text-white">
            {Math.min(activeIndex, gallery.length - 1) + 1}/{gallery.length}
          </span>
        </div>
      </div>

      <div className="flex gap-2 bg-white px-4 py-2.5">
        {gallery.map((item, index) => (
          <button
            key={item.url}
            onClick={() => setActiveIndex(index)}
            aria-label={item.kind === "video" ? "Play product video" : "Show product image"}
            className={`relative h-12 w-12 shrink-0 overflow-hidden rounded-lg border-2 bg-brand-mist ${
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
    </div>
  );
}
