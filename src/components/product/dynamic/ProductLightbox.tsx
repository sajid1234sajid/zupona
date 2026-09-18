"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import Image from "@/components/ui/StoreImage";
import { X } from "lucide-react";
import type { StoreMediaItem } from "@/lib/storefront";

/** Marks the history entry the viewer adds, so it can tell its own entry from
 * the page's when deciding whether closing still owes the browser a step back. */
const VIEWER_STATE_KEY = "zuponaPictureViewer";

/** The product pictures, full screen, one at a time.
 *
 * The same scroll-snap track as the gallery, so a swipe here feels exactly
 * like a swipe there. Each picture is contained on black -- whole, at its own
 * proportions, as large as the screen allows.
 *
 * It asks for the same file the gallery already downloaded: on a phone both
 * are sized to the full width, so the srcSet resolves to the same URL and the
 * picture opens from the cache instead of over the network again.
 *
 * Opening it adds one history entry, so the phone's own Back closes the viewer
 * instead of leaving the product. The close button, Escape and Back all end in
 * the same place: the page as it was, on the picture last viewed. */
export default function ProductLightbox({
  pictures,
  startIndex,
  productName,
  onChange,
  onClose,
}: {
  pictures: StoreMediaItem[];
  startIndex: number;
  productName: string;
  /** Called as the shopper moves between pictures, so the gallery behind is
   * already on the same one when the viewer closes. */
  onChange: (index: number) => void;
  onClose: () => void;
}) {
  const [current, setCurrent] = useState(startIndex);
  const trackRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  // Held in refs so the history effect below runs once per opening, not once
  // per render -- each run pushes an entry.
  const onCloseRef = useRef(onClose);
  const onChangeRef = useRef(onChange);
  useLayoutEffect(() => {
    onCloseRef.current = onClose;
    onChangeRef.current = onChange;
  });

  // Opens on the picture the gallery was showing, with no slide to get there.
  useLayoutEffect(() => {
    const track = trackRef.current;
    if (track) track.scrollLeft = startIndex * track.clientWidth;
    // Only on opening: after that the track is the source of truth.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const goTo = useCallback(
    (index: number) => {
      const track = trackRef.current;
      if (!track) return;
      const clamped = Math.max(0, Math.min(index, pictures.length - 1));
      track.scrollTo({ left: clamped * track.clientWidth, behavior: "smooth" });
    },
    [pictures.length]
  );

  function handleScroll() {
    const track = trackRef.current;
    if (!track || track.clientWidth === 0) return;

    const index = Math.round(track.scrollLeft / track.clientWidth);
    if (index === current || !pictures[index]) return;
    setCurrent(index);
    onChangeRef.current(index);
  }

  // The page behind is frozen, focus starts on the close button, and Escape
  // and the arrow keys work for anyone on a keyboard.
  useEffect(() => {
    closeRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onCloseRef.current();
      else if (event.key === "ArrowRight") goTo(current + 1);
      else if (event.key === "ArrowLeft") goTo(current - 1);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [current, goTo]);

  // Back closes the viewer. Its entry carries no URL, so the address never
  // changes and the router treats stepping off it as staying on the page.
  // Closed any other way, the entry is still on top and is stepped back over
  // here, so the viewer never leaves a dead Back press behind it.
  useEffect(() => {
    window.history.pushState({ [VIEWER_STATE_KEY]: true }, "");

    function onPop() {
      // Landing on another viewer entry is not leaving the viewer -- React's
      // development double-mount leaves one such entry beneath this one.
      const state = window.history.state as Record<string, unknown> | null;
      if (state?.[VIEWER_STATE_KEY]) return;
      onCloseRef.current();
    }
    window.addEventListener("popstate", onPop);

    return () => {
      window.removeEventListener("popstate", onPop);
      const state = window.history.state as Record<string, unknown> | null;
      if (state?.[VIEWER_STATE_KEY]) window.history.back();
    };
  }, []);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${productName} pictures`}
      className="fixed inset-0 z-[100] bg-black"
    >
      <div
        ref={trackRef}
        onScroll={handleScroll}
        className="no-scrollbar absolute inset-0 flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain"
      >
        {pictures.map((item, index) => (
          <div key={item.id} className="relative h-full w-full shrink-0 snap-center">
            {/* Only the picture on screen and its neighbours are mounted, so
                opening the viewer never fetches the whole set at once. The
                picture keeps clear of the bar above and the dots below, so a
                tall one never runs underneath either. */}
            {Math.abs(index - current) <= 1 && (
              <div className="absolute inset-x-0 bottom-[calc(48px+env(safe-area-inset-bottom))] top-[calc(64px+env(safe-area-inset-top))]">
                <Image
                  src={item.url}
                  alt={item.alt}
                  fill
                  sizes="100vw"
                  style={{ objectFit: "contain" }}
                  priority={index === current}
                />
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between px-4 pb-3 pt-[max(12px,env(safe-area-inset-top))]">
        <span className="rounded-full bg-black/55 px-3 py-1.5 text-[12px] font-bold text-white">
          {current + 1} / {pictures.length}
        </span>
        <button
          ref={closeRef}
          type="button"
          onClick={() => onCloseRef.current()}
          aria-label="Close pictures"
          className="pointer-events-auto grid h-11 w-11 place-items-center rounded-full bg-white text-heading shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-black"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {pictures.length > 1 && (
        <div className="absolute inset-x-0 bottom-0 flex justify-center pb-[max(16px,env(safe-area-inset-bottom))]">
          {pictures.map((item, index) => (
            <button
              key={item.id}
              type="button"
              onClick={() => goTo(index)}
              aria-label={`Show picture ${index + 1} of ${pictures.length}`}
              aria-current={index === current ? "true" : undefined}
              className="grid h-8 w-5 shrink-0 place-items-center focus:outline-none"
            >
              <span
                className={`block h-2.5 w-2.5 rounded-full transition-colors ${
                  index === current ? "bg-brand" : "bg-white/55"
                }`}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
