"use client";

import { useState } from "react";
import Image from "@/components/ui/StoreImage";
import Link from "next/link";
import { ChevronRight, Tag } from "lucide-react";
import type { CategoryOverview } from "@/lib/categories";
import { formatPrice } from "@/lib/format";
import ProductCard from "@/components/home/ProductCard";

/** Two-pane category browser: a fixed rail of departments on the left, the
 * selected department's subcategories on the right.
 *
 * This is the shape Daraz and Alibaba both use on mobile, and it is the one
 * that survives a 448px shell: the rail keeps the shopper's place in the
 * taxonomy visible while the right pane changes, so tapping around costs no
 * navigation. A flat accordion (Amazon's mobile pattern) hides that context
 * as soon as a section opens.
 *
 * Switching departments is local state, not a route change — the whole tree is
 * already on the client, so a round trip would only add latency. Committing to
 * a department (a subcategory tile, "View all") is a real navigation to
 * /category/[slug], which is where filtering and sorting live.
 */
export default function CategoryBrowser({
  categories,
  wishlistIds = [],
  isSignedIn = false,
}: {
  categories: CategoryOverview[];
  wishlistIds?: string[];
  isSignedIn?: boolean;
}) {
  const [activeId, setActiveId] = useState(categories[0]?.id ?? "");
  const wishlistSet = new Set(wishlistIds);
  const active = categories.find((category) => category.id === activeId) ?? categories[0];

  if (!active) return null;

  return (
    // From the `tab` breakpoint up the two panes become cards side by side
    // inside the page's measure; below it this is the phone layout unchanged.
    <div className="flex flex-1 overflow-hidden tab:mx-auto tab:w-full tab:max-w-shell tab:gap-5 tab:px-6 tab:py-5">
      {/* Department rail */}
      <nav
        aria-label="Categories"
        className="w-[88px] shrink-0 overflow-y-auto border-r border-line bg-brand-mist no-scrollbar tab:w-[230px] tab:rounded-2xl tab:border tab:bg-white tab:py-2"
      >
        {categories.map((category) => {
          const isActive = category.id === active.id;
          return (
            <button
              key={category.id}
              onClick={() => setActiveId(category.id)}
              aria-current={isActive ? "true" : undefined}
              className={`relative flex w-full flex-col items-center gap-1 px-1.5 py-2.5 text-center transition-colors tab:flex-row tab:gap-3 tab:px-4 tab:py-2 tab:text-left ${
                isActive ? "bg-white tab:bg-brand-mist" : "bg-transparent tab:hover:bg-brand-mist/60"
              }`}
            >
              {isActive && (
                <span className="absolute left-0 top-1/2 h-7 w-[3px] -translate-y-1/2 rounded-r bg-brand" />
              )}
              <span
                className={`relative h-9 w-9 shrink-0 overflow-hidden rounded-full bg-brand-mist ring-2 ${
                  isActive ? "ring-brand" : "ring-transparent"
                }`}
              >
                <Image
                  src={category.image}
                  alt=""
                  fill
                  sizes="36px"
                  className="object-cover"
                />
              </span>
              <span
                className={`text-[9px] leading-tight tab:text-[13px] ${
                  isActive ? "font-semibold text-brand" : "text-ink-slate"
                }`}
              >
                {category.name}
              </span>
            </button>
          );
        })}
      </nav>

      {/* Selected department */}
      <div className="flex-1 overflow-y-auto bg-white px-3 pb-6 pt-3 no-scrollbar tab:rounded-2xl tab:border tab:border-line tab:px-6 tab:pt-5">
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <h2 className="truncate text-[13px] font-bold text-heading tab:text-xl">{active.name}</h2>
            <p className="text-[9.5px] text-ink-slate tab:text-sm">
              {active.productCount} {active.productCount === 1 ? "product" : "products"}
              {active.fromPrice !== null && ` · from ${formatPrice(active.fromPrice)}`}
            </p>
          </div>
          <Link
            href={`/category/${active.id}`}
            className="flex shrink-0 items-center gap-0.5 text-[10px] font-semibold text-brand tab:text-sm"
          >
            View all
            <ChevronRight className="h-3 w-3" />
          </Link>
        </div>

        {active.bestDiscount > 0 && (
          <Link
            href={`/category/${active.id}?sort=discount`}
            className="mt-2 flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-accent-orange to-accent-orange-dark px-2.5 py-1.5 text-white"
          >
            <Tag className="h-3.5 w-3.5 shrink-0" />
            <span className="text-[10.5px] font-bold tab:text-sm">
              Up to {active.bestDiscount}% off in {active.name}
            </span>
            <ChevronRight className="ml-auto h-3 w-3 shrink-0" />
          </Link>
        )}

        {active.subcategories.length > 0 && (
          <>
            <h3 className="mt-3 text-[10px] font-semibold uppercase tracking-wide text-ink-slate tab:mt-6 tab:text-xs">
              Shop by type
            </h3>
            <div className="mt-1.5 grid grid-cols-3 gap-2 tab:mt-3 tab:grid-cols-4 tab:gap-4 lg:grid-cols-6">
              {active.subcategories.map((sub) => (
                <Link
                  key={sub.id}
                  href={`/category/${active.id}?sub=${sub.id}`}
                  className="group flex flex-col items-center gap-1 text-center"
                >
                  <span className="relative aspect-square w-full overflow-hidden rounded-lg bg-brand-mist">
                    <Image
                      src={sub.image}
                      alt=""
                      fill
                      sizes="(min-width: 700px) 160px, 90px"
                      className="object-cover"
                    />
                    {sub.productCount > 0 && (
                      <span className="absolute bottom-0.5 right-0.5 rounded bg-black/55 px-1 text-[10px] font-semibold text-white">
                        {sub.productCount}
                      </span>
                    )}
                  </span>
                  <span className="text-[9.5px] font-medium leading-tight text-ink tab:text-[13px]">
                    {sub.name}
                  </span>
                </Link>
              ))}
            </div>
          </>
        )}

        {active.highlights.length > 0 && (
          <>
            <h3 className="mt-4 text-[10px] font-semibold uppercase tracking-wide text-ink-slate tab:mt-7 tab:text-xs">
              Popular in {active.name}
            </h3>
            <div className="mt-1.5 grid grid-cols-2 gap-2 tab:mt-3 tab:grid-cols-3 tab:gap-3 lg:grid-cols-4">
              {active.highlights.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  isWishlisted={wishlistSet.has(product.id)}
                  isSignedIn={isSignedIn}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
