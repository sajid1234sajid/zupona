"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Flame, ChevronRight } from "lucide-react";
import { productFilters } from "@/data/productFilters";
import type { ProductFilter } from "@/types";
import type { StoreProductCard } from "@/lib/storefront";
import { useProductSearch } from "@/components/search/SearchProvider";
import { COLLAPSED_HEIGHT } from "@/components/layout/StickyHeader";
import ProductCard from "./ProductCard";

/** The featured grid, its filter row and the header's search results.
 *
 * Two collections arrive from the server. `featured` is the products a
 * shopkeeper ticked "Featured" on; they lead the grid, which is what makes the
 * top row curated rather than whatever sorted first. `catalog` is the rest of
 * the shop, shown underneath, so the page keeps going past the first row and
 * every chip has something to show.
 *
 * Both the chips and the search filter on `categoryId`, the department id the
 * database assigns each product. Nothing here matches on a product's name, so
 * a product uploaded later lands under the right chip purely from its
 * category, and can never show up under the wrong one.
 *
 * The chip row is a bar of its own rather than an afterthought beside the
 * heading: it sticks to the underside of the header once the grid scrolls up
 * to it, so the shopper can still change department after scrolling a long way
 * down. It scrolls sideways under a finger, and a sideways swipe across the
 * grid steps between departments too, which is how a shopper expects a row of
 * tabs to behave on a phone. */
export default function FeaturedProducts({
  featured,
  catalog,
  wishlistIds = [],
  isSignedIn = false,
}: {
  featured: StoreProductCard[];
  catalog: StoreProductCard[];
  wishlistIds?: string[];
  isSignedIn?: boolean;
}) {
  const [activeFilter, setActiveFilter] = useState<ProductFilter>("All");
  const { query } = useProductSearch();
  const tabsRef = useRef<HTMLDivElement | null>(null);
  const wishlistSet = new Set(wishlistIds);

  const search = query.trim().toLowerCase();

  // Keep the selected chip in view, whether it was tapped or reached by
  // swiping the grid. The container is scrolled directly instead of calling
  // `scrollIntoView`, which would also scroll the page vertically and fight
  // the sticky bar the chip is sitting in.
  useEffect(() => {
    const row = tabsRef.current;
    const chip = row?.querySelector<HTMLElement>(`[data-filter="${activeFilter}"]`);
    if (!row || !chip) return;
    row.scrollTo({
      left: Math.max(0, chip.offsetLeft - (row.clientWidth - chip.clientWidth) / 2),
      behavior: "smooth",
    });
  }, [activeFilter]);

  /** Steps one chip left or right, stopping at the ends. */
  function stepFilter(direction: 1 | -1) {
    const index = productFilters.findIndex((filter) => filter.id === activeFilter);
    const next = productFilters[index + direction];
    if (next) setActiveFilter(next.id);
  }

  // A swipe is only a swipe once it is clearly sideways and has travelled far
  // enough; anything else is the shopper scrolling the page, which must not
  // change department under them. `handled` fires the step once per gesture.
  const swipe = useRef<{ x: number; y: number; handled: boolean } | null>(null);

  function onTouchStart(event: React.TouchEvent) {
    const touch = event.touches[0];
    swipe.current = { x: touch.clientX, y: touch.clientY, handled: false };
  }

  function onTouchMove(event: React.TouchEvent) {
    const start = swipe.current;
    if (!start || start.handled) return;
    const touch = event.touches[0];
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      start.handled = true;
      stepFilter(dx < 0 ? 1 : -1);
    }
  }

  function onTouchEnd() {
    swipe.current = null;
  }

  // Featured first, then the rest of the shop. The two curated products stay
  // at the top of the grid where the design puts them, and everything else
  // follows so the page has somewhere to scroll to instead of ending after
  // one row. It also means a chip like "Women" has real products to show
  // rather than an empty grid.
  const featuredIds = new Set(featured.map((product) => product.id));
  const source = [...featured, ...catalog.filter((product) => !featuredIds.has(product.id))];

  const active = productFilters.find((filter) => filter.id === activeFilter);
  const byCategory =
    !active || active.categoryIds.length === 0
      ? source
      : source.filter(
          (product) =>
            product.categoryId !== null && active.categoryIds.includes(product.categoryId)
        );

  const visible = search
    ? byCategory.filter((product) => product.name.toLowerCase().includes(search))
    : byCategory;

  return (
    <section className="pt-2.5">
      <div className="flex items-center justify-between gap-2 px-3.5">
        <h2 className="flex shrink-0 items-center gap-1 text-[11px] font-bold text-ink">
          <Flame className="h-3 w-3 fill-accent-amber text-accent-amber" />
          Featured Products
        </h2>

        <Link
          href="/offers"
          className="flex shrink-0 items-center gap-0.5 text-[10px] font-semibold text-brand"
        >
          View All
          <ChevronRight className="h-2.5 w-2.5" strokeWidth={3} />
        </Link>
      </div>

      {/* Pinned right below the folded header. The offset is the header's own
          collapsed height, so the two bars meet with no gap and no overlap. */}
      <div
        style={{ top: COLLAPSED_HEIGHT }}
        className="sticky z-30 mt-1.5 border-b border-brand-tint bg-white/95 backdrop-blur-sm"
      >
        <div
          ref={tabsRef}
          className="no-scrollbar flex items-center gap-1.5 overflow-x-auto px-3.5 py-2"
        >
          {productFilters.map((filter) => {
            const isActive = filter.id === activeFilter;
            return (
              <button
                key={filter.id}
                type="button"
                data-filter={filter.id}
                onClick={() => setActiveFilter(filter.id)}
                aria-pressed={isActive}
                className={`shrink-0 rounded-full px-3 py-[5px] text-[10px] font-semibold transition-colors duration-150 ${
                  isActive
                    ? "bg-brand text-white shadow-sm"
                    : "bg-brand-mist text-ink-muted"
                }`}
              >
                {filter.id}
              </button>
            );
          })}
        </div>
      </div>

      <div
        className="px-3.5"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
      >
        {visible.length === 0 ? (
          <p className="py-5 text-center text-[10px] text-ink-muted">
            {search ? `No products match “${query.trim()}”.` : "Nothing in this filter yet."}
          </p>
        ) : (
          <div className="mt-2 grid grid-cols-2 gap-1.5">
            {visible.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                isWishlisted={wishlistSet.has(product.id)}
                isSignedIn={isSignedIn}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
