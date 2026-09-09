"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronRight, Tag } from "lucide-react";
import type { CategoryOverview } from "@/lib/categories";
import { formatPrice } from "@/lib/format";

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
}: {
  categories: CategoryOverview[];
}) {
  const [activeId, setActiveId] = useState(categories[0]?.id ?? "");
  const active = categories.find((category) => category.id === activeId) ?? categories[0];

  if (!active) return null;

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Department rail */}
      <nav
        aria-label="Categories"
        className="w-[88px] shrink-0 overflow-y-auto border-r border-neutral-200 bg-[#f3f5f4] no-scrollbar"
      >
        {categories.map((category) => {
          const isActive = category.id === active.id;
          return (
            <button
              key={category.id}
              onClick={() => setActiveId(category.id)}
              aria-current={isActive ? "true" : undefined}
              className={`relative flex w-full flex-col items-center gap-1 px-1.5 py-2.5 text-center transition-colors ${
                isActive ? "bg-white" : "bg-transparent"
              }`}
            >
              {isActive && (
                <span className="absolute left-0 top-1/2 h-7 w-[3px] -translate-y-1/2 rounded-r bg-brand" />
              )}
              <span
                className={`relative h-9 w-9 overflow-hidden rounded-full bg-neutral-100 ring-2 ${
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
                className={`text-[9px] leading-tight ${
                  isActive ? "font-semibold text-brand" : "text-neutral-500"
                }`}
              >
                {category.name}
              </span>
            </button>
          );
        })}
      </nav>

      {/* Selected department */}
      <div className="flex-1 overflow-y-auto bg-white px-3 pb-6 pt-3 no-scrollbar">
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <h2 className="truncate text-[13px] font-bold text-neutral-800">{active.name}</h2>
            <p className="text-[9.5px] text-neutral-400">
              {active.productCount} {active.productCount === 1 ? "product" : "products"}
              {active.fromPrice !== null && ` · from ${formatPrice(active.fromPrice)}`}
            </p>
          </div>
          <Link
            href={`/category/${active.id}`}
            className="flex shrink-0 items-center gap-0.5 text-[10px] font-semibold text-brand"
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
            <span className="text-[10.5px] font-bold">
              Up to {active.bestDiscount}% off in {active.name}
            </span>
            <ChevronRight className="ml-auto h-3 w-3 shrink-0" />
          </Link>
        )}

        {active.subcategories.length > 0 && (
          <>
            <h3 className="mt-3 text-[10px] font-semibold uppercase tracking-wide text-neutral-400">
              Shop by type
            </h3>
            <div className="mt-1.5 grid grid-cols-3 gap-2">
              {active.subcategories.map((sub) => (
                <Link
                  key={sub.id}
                  href={`/category/${active.id}?sub=${sub.id}`}
                  className="group flex flex-col items-center gap-1 text-center"
                >
                  <span className="relative aspect-square w-full overflow-hidden rounded-lg bg-neutral-100">
                    <Image
                      src={sub.image}
                      alt=""
                      fill
                      sizes="90px"
                      className="object-cover"
                    />
                    {sub.productCount > 0 && (
                      <span className="absolute bottom-0.5 right-0.5 rounded bg-black/55 px-1 text-[8px] font-semibold text-white">
                        {sub.productCount}
                      </span>
                    )}
                  </span>
                  <span className="text-[9.5px] font-medium leading-tight text-neutral-700">
                    {sub.name}
                  </span>
                </Link>
              ))}
            </div>
          </>
        )}

        {active.highlights.length > 0 && (
          <>
            <h3 className="mt-4 text-[10px] font-semibold uppercase tracking-wide text-neutral-400">
              Popular in {active.name}
            </h3>
            <div className="mt-1.5 flex gap-2 overflow-x-auto pb-1 no-scrollbar">
              {active.highlights.map((product) => (
                <Link
                  key={product.id}
                  href={`/product/${product.id}`}
                  className="w-[84px] shrink-0"
                >
                  <span className="relative block h-[84px] w-full overflow-hidden rounded-lg bg-neutral-100">
                    <Image
                      src={product.image}
                      alt={product.name}
                      fill
                      sizes="84px"
                      className="object-cover"
                    />
                    {product.discountPercent > 0 && (
                      <span className="absolute left-1 top-1 rounded bg-accent-red px-1 text-[8px] font-bold text-white">
                        -{product.discountPercent}%
                      </span>
                    )}
                  </span>
                  <span className="mt-1 block truncate text-[9.5px] font-medium text-neutral-700">
                    {product.name}
                  </span>
                  <span className="block text-[10px] font-bold text-neutral-900">
                    {formatPrice(product.price)}
                  </span>
                </Link>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
