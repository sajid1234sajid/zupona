"use client";

import { useState } from "react";
import Link from "next/link";
import { Flame, ChevronRight } from "lucide-react";
import { productFilters } from "@/data/productFilters";
import type { ProductFilter } from "@/types";
import type { StoreProductCard } from "@/lib/storefront";
import { useProductSearch } from "@/components/search/SearchProvider";
import ProductCard from "./ProductCard";

/** The featured grid, its chips and the header's search results.
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
 * category, and can never show up under the wrong one. */
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
  const wishlistSet = new Set(wishlistIds);

  const search = query.trim().toLowerCase();

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
    <section className="px-3.5 pt-2.5">
      <div className="flex items-center gap-1.5">
        <h2 className="flex shrink-0 items-center gap-1 text-[10px] font-bold text-ink">
          <Flame className="h-3 w-3 fill-accent-amber text-accent-amber" />
          Featured Products
        </h2>

        <div className="no-scrollbar flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
          {productFilters.map((filter) => {
            const isActive = filter.id === activeFilter;
            return (
              <button
                key={filter.id}
                type="button"
                onClick={() => setActiveFilter(filter.id)}
                aria-pressed={isActive}
                // Only the selected chip is a filled pill. Leaving the rest
                // as plain labels is what lets all five sit on one line beside
                // the heading at phone width.
                className={`shrink-0 rounded-full py-[3px] text-[8px] font-semibold transition-colors ${
                  isActive ? "bg-brand px-2 text-white" : "px-1 text-ink-muted"
                }`}
              >
                {filter.id}
              </button>
            );
          })}
        </div>

        <Link
          href="/offers"
          className="flex shrink-0 items-center gap-0.5 text-[8px] font-semibold text-brand"
        >
          View All
          <ChevronRight className="h-2.5 w-2.5" strokeWidth={3} />
        </Link>
      </div>

      {visible.length === 0 ? (
        <p className="py-5 text-center text-[9px] text-ink-muted">
          {search
            ? `No products match “${query.trim()}”.`
            : "Nothing in this filter yet."}
        </p>
      ) : (
        <div className="mt-1.5 grid grid-cols-2 gap-1.5">
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
    </section>
  );
}
