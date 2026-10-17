"use client";

import { useCallback, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import ProductCard from "@/components/home/ProductCard";
import type { ProductSummary } from "@/types";

/** A titled row of product cards that scrolls sideways.
 *
 * About two and a half cards on a phone, five on a laptop, with arrows that
 * page by a screenful and snap scrolling so a card never stops half cut. The
 * cards are the shop's one `ProductCard`, so a rail and a grid never disagree
 * about what a product shows.
 *
 * Cards are mounted only as they are needed: the first screenful once the
 * rail comes near the viewport, the rest when the shopper scrolls the rail
 * or presses an arrow. Each card is a client component that costs hydration
 * work, and a home page with several rails of a dozen cards each doing all
 * of it up front measured more than double the main-thread blocking of the
 * page without them on a throttled phone. Until a card mounts its slot
 * holds the same size, so nothing moves when it fills. */
export default function ProductRail({
  id,
  title,
  icon,
  href,
  extra,
  products,
  wishlistIds,
  isSignedIn,
}: {
  id: string;
  title: string;
  icon?: ReactNode;
  /** "View all" target; omitted when there is no page to go to. */
  href?: string;
  /** Beside the title: a countdown, a note. */
  extra?: ReactNode;
  products: ProductSummary[];
  wishlistIds: string[];
  isSignedIn: boolean;
}) {
  // How many cards are real; the rest are placeholders of the same size.
  const [mounted, setMounted] = useState(0);
  const firstScreen = 5;
  const trackRef = useRef<HTMLDivElement | null>(null);
  const wishlist = new Set(wishlistIds);

  const sentinelRef = useCallback((node: HTMLElement | null) => {
    if (!node) return;
    if (typeof IntersectionObserver === "undefined") {
      setMounted(firstScreen);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setMounted((current) => Math.max(current, firstScreen));
          observer.disconnect();
        }
      },
      { rootMargin: "200px 0px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const mountAll = () => setMounted(products.length);

  function page(direction: 1 | -1) {
    mountAll();
    const track = trackRef.current;
    if (!track) return;
    track.scrollBy({ left: direction * track.clientWidth * 0.9, behavior: "smooth" });
  }

  return (
    <section id={id} ref={sentinelRef} aria-labelledby={`${id}-title`} className="scroll-mt-20 pt-5 tab:pt-8">
      <div className="flex items-center justify-between gap-2 px-3.5 tab:px-0">
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
          <h2 id={`${id}-title`} className="flex items-center gap-1.5 text-[15px] font-bold text-heading tab:text-xl">
            {icon}
            {title}
          </h2>
          {extra}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {href ? (
            <Link
              href={href}
              prefetch={false}
              className="flex items-center gap-0.5 text-[12px] font-semibold text-brand tab:mr-2 tab:text-sm"
            >
              View all <ChevronRight className="h-3.5 w-3.5 tab:h-4 tab:w-4" strokeWidth={2.6} />
            </Link>
          ) : null}
          <button
            type="button"
            aria-label={`Scroll ${title} back`}
            onClick={() => page(-1)}
            className="hidden h-9 w-9 place-items-center rounded-full border border-line bg-white text-ink hover:border-brand tab:grid"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label={`Scroll ${title} forward`}
            onClick={() => page(1)}
            className="hidden h-9 w-9 place-items-center rounded-full border border-line bg-white text-ink hover:border-brand tab:grid"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div
        ref={trackRef}
        onScroll={mounted < products.length ? mountAll : undefined}
        onTouchStart={mounted < products.length ? mountAll : undefined}
        className="no-scrollbar mt-2.5 flex snap-x snap-mandatory gap-2 overflow-x-auto scroll-px-3.5 px-3.5 pb-1 tab:mt-4 tab:scroll-px-0 tab:gap-3 tab:px-0"
      >
        {products.map((product, i) =>
          i < mounted ? (
            <div
              key={product.id}
              className="w-[42%] shrink-0 snap-start tab:w-[calc((100%-48px)/5)]"
            >
              <ProductCard
                product={product}
                isWishlisted={wishlist.has(product.id)}
                isSignedIn={isSignedIn}
              />
            </div>
          ) : (
            // Holds the rail's height until the cards arrive.
            <div
              key={product.id}
              aria-hidden
              className="aspect-[4/6.6] w-[42%] shrink-0 rounded-xl bg-skeleton tab:w-[calc((100%-48px)/5)]"
            />
          )
        )}
      </div>
    </section>
  );
}
