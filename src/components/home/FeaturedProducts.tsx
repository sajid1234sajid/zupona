"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronRight, Clock, Search, Sparkles } from "lucide-react";
import { productFilters } from "@/data/productFilters";
import type { ProductFilter } from "@/types";
import type { StoreProductCard } from "@/lib/storefront";
import { useProductSearch } from "@/components/search/SearchProvider";
import { searchProducts, searchTerms, type CategoryWords } from "@/lib/productSearch";
import { COLLAPSED_HEIGHT } from "@/components/layout/StickyHeader";
import MasonryGrid from "@/components/product/MasonryGrid";
import ProductRail from "@/components/home/ProductRail";
import { toSummary } from "@/lib/summary";
import { readViewed, type ViewedEntry } from "@/lib/viewedProducts";

/** The first chip orders the whole shop by what is likely to interest this
 * shopper rather than listing it; the rest are departments. */
const CHIP_LABEL: Partial<Record<ProductFilter, string>> = { All: "Recommended" };

/** A department chip needs this many products to be worth a tab. */
const MIN_CHIP_PRODUCTS = 4;

/** Remembers the tab and how far the grid had grown, so Back from a product
 * lands where the shopper left instead of at the top of "Recommended". */
const STATE_KEY = "zupona.homeFeed";
const RETURN_KEY = "zupona.homeFeedY";

/** Recommended, v1, without machine learning: sales, rating weighted by how
 * many people gave it, the discount, and -- once the browser has a history --
 * whether it is in a department this shopper has been looking at. */
function recommendedScore(
  product: StoreProductCard,
  maxSold: number,
  maxRating: number,
  viewedDepartments: Set<string>
): number {
  const sold = maxSold > 0 ? product.soldCount / maxSold : 0;
  const rating = maxRating > 0 ? (product.rating * Math.log1p(product.reviews)) / maxRating : 0;
  const viewed = product.categoryId && viewedDepartments.has(product.categoryId) ? 1 : 0;
  return 0.45 * sold + 0.25 * rating + 0.2 * viewed + 0.1 * (product.discountPercent / 100);
}

/** The featured grid, its filter row and the header's search results.
 *
 * Two collections arrive from the server. `featured` is the products a
 * shopkeeper ticked "Featured" on; they lead the grid, which is what makes the
 * top row curated rather than whatever sorted first. `catalog` is the rest of
 * the shop, shown underneath, so the page keeps going past the first row and
 * every chip has something to show.
 *
 * The chips filter on `categoryId`, the department id the database assigns
 * each product. Nothing a chip does matches on a product's name, so a product
 * uploaded later lands under the right chip purely from its category, and can
 * never show up under the wrong one. The header's search matches words through
 * `src/lib/productSearch.ts` -- name, brand, tags and department -- the same
 * as the search sheet on every other page.
 *
 * The grid mounts a page of cards at a time rather than the whole shop. Every
 * card is a client component with its own wishlist state, and hydrating forty
 * of them blocked the main thread for a full second on a mid-range phone --
 * measured at 4x CPU throttling, the tab bar did not answer a tap until 2.7s
 * after load, which is what made the first press of a tab feel dead. The
 * catalog still arrives whole, so searching and the chips still filter the
 * entire shop instantly; it is only how many of the results are on screen at
 * once that grows, and it grows as the shopper scrolls toward the end.
 *
 * The chip row is a bar of its own rather than an afterthought beside the
 * heading: it sticks to the underside of the header once the grid scrolls up
 * to it, so the shopper can still change department after scrolling a long way
 * down. It scrolls sideways under a finger, and a sideways swipe across the
 * grid steps between departments too, which is how a shopper expects a row of
 * tabs to behave on a phone. */
/** How many cards are mounted at a time.
 *
 * Eight is two rows on a phone and fills the first screen below the chips;
 * anything more is work done for a shopper who has not scrolled yet. */
const PAGE_SIZE = 8;

export default function FeaturedProducts({
  featured,
  catalog,
  categoryWords,
  wishlistIds = [],
  isSignedIn = false,
}: {
  featured: StoreProductCard[];
  catalog: StoreProductCard[];
  categoryWords: CategoryWords;
  wishlistIds?: string[];
  isSignedIn?: boolean;
}) {
  const [activeFilter, setActiveFilter] = useState<ProductFilter>("All");
  // This browser's history, read after hydration so the server's render and
  // the first client render agree.
  const [viewed, setViewed] = useState<ViewedEntry[]>([]);
  const { query } = useProductSearch();
  const tabsRef = useRef<HTMLDivElement | null>(null);
  const wishlistSet = new Set(wishlistIds);

  const terms = searchTerms(query);
  const search = terms.join(" ");

  // A search looks through the whole shop. A chip left on "Women" from
  // earlier would otherwise hide a men's shirt the shopper typed the name of,
  // and "nothing found" would be wrong. The chips still narrow the results
  // once they are showing.
  const [wasSearching, setWasSearching] = useState(false);
  if (wasSearching !== Boolean(search)) {
    setWasSearching(Boolean(search));
    if (search) setActiveFilter("All");
  }

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
  const rest = catalog.filter((product) => !featuredIds.has(product.id));

  // Recommended: featured first, then by score, sold-out products left out.
  // The shopper's own history only reorders what lies below the first page,
  // so the cards already on screen never jump when it is read.
  const viewedDepartments = new Set(viewed.map((entry) => entry.c).filter(Boolean) as string[]);
  const maxSold = Math.max(0, ...catalog.map((p) => p.soldCount));
  const maxRating = Math.max(0, ...catalog.map((p) => p.rating * Math.log1p(p.reviews)));
  const scored = (history: Set<string>) =>
    [...rest]
      .filter((product) => product.inStock)
      .sort(
        (a, b) =>
          recommendedScore(b, maxSold, maxRating, history) -
          recommendedScore(a, maxSold, maxRating, history)
      );
  const generic = [...featured.filter((p) => p.inStock), ...scored(new Set())];
  const personal = [...featured.filter((p) => p.inStock), ...scored(viewedDepartments)];
  const head = generic.slice(0, PAGE_SIZE);
  const headIds = new Set(head.map((product) => product.id));
  const recommended = [...head, ...personal.filter((product) => !headIds.has(product.id))];

  // The departments' own lists keep the shop's popular order, sold out last.
  const source = [...featured, ...rest].sort((a, b) => Number(!a.inStock) - Number(!b.inStock));

  const counts = (filter: (typeof productFilters)[number]) =>
    catalog.filter((p) => p.categoryId !== null && filter.categoryIds.includes(p.categoryId)).length;
  const chips = productFilters.filter(
    (filter) =>
      filter.categoryIds.length === 0 || filter.id === activeFilter || counts(filter) >= MIN_CHIP_PRODUCTS
  );

  const active = productFilters.find((filter) => filter.id === activeFilter);
  const byCategory =
    !active || active.categoryIds.length === 0
      ? search
        ? source
        : recommended
      : source.filter(
          (product) =>
            product.categoryId !== null && active.categoryIds.includes(product.categoryId)
        );

  const matching = search ? searchProducts(byCategory, terms, categoryWords) : byCategory;

  // Two rows to begin with; the rest follow the shopper down the page.
  const [shown, setShown] = useState(PAGE_SIZE);

  // A new filter or a new search is a new set of results, and they start at the
  // top -- carrying a long scroll's worth of mounted cards across would put the
  // work back that this exists to avoid. Adjusted during the render that first
  // sees the new results rather than in an effect, so the grid is never painted
  // once at the old length and again at the new one.
  const resultsKey = `${activeFilter} ${search}`;
  const [lastResultsKey, setLastResultsKey] = useState(resultsKey);
  if (lastResultsKey !== resultsKey) {
    setLastResultsKey(resultsKey);
    setShown(PAGE_SIZE);
  }

  // After hydration: this browser's history, and where the shopper was when
  // they last left the page. Deferred a tick so the state change lands in a
  // callback rather than the effect body.
  // Nothing is saved until what was saved before has been read back, or the
  // first render's defaults would overwrite it.
  const restored = useRef(false);
  useEffect(() => {
    const timer = setTimeout(() => {
      restored.current = true;
      setViewed(readViewed());
      try {
        const saved = JSON.parse(window.sessionStorage.getItem(STATE_KEY) ?? "null") as
          | { filter: ProductFilter; shown: number }
          | null;
        if (saved && productFilters.some((filter) => filter.id === saved.filter)) {
          setActiveFilter(saved.filter);
          setLastResultsKey(`${saved.filter} `);
          setShown(Math.max(PAGE_SIZE, Math.min(saved.shown, 200)));
        }
        // Coming back from a product opened in this feed: once the grid has
        // grown back to its length, return to where the shopper was.
        const returnY = Number(window.sessionStorage.getItem(RETURN_KEY));
        window.sessionStorage.removeItem(RETURN_KEY);
        if (returnY > 0) {
          requestAnimationFrame(() =>
            requestAnimationFrame(() => window.scrollTo({ top: returnY, behavior: "instant" }))
          );
        }
      } catch {
        /* nothing saved */
      }
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const visible = matching.slice(0, shown);
  const hasMore = shown < matching.length;

  useEffect(() => {
    if (search || !restored.current) return;
    try {
      window.sessionStorage.setItem(STATE_KEY, JSON.stringify({ filter: activeFilter, shown }));
    } catch {
      /* a convenience */
    }
  }, [activeFilter, shown, search]);

  // "Recently viewed": what this browser looked at, newest first, found in
  // the catalog already on the page so it costs no request.
  const byId = new Map(catalog.map((product) => [product.id, product]));
  const recent = viewed
    .map((entry) => byId.get(entry.id))
    .filter((product): product is StoreProductCard => Boolean(product))
    .slice(0, 12);

  // The sentinel sits under the last card. `rootMargin` starts the next page
  // while it is still a screen away, so the grid is already longer by the time
  // the shopper reaches the bottom and nothing ever looks like it ran out.
  const sentinelRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (!node || typeof IntersectionObserver === "undefined") return;
      const observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) {
            setShown((current) => current + PAGE_SIZE);
          }
        },
        { rootMargin: "800px 0px" }
      );
      observer.observe(node);
      return () => observer.disconnect();
    },
    // A state setter never changes; listed because the compiler asks for it.
    [setShown]
  );

  return (
    <>
      {!search && recent.length >= 2 ? (
        <ProductRail
          id="recently-viewed"
          title="Recently viewed"
          icon={<Clock className="h-4 w-4 text-brand tab:h-5 tab:w-5" />}
          products={recent.map(toSummary)}
          wishlistIds={wishlistIds}
          isSignedIn={isSignedIn}
        />
      ) : null}
      <section className="pt-2.5 tab:pt-8">
        <div className="flex items-center justify-between gap-2 px-3.5 tab:px-0">
          <h2 className="flex shrink-0 items-center gap-1 text-[11px] font-bold text-ink tab:gap-2 tab:text-xl">
            {search ? (
              <>
                <Search className="h-3 w-3 text-brand tab:h-5 tab:w-5" strokeWidth={2.5} />
                {matching.length === 1 ? "1 result" : `${matching.length} results`}
              </>
            ) : (
              <>
                <Sparkles className="h-3.5 w-3.5 text-brand tab:h-5 tab:w-5" />
                Explore your interests
              </>
            )}
          </h2>

          {/* Beside a count of search results, "View All" would read as "all
              the results", which is not where it goes. */}
          {!search && (
            <Link
              href="/offers"
              className="flex shrink-0 items-center gap-0.5 text-[10px] font-semibold text-brand tab:text-sm"
            >
              View All
              <ChevronRight className="h-2.5 w-2.5 tab:h-4 tab:w-4" strokeWidth={3} />
            </Link>
          )}
        </div>

        {/* Pinned right below the folded header. The offset is the header's own
            collapsed height, so the two bars meet with no gap and no overlap. On
            a laptop the pinned header is `DesktopHeader`'s 64px row instead. */}
        <div
          style={{ "--chip-top": `${COLLAPSED_HEIGHT}px` } as React.CSSProperties}
          className="sticky top-[var(--chip-top)] z-30 mt-1.5 border-b border-brand-tint bg-white/95 backdrop-blur-sm tab:top-16 tab:mt-3"
        >
          <div
            ref={tabsRef}
            className="no-scrollbar flex items-center gap-1.5 overflow-x-auto px-3.5 py-2 tab:gap-2 tab:px-0 tab:py-3"
          >
            {chips.map((filter) => {
              const isActive = filter.id === activeFilter;
              return (
                <button
                  key={filter.id}
                  type="button"
                  data-filter={filter.id}
                  onClick={() => setActiveFilter(filter.id)}
                  aria-pressed={isActive}
                  className={`shrink-0 rounded-full px-3 py-[5px] text-[10px] font-semibold transition-colors duration-150 tab:px-4 tab:py-1.5 tab:text-[13px] ${
                    isActive
                      ? "bg-brand text-white shadow-sm"
                      : "bg-brand-mist text-ink-muted"
                  }`}
                >
                  {CHIP_LABEL[filter.id] ?? filter.id}
                </button>
              );
            })}
          </div>
        </div>

        <div
          className="px-3.5 tab:px-0"
          onClickCapture={(event) => {
          // A product opened from here: remember the scroll position to come
          // back to.
          if ((event.target as HTMLElement).closest('a[href^="/products/"]')) {
            try {
              window.sessionStorage.setItem(RETURN_KEY, String(window.scrollY));
            } catch {
              /* a convenience */
            }
          }
        }}
        onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          onTouchCancel={onTouchEnd}
        >
          {matching.length === 0 ? (
            <p className="py-5 text-center text-[10px] text-ink-muted tab:py-10 tab:text-sm">
              {search ? `No products match “${query.trim()}”.` : "Nothing in this filter yet."}
            </p>
          ) : (
            <MasonryGrid
              products={visible}
              wishlistIds={wishlistSet}
              isSignedIn={isSignedIn}
              className="mt-2 tab:mt-4"
            />
          )}

          {hasMore && (
            // Spans the grid so it is crossed however many columns the layout
            // happens to have.
            <div ref={sentinelRef} aria-hidden className="h-1 w-full" />
          )}
          {!hasMore && matching.length > 8 ? (
            // The end of the feed says so, rather than leaving the shopper
            // scrolling into the footer wondering whether more is coming.
            <p className="py-6 text-center text-[12px] text-ink-muted tab:text-sm">
              You&apos;ve seen all {matching.length} products.{" "}
              <button
                type="button"
                onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
                className="font-semibold text-brand"
              >
                Back to top
              </button>
            </p>
          ) : null}
        </div>
      </section>
    </>
  );
}
