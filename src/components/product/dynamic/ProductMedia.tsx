"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "@/components/ui/StoreImage";
import { Crown } from "lucide-react";
import type { StoreMediaItem } from "@/lib/storefront";
import ProductLightbox from "./ProductLightbox";

/** Admin uploads are served by our own /api/media route, which the Next image
 * optimizer cannot fetch -- it answers 404 and the picture renders broken. Those
 * are already stored at a sane size and served immutable, so they pass through
 * untouched; only remote stock photography is optimized. */
function isUploadedMedia(url: string): boolean {
  return url.startsWith("/api/media/");
}

/** How long a slide holds the screen before the gallery moves itself along. */
const SLIDE_DWELL_MS = 2000;

/** Quiet spell after a finger leaves the hero before it resumes on its own.
 * Without it the carousel would slide out from under someone who had just
 * swiped back to the picture they wanted to look at. */
const RESUME_AFTER_MS = 5000;

/** The gallery: one picture at a time, dots across its foot, and a tap opens
 * the full-screen viewer.
 *
 * Pictures only. Clips and the thumbnail strip were taken out of the gallery
 * at the owner's request, so the dots count exactly the product's images.
 *
 * The frame is square and each picture fills it edge to edge, as the owner's
 * reference does; the whole, uncropped picture is one tap away in the viewer.
 * The uploads are mostly 2:3 portraits of a model, so the crop is weighted
 * towards the top: centred, it pressed every head against the upper edge.
 *
 * Every picture sits in one scroll-snap track rather than in a carousel
 * library, which is what makes the hero swipeable: the browser does the
 * physics, and a finger and a dot land in the same state because the active
 * slide is read back off the scroll position rather than driving it. */
export default function ProductMedia({
  media,
  activeId,
  onSelect,
  badgeLabel,
  productName,
  toolbar,
  overlayStart,
  overlayEnd,
}: {
  media: StoreMediaItem[];
  activeId: string;
  onSelect: (id: string) => void;
  badgeLabel: string | null;
  productName: string;
  /** Share and wishlist, floated over the top-right of the hero. */
  toolbar?: React.ReactNode;
  /** Floated over the bottom-left of the hero, e.g. the rating chip. */
  overlayStart?: React.ReactNode;
  /** Floated over the bottom-right of the hero, e.g. "View Similar". */
  overlayEnd?: React.ReactNode;
}) {
  const pictures = useMemo(() => media.filter((item) => item.type === "image"), [media]);
  const active = pictures.find((item) => item.id === activeId) ?? pictures[0];
  const activeIndex = Math.max(
    pictures.findIndex((item) => item.id === active?.id),
    0
  );

  const trackRef = useRef<HTMLDivElement>(null);
  const resumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Where a smooth scroll is heading, while it is still on its way. */
  const travellingTo = useRef<number | null>(null);
  const [held, setHeld] = useState(false);
  /** Whether the full-screen viewer is open. The hero stands still meanwhile,
   * so closing it lands on the picture the shopper was last looking at. */
  const [viewing, setViewing] = useState(false);
  /** The furthest picture reached so far, raised wherever a new slide becomes
   * current. One past it is fetched and no further: left to themselves the
   * browser pulls all six at once, and a shopper who reads the price and
   * leaves has paid for pictures nobody looked at. It only ever grows, so
   * nothing already on screen is torn down. */
  const [reached, setReached] = useState(0);

  /** The slide the track is actually parked on, or -1 before it has a width. */
  const parkedIndex = useCallback(() => {
    const track = trackRef.current;
    if (!track || track.clientWidth === 0) return -1;
    return Math.round(track.scrollLeft / track.clientWidth);
  }, []);

  /** Scrolls the track, which is what moves the carousel. Wraps, so the last
   * picture leads back to the first instead of dead-ending. */
  const goTo = useCallback(
    (index: number) => {
      const track = trackRef.current;
      if (!track || pictures.length === 0) return;

      const wrapped = ((index % pictures.length) + pictures.length) % pictures.length;
      // Noted before the scroll starts, so the positions it travels through on
      // the way are not mistaken for the shopper choosing them. Without this,
      // a tap on the sixth dot selects the fourth picture mid-flight, and the
      // effect below then scrolls back to it -- the journey stops half way.
      travellingTo.current = wrapped;
      track.scrollTo({ left: wrapped * track.clientWidth, behavior: "smooth" });
      setReached((furthest) => Math.max(furthest, wrapped));

      // Marked as active the moment the journey begins, so the dot moves with
      // the picture rather than a few hundred milliseconds behind it.
      const item = pictures[wrapped];
      if (item && item.id !== activeId) onSelect(item.id);
    },
    [pictures, activeId, onSelect]
  );

  const hold = useCallback(() => {
    if (resumeTimer.current) clearTimeout(resumeTimer.current);
    // A finger on the track outranks any scroll still in flight.
    travellingTo.current = null;
    setHeld(true);
  }, []);

  const release = useCallback(() => {
    if (resumeTimer.current) clearTimeout(resumeTimer.current);
    resumeTimer.current = setTimeout(() => setHeld(false), RESUME_AFTER_MS);
  }, []);

  useEffect(() => {
    return () => {
      if (resumeTimer.current) clearTimeout(resumeTimer.current);
      if (settleTimer.current) clearTimeout(settleTimer.current);
    };
  }, []);

  /** Reads the slide back off the scroll position, which is what keeps a
   * swipe and a dot in one state. */
  const syncFromScroll = useCallback(() => {
    const track = trackRef.current;
    if (!track || track.clientWidth === 0) return;

    const index = Math.round(track.scrollLeft / track.clientWidth);
    const item = pictures[index];
    if (!item) return;

    setReached((furthest) => Math.max(furthest, index));
    if (item.id !== activeId) onSelect(item.id);
  }, [activeId, pictures, onSelect]);

  function handleScroll() {
    // Whatever else happens, the resting position wins: this also releases a
    // smooth scroll that stopped a pixel short of its target, so one rounding
    // error cannot leave the track deaf to the next swipe.
    if (settleTimer.current) clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => {
      travellingTo.current = null;
      syncFromScroll();
    }, 120);

    // A finger drags the dots along with it in real time; a scroll this
    // component started is left to arrive first.
    if (travellingTo.current === null) syncFromScroll();
  }

  // A choice made anywhere else -- a colour swatch that carries its own
  // picture, a dot, the full-screen viewer -- brings the track with it. A
  // no-op when the track is already there, which is the case after a swipe,
  // so this can never fight the finger that caused it.
  useEffect(() => {
    if (travellingTo.current === activeIndex) return;

    const parked = parkedIndex();
    if (parked < 0 || parked === activeIndex) return;
    goTo(activeIndex);
  }, [activeIndex, goTo, parkedIndex]);

  // The automatic advance, restarted whenever the active slide changes: a
  // swipe or a tap therefore gives the new picture its own full spell rather
  // than whatever was left of the last one's.
  useEffect(() => {
    if (pictures.length < 2 || held || viewing) return;

    const timer = setTimeout(() => goTo(activeIndex + 1), SLIDE_DWELL_MS);
    return () => clearTimeout(timer);
  }, [activeIndex, pictures.length, held, viewing, goTo]);

  if (!active) return null;

  return (
    <div>
      <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-mint">
        <div
          ref={trackRef}
          onScroll={handleScroll}
          onPointerDown={hold}
          onPointerUp={release}
          onPointerCancel={release}
          onMouseEnter={hold}
          onMouseLeave={release}
          className="no-scrollbar absolute inset-0 flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain"
        >
          {pictures.map((item, index) => (
            <div key={item.id} className="relative h-full w-full shrink-0 snap-center">
              {/* The box is always here, because the track's width and every
                  snap position are measured from it. The picture inside is
                  not, until the gallery is nearly at it. A tap opens it full
                  screen; a swipe scrolls the track and never counts as one. */}
              {index > reached + 1 ? null : (
                <button
                  type="button"
                  onClick={() => setViewing(true)}
                  aria-label={`View picture ${index + 1} of ${pictures.length} full screen`}
                  className="relative block h-full w-full cursor-zoom-in focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand"
                >
                  <Image
                    src={item.url}
                    alt={item.alt}
                    fill
                    sizes="(min-width: 700px) 560px, 100vw"
                    style={{ objectPosition: "50% 25%" }}
                    // Only the first picture is worth fetching early; the next
                    // one is mounted lazily, one ahead of where the shopper is.
                    priority={index === 0}
                    unoptimized={isUploadedMedia(item.url)}
                  />
                </button>
              )}
            </div>
          ))}
        </div>

        {badgeLabel && (
          <span className="pointer-events-none absolute left-3 top-3 z-10 inline-flex items-center gap-1.5 rounded-full bg-brand-darkest/95 px-3 py-1.5 text-[11px] font-bold text-white shadow-card">
            <Crown className="h-3.5 w-3.5" />
            {badgeLabel}
          </span>
        )}

        {toolbar && <div className="absolute right-3 top-3 z-10 flex gap-2">{toolbar}</div>}

        {/* One band across the foot of the hero: chip, dots, chip. The dots
            take whatever the two chips leave rather than being centred on the
            picture, because centred they slide under "View Similar" on a
            narrow phone. */}
        {(overlayStart || overlayEnd || pictures.length > 1) && (
          <div className="pointer-events-none absolute inset-x-3 bottom-3 z-10 flex items-end gap-1.5 [&>*]:pointer-events-auto">
            <div className="flex min-w-0 shrink-0 items-center gap-2">{overlayStart}</div>

            {/* The position indicator the reference uses, and a tap target for
                jumping a picture. Measured off the owner's screenshot: 10px
                dots, 10px apart, centred 16px above the picture's foot -- the
                negative margin drops them below the chips' line to get there. */}
            {pictures.length > 1 ? (
              <div className="-mb-2 flex min-w-0 flex-1 items-center justify-center overflow-hidden">
                {pictures.map((item, index) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      hold();
                      onSelect(item.id);
                      release();
                    }}
                    aria-label={`Show picture ${index + 1} of ${pictures.length}`}
                    aria-current={index === activeIndex ? "true" : undefined}
                    className="grid h-6 w-5 shrink-0 place-items-center focus:outline-none"
                  >
                    <span
                      className={`block h-2.5 w-2.5 rounded-full shadow-[0_0_3px_rgba(0,0,0,0.35)] transition-colors ${
                        index === activeIndex ? "bg-brand" : "bg-white"
                      }`}
                    />
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex-1" />
            )}

            <div className="flex shrink-0 items-center">{overlayEnd}</div>
          </div>
        )}
      </div>

      {viewing && (
        <ProductLightbox
          pictures={pictures}
          startIndex={activeIndex}
          productName={productName}
          onChange={(index) => {
            const item = pictures[index];
            if (item && item.id !== activeId) onSelect(item.id);
          }}
          onClose={() => setViewing(false)}
        />
      )}
    </div>
  );
}
