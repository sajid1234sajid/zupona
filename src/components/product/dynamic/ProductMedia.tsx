"use client";

import Image from "next/image";
import { Crown, Play } from "lucide-react";
import type { StoreMediaItem } from "@/lib/storefront";

/** Admin uploads are served by our own /api/media route, which the Next image
 * optimizer cannot fetch -- it answers 404 and the picture renders broken. Those
 * are already stored at a sane size and served immutable, so they pass through
 * untouched; only remote stock photography is optimized. */
function isUploadedMedia(url: string): boolean {
  return url.startsWith("/api/media/");
}

/** How many thumbnails fit before the strip gets a "+N" tile instead. */
const VISIBLE_THUMBS = 4;

/** The gallery: one landscape hero, the thumbnail strip beneath it.
 *
 * Beneath, never beside -- a side rail costs the hero a third of a phone's
 * width. The hero is 4:3 rather than square for the same reason the reference
 * designs are: product photography is shot wide, and a square crop cuts the
 * ends off a watch strap or a pair of shoes. */
export default function ProductMedia({
  media,
  activeId,
  onSelect,
  onPlayVideo,
  badgeLabel,
  productName,
  toolbar,
}: {
  media: StoreMediaItem[];
  activeId: string;
  onSelect: (id: string) => void;
  onPlayVideo: (item: StoreMediaItem) => void;
  badgeLabel: string | null;
  productName: string;
  /** Share and wishlist, floated over the top-right of the hero. */
  toolbar?: React.ReactNode;
}) {
  const active = media.find((item) => item.id === activeId) ?? media[0];
  const activeIndex = media.findIndex((item) => item.id === active?.id);

  // Everything fits up to five; past that the last tile becomes a counter, so
  // the strip never turns into a long horizontal scroll on a phone.
  const overflowCount = media.length > VISIBLE_THUMBS + 1 ? media.length - VISIBLE_THUMBS : 0;
  const shownThumbs = overflowCount > 0 ? media.slice(0, VISIBLE_THUMBS) : media;

  if (!active) return null;

  return (
    <div>
      <div className="relative aspect-[6/5] w-full overflow-hidden rounded-2xl bg-mint">
        {active.type === "video" ? (
          <button
            type="button"
            onClick={() => onPlayVideo(active)}
            aria-label={`Play ${productName} video`}
            className="group relative block h-full w-full"
          >
            <Image
              src={active.poster}
              alt={active.alt}
              fill
              sizes="(min-width: 700px) 560px, 100vw"
              className="object-cover"
              unoptimized={isUploadedMedia(active.poster)}
            />
            <span className="absolute left-1/2 top-1/2 grid h-16 w-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-brand/95 text-white shadow-lg transition group-hover:scale-105">
              <Play className="h-7 w-7 fill-current" />
            </span>
          </button>
        ) : (
          <Image
            src={active.url}
            alt={active.alt}
            fill
            sizes="(min-width: 700px) 560px, 100vw"
            className="object-cover"
            priority
            unoptimized={isUploadedMedia(active.url)}
          />
        )}

        {badgeLabel && (
          <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-brand-darkest/95 px-3 py-1.5 text-[11px] font-bold text-white shadow-sm">
            <Crown className="h-3.5 w-3.5" />
            {badgeLabel}
          </span>
        )}

        {toolbar && <div className="absolute right-3 top-3 flex gap-2">{toolbar}</div>}

        {media.length > 1 && (
          <span className="absolute bottom-3 right-3 rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-bold text-white">
            {activeIndex + 1}/{media.length}
          </span>
        )}
      </div>

      {media.length > 1 && (
        <ul className="no-scrollbar mt-3 flex gap-[7px] overflow-x-auto pb-1" aria-label="Product media">
          {shownThumbs.map((item) => {
            const selected = item.id === active.id;
            return (
              <li key={item.id} className="shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    onSelect(item.id);
                    if (item.type === "video") onPlayVideo(item);
                  }}
                  aria-label={item.type === "video" ? "Play product video" : item.alt}
                  aria-current={selected ? "true" : undefined}
                  className={`relative block h-[67px] w-[67px] overflow-hidden rounded-xl border-2 bg-mint transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 ${
                    selected ? "border-brand" : "border-transparent"
                  }`}
                >
                  <Image
                    src={item.poster}
                    alt=""
                    fill
                    sizes="70px"
                    className="object-cover"
                    unoptimized={isUploadedMedia(item.poster)}
                  />
                  {item.type === "video" && (
                    <span className="absolute inset-0 grid place-content-center justify-items-center gap-0.5 bg-black/45 text-white">
                      <Play className="h-4 w-4 fill-current" />
                      <span className="text-[9px] font-bold">Video</span>
                    </span>
                  )}
                </button>
              </li>
            );
          })}

          {overflowCount > 0 && (
            <li className="shrink-0">
              <button
                type="button"
                onClick={() => onSelect(media[VISIBLE_THUMBS].id)}
                aria-label={`Show ${overflowCount} more`}
                className="grid h-[67px] w-[67px] place-items-center rounded-xl border-2 border-transparent bg-mint text-sm font-bold text-brand-darkest transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
              >
                +{overflowCount}
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
