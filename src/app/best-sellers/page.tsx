import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Trophy } from "lucide-react";
import ProductHeader from "@/components/layout/ProductHeader";
import DesktopHeader from "@/components/layout/DesktopHeader";
import BottomNav from "@/components/layout/BottomNav";
import SiteFooter from "@/components/layout/SiteFooter";
import PagedProductGrid from "@/components/product/PagedProductGrid";
import ListingFilterBar from "@/components/listing/ListingFilterBar";
import { listStoreCategories, listStoreProducts } from "@/lib/storefront";
import { applyListing } from "@/lib/listing";
import { parseListing } from "@/lib/listingParams";
import { BEST_SELLER_WINDOWS, unitsSold, type BestSellerWindow } from "@/lib/bestSellers";
import { toSummary } from "@/lib/categories";
import { getCurrentUser } from "@/lib/session";
import { getWishlistProductIds } from "@/lib/wishlist";

export const metadata: Metadata = {
  title: "Best Sellers — Zupona",
  description:
    "The products Zupona customers are buying most, over the last 30, 14 or 7 days. Cash on Delivery all over Bangladesh.",
  alternates: { canonical: "/best-sellers" },
};

type Params = Record<string, string | string[] | undefined>;

/** What is selling, counted from real orders: units on orders placed in the
 * window, leaving out cancelled and returned ones (see `src/lib/bestSellers.ts`).
 * Only products that sold in the window are listed, best first, and the top
 * ten carry their place on the photo. */
export default async function BestSellersPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const rawDays = Number(Array.isArray(params.days) ? params.days[0] : params.days);
  const days: BestSellerWindow = (BEST_SELLER_WINDOWS as readonly number[]).includes(rawDays)
    ? (rawDays as BestSellerWindow)
    : 30;
  const filters = { ...parseListing(params, "relevance"), q: "" };

  const [units, catalog, categories, user] = await Promise.all([
    unitsSold(days),
    listStoreProducts({ sort: "popular" }),
    listStoreCategories(),
    getCurrentUser(),
  ]);

  // Best first; the catalog's popular order breaks ties.
  const ranked = catalog
    .filter((product) => (units[product.id] ?? 0) > 0)
    .sort((a, b) => (units[b.id] ?? 0) - (units[a.id] ?? 0));
  const place = new Map(ranked.map((product, i) => [product.id, i + 1]));

  const [{ items, facets }, wishlistIds] = await Promise.all([
    applyListing(ranked, filters, categories),
    getWishlistProductIds(user?.id ?? null),
  ]);

  const keepParams = days === 30 ? "" : `days=${days}`;
  // The overall place, not the place within a filter: "#1" means the best
  // seller in the shop, whatever is ticked.
  const summaries = items.map((product) => {
    const rank = place.get(product.id) ?? 0;
    return { ...toSummary(product), listRank: rank > 0 && rank <= 10 ? rank : undefined };
  });

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-white pb-20 tab:max-w-none tab:pb-0">
      <div className="tab:hidden">
        <ProductHeader />
      </div>
      <DesktopHeader />

      <main className="flex-1 px-4 pt-3 tab:mx-auto tab:w-full tab:max-w-shell tab:px-6 tab:pt-5">
        <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-[11.5px] text-ink-muted">
          <Link href="/" className="hover:text-brand-darkest">
            Home
          </Link>
          <ChevronRight className="h-3 w-3" strokeWidth={2.5} />
          <span className="text-ink">Best sellers</span>
        </nav>

        <h1 className="mt-2 flex items-center gap-2 text-lg font-bold text-heading tab:text-2xl">
          <Trophy className="h-6 w-6 text-rating" /> Best sellers
        </h1>
        <p className="mt-0.5 text-[12px] text-ink-slate tab:text-sm">
          What customers bought most, from real orders.
        </p>

        <div role="tablist" aria-label="Time period" className="mt-4 flex gap-1 border-b border-line-soft">
          {BEST_SELLER_WINDOWS.map((window) => {
            const active = window === days;
            return (
              <Link
                key={window}
                role="tab"
                aria-selected={active}
                href={window === 30 ? "/best-sellers" : `/best-sellers?days=${window}`}
                scroll={false}
                className={`-mb-px border-b-2 px-3.5 py-2.5 text-[13px] font-semibold tab:px-5 tab:text-sm ${
                  active ? "border-brand text-brand-dark" : "border-transparent text-ink-muted hover:text-ink"
                }`}
              >
                Last {window} days
              </Link>
            );
          })}
        </div>

        {ranked.length > 0 ? (
          <div className="mt-3">
            <ListingFilterBar
              basePath="/best-sellers"
              keepParams={keepParams}
              filters={filters}
              facets={facets}
              total={items.length}
              relevanceLabel="Best selling"
            />
          </div>
        ) : null}

        {summaries.length > 0 ? (
          <PagedProductGrid
            key={JSON.stringify(params)}
            products={summaries}
            wishlistIds={[...wishlistIds]}
            isSignedIn={Boolean(user)}
            pageSize={20}
          />
        ) : (
          <div className="mt-12 flex flex-col items-center gap-3 text-center">
            <span className="grid h-16 w-16 place-items-center rounded-full bg-brand-tint">
              <Trophy className="h-7 w-7 text-brand" />
            </span>
            <p className="text-sm font-semibold text-ink">
              {ranked.length > 0 ? "No best sellers match these filters" : `No sales in the last ${days} days yet`}
            </p>
            <Link
              href={ranked.length > 0 ? `/best-sellers${keepParams ? `?${keepParams}` : ""}` : "/categories"}
              className="mt-1 rounded-full bg-brand px-6 py-2.5 text-sm font-semibold text-white"
            >
              {ranked.length > 0 ? "Clear filters" : "Browse categories"}
            </Link>
          </div>
        )}
      </main>

      <SiteFooter />
      <BottomNav />
    </div>
  );
}
