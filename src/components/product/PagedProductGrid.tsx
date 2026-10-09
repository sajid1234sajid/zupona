"use client";

import { useCallback, useState } from "react";
import MasonryGrid from "@/components/product/MasonryGrid";
import type { ProductSummary } from "@/types";

/** A product grid that mounts a page of cards at a time.
 *
 * Every `ProductCard` is a client component with its own wishlist and cart
 * state, so a grid that renders the whole list blocks the main thread while it
 * hydrates -- which is what made the tab bar ignore the first tap on the home
 * page until the work was finished. `FeaturedProducts` solves that for the home
 * grid, where the paging has to live alongside the chips and the search box.
 * This is the same idea for the pages that only ever show one plain list.
 *
 * The whole list still arrives from the server, so nothing is fetched again as
 * it grows; it is only how many of them are mounted that changes. */
export default function PagedProductGrid({
  products,
  wishlistIds,
  isSignedIn,
  pageSize = 8,
  className = "mt-3 tab:mt-5",
}: {
  products: ProductSummary[];
  wishlistIds: string[];
  isSignedIn: boolean;
  pageSize?: number;
  className?: string;
}) {
  const [shown, setShown] = useState(pageSize);
  const wishlistSet = new Set(wishlistIds);

  const visible = products.slice(0, shown);
  const hasMore = shown < products.length;

  // The sentinel sits under the last card. `rootMargin` starts the next page
  // while it is still a screen away, so the grid is already longer by the time
  // the shopper reaches the bottom and it never looks like it ran out.
  const sentinelRef = useCallback((node: HTMLDivElement | null) => {
    if (!node || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShown((current) => current + pageSize);
        }
      },
      { rootMargin: "800px 0px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
    // `pageSize` is fixed per call site; the observer is rebuilt if it ever is not.
  }, [pageSize]);

  return (
    <>
      <MasonryGrid
        products={visible}
        wishlistIds={wishlistSet}
        isSignedIn={isSignedIn}
        className={className}
      />
      {hasMore && <div ref={sentinelRef} aria-hidden className="h-1 w-full" />}
    </>
  );
}
