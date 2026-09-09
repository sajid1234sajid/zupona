"use client";

import { useState } from "react";
import Image from "next/image";
import { Star, Leaf, ArrowRight, Play } from "lucide-react";
import { formatPrice } from "@/lib/format";
import { resolveIcon } from "./featureIcons";
import type { StoreProduct } from "@/lib/storefront";

/** One entry in the thumbnail strip. A video carries its own poster so the
 * strip can be drawn without loading any video bytes. */
type GalleryItem =
  | { kind: "image"; url: string }
  | { kind: "video"; url: string; poster: string };

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
      <div className="relative overflow-hidden bg-gradient-to-br from-brand-darkest via-emerald-950 to-neutral-900 px-4 pt-4 pb-4 text-white">
        <Leaf className="absolute -right-6 top-6 h-28 w-28 rotate-12 text-white/5" />
        <Leaf className="absolute -left-8 bottom-10 h-24 w-24 -rotate-12 text-white/5" />

        {product.bestSeller && (
          <span className="relative z-10 inline-flex items-center gap-1 rounded-full bg-brand px-2.5 py-1 text-[10px] font-bold">
            <Star className="h-3 w-3 fill-white" />
            BEST SELLER
          </span>
        )}

        <div className="relative z-10 mt-2 flex items-center justify-between gap-3">
          <div className="relative h-28 flex-1 overflow-hidden rounded-xl bg-white/5">
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
              <Image
                src={active.url}
                alt={product.name}
                fill
                sizes="220px"
                className="object-cover"
                priority
              />
            )}
          </div>

          <div className="w-[42%] shrink-0 text-right">
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
        </div>

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

          <button
            aria-label="Next image"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-brand-darkest"
          >
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>

        <div className="relative z-10 mt-3 flex justify-center gap-1.5">
          {gallery.map((item, index) => (
            <span
              key={`dot-${item.url}`}
              className={`h-1.5 rounded-full transition-all ${
                index === activeIndex ? "w-4 bg-white" : "w-1.5 bg-white/30"
              }`}
            />
          ))}
        </div>
      </div>

      <div className="flex gap-2 bg-white px-4 py-2.5">
        {gallery.map((item, index) => (
          <button
            key={item.url}
            onClick={() => setActiveIndex(index)}
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
