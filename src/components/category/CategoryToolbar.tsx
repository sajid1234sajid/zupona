"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpDown, Check, Percent, X } from "lucide-react";
import { CATEGORY_SORTS, type CategorySort } from "@/lib/categorySorts";

/** Sort + "deals only" bar for a category listing.
 *
 * Both controls write to the URL rather than to component state, so a sorted,
 * filtered list is a real address: it survives a back-navigation, a refresh
 * and being shared. The page reads them straight off `searchParams`.
 */
export default function CategoryToolbar({
  basePath,
  sort,
  subcategoryId,
  dealsOnly,
  resultCount,
}: {
  basePath: string;
  sort: CategorySort;
  subcategoryId: string | null;
  dealsOnly: boolean;
  resultCount: number;
}) {
  const router = useRouter();
  const [sheetOpen, setSheetOpen] = useState(false);

  const activeSortLabel =
    CATEGORY_SORTS.find((option) => option.id === sort)?.label ?? "Popular";

  function buildHref(next: { sort?: CategorySort; deals?: boolean }): string {
    const params = new URLSearchParams();
    if (subcategoryId) params.set("sub", subcategoryId);

    const nextSort = next.sort ?? sort;
    if (nextSort !== "popular") params.set("sort", nextSort);

    const nextDeals = next.deals ?? dealsOnly;
    if (nextDeals) params.set("deals", "1");

    const query = params.toString();
    return query ? `${basePath}?${query}` : basePath;
  }

  function applySort(next: CategorySort) {
    setSheetOpen(false);
    router.push(buildHref({ sort: next }), { scroll: false });
  }

  return (
    <>
      <div className="sticky top-0 z-10 -mx-4 flex items-center gap-2 border-b border-line-soft bg-brand-mist/95 px-4 py-2 backdrop-blur">
        <span className="text-[10px] text-ink-slate">
          {resultCount} {resultCount === 1 ? "item" : "items"}
        </span>

        <div className="ml-auto flex items-center gap-1.5">
          <button
            onClick={() => router.push(buildHref({ deals: !dealsOnly }), { scroll: false })}
            aria-pressed={dealsOnly}
            className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-semibold transition-colors ${
              dealsOnly
                ? "border-accent-red bg-accent-red text-white"
                : "border-line bg-white text-ink-slate"
            }`}
          >
            <Percent className="h-3 w-3" />
            Deals only
          </button>

          <button
            onClick={() => setSheetOpen(true)}
            className="flex items-center gap-1 rounded-full border border-line bg-white px-2.5 py-1 text-[10px] font-semibold text-ink-slate"
          >
            <ArrowUpDown className="h-3 w-3" />
            {activeSortLabel}
          </button>
        </div>
      </div>

      {sheetOpen && (
        <div className="fixed inset-0 z-40 flex items-end justify-center">
          <button
            aria-label="Close sort options"
            onClick={() => setSheetOpen(false)}
            className="absolute inset-0 bg-black/40"
          />
          <div className="relative w-full max-w-md rounded-t-2xl bg-white pb-6 pt-3 shadow-xl">
            <div className="flex items-center justify-between px-4 pb-2">
              <p className="text-sm font-bold text-heading">Sort by</p>
              <button aria-label="Close" onClick={() => setSheetOpen(false)}>
                <X className="h-4 w-4 text-ink-slate" />
              </button>
            </div>
            {CATEGORY_SORTS.map((option) => (
              <button
                key={option.id}
                onClick={() => applySort(option.id)}
                className="flex w-full items-center justify-between px-4 py-2.5 text-left text-[13px] text-ink"
              >
                <span className={option.id === sort ? "font-semibold text-brand" : undefined}>
                  {option.label}
                </span>
                {option.id === sort && <Check className="h-4 w-4 text-brand" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
