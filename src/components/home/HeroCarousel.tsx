"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "@/components/ui/StoreImage";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { StoreBanner } from "@/lib/storefront";

/** How long one banner holds the top of the homepage before the next slides
 * in. Long enough to read a headline and decide, short enough that a shopper
 * who scrolls past in a few seconds still sees more than one. */
const DWELL_MS = 5000;

/** The published hero banners, rotating.
 *
 * Every slide sits in one scroll-snap track rather than a carousel library, as
 * the product gallery does: a finger swipe is then the browser's own physics,
 * and a tapped dot and a swipe end in exactly the same state because the
 * active index follows the scroll position rather than driving it.
 *
 * Autoplay stops for good the moment the shopper touches the strip. Something
 * moving itself under a finger that is already steering is the one behaviour
 * that makes a rotating banner worse than a still one. */
export default function HeroCarousel({ banners }: { banners: StoreBanner[] }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [autoplay, setAutoplay] = useState(true);
  const trackRef = useRef<HTMLDivElement>(null);
  const count = banners.length;

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

  useEffect(() => {
    if (!autoplay || count < 2) return;

    // Someone who has asked their system for less motion is not asking for a
    // banner that slides on its own every five seconds.
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    const timer = setTimeout(() => goTo(activeIndex + 1), DWELL_MS);
    return () => clearTimeout(timer);
  }, [activeIndex, autoplay, count, goTo]);

  const stopAutoplay = () => setAutoplay(false);

  return (
    <section className="px-3.5 pt-2.5 tab:px-0 tab:pt-0">
      <div className="relative h-[118px] overflow-hidden rounded-[18px] bg-[linear-gradient(105deg,#00553d_0%,#007553_100%)] tab:h-[300px] tab:rounded-3xl">
        <div
          ref={trackRef}
          onScroll={handleScroll}
          onPointerDown={stopAutoplay}
          onTouchStart={stopAutoplay}
          className="absolute inset-0 flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {banners.map((banner, index) => (
            <Slide key={banner.id} banner={banner} eager={index === 0} />
          ))}
        </div>

        {/* The dots sit on their own soft pill: a translucent white dot alone
            vanished against a pale photograph, and which banner you are on is
            the only thing this control has to say. */}
        {count > 1 ? (
          <div className="pointer-events-none absolute bottom-2 left-0 right-0 z-10 flex justify-center tab:bottom-5">
            <div className="flex items-center gap-1.5 rounded-full bg-black/25 px-2 py-1 backdrop-blur-[2px] tab:gap-2 tab:px-3 tab:py-1.5">
              {banners.map((banner, index) => (
                <button
                  key={banner.id}
                  type="button"
                  aria-label={`Show banner ${index + 1}`}
                  aria-current={index === activeIndex}
                  onClick={() => {
                    stopAutoplay();
                    goTo(index);
                  }}
                  className={`pointer-events-auto h-1.5 rounded-full transition-all tab:h-2 ${
                    index === activeIndex ? "w-4 bg-white tab:w-6" : "w-1.5 bg-white/60 tab:w-2"
                  }`}
                />
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

/** One banner in the strip.
 *
 * An uploaded picture is shown on its own -- these banners are finished
 * artwork with their own wording, so a headline drawn on top would land
 * across it. A banner published without a picture has nothing else to show,
 * so there the copy is set on the brand green instead. */
function Slide({ banner, eager }: { banner: StoreBanner; eager: boolean }) {
  const inner = banner.image ? (
    <Image
      src={banner.image}
      alt={banner.title}
      fill
      sizes="(min-width: 700px) 1440px, 100vw"
      preload={eager}
      style={{ objectFit: "cover", objectPosition: "50% 50%" }}
    />
  ) : (
    <div className="flex h-full max-w-[72%] flex-col justify-center px-3.5 tab:max-w-[58%] tab:px-10 lg:px-14">
      <p className="font-serif text-[20px] font-bold leading-[1.1] text-white tab:text-[40px] lg:text-[48px]">
        {banner.title}
      </p>
      {banner.subtitle ? (
        <p className="mt-1 text-[10px] leading-[1.35] text-white/85 tab:mt-3 tab:text-base">
          {banner.subtitle}
        </p>
      ) : null}
      {banner.href ? (
        <span className="mt-2 inline-flex w-fit items-center gap-1 rounded-full bg-white px-3 py-[5px] text-[9.5px] font-semibold text-brand-dark shadow-[0_2px_6px_rgba(0,40,28,0.35)] tab:mt-5 tab:gap-2 tab:px-6 tab:py-2.5 tab:text-sm">
          Shop Now
          <ArrowRight className="h-3 w-3 tab:h-4 tab:w-4" strokeWidth={2.5} />
        </span>
      ) : null}
    </div>
  );

  // `draggable={false}` on the link: without it a slow drag on a desktop
  // browser starts a native link drag instead of scrolling the strip.
  return banner.href ? (
    <Link
      href={banner.href}
      draggable={false}
      className="relative block h-full w-full shrink-0 snap-center"
    >
      {inner}
    </Link>
  ) : (
    <div className="relative h-full w-full shrink-0 snap-center">{inner}</div>
  );
}
