import type { Metadata } from "next";
import Link from "next/link";
import { cache } from "react";
import { ChevronRight, LayoutGrid, SearchX, TrendingUp } from "lucide-react";
import ProductHeader from "@/components/layout/ProductHeader";
import DesktopHeader from "@/components/layout/DesktopHeader";
import BottomNav from "@/components/layout/BottomNav";
import SiteFooter from "@/components/layout/SiteFooter";
import PagedProductGrid from "@/components/product/PagedProductGrid";
import ListingFilterBar from "@/components/listing/ListingFilterBar";
import PixelEvent from "@/components/analytics/PixelEvent";
import { listStoreCategories, listStoreProducts } from "@/lib/storefront";
import { categoryWordsOf, searchCatalog, searchTerms } from "@/lib/productSearch";
import { applyListing } from "@/lib/listing";
import { hasFilters, listingQuery, parseListing } from "@/lib/listingParams";
import { getPopularSearches, logSearch } from "@/lib/searchInsights";
import { toSummary } from "@/lib/categories";
import { getCurrentUser } from "@/lib/session";
import { getWishlistProductIds } from "@/lib/wishlist";

type Params = Record<string, string | string[] | undefined>;

/** One search per request: the metadata needs to know whether anything was
 * found (an empty results page is not worth indexing) and the page needs the
 * results themselves. */
const runSearch = cache(async (raw: string) => {
  const filters = parseListing(Object.fromEntries(new URLSearchParams(raw)));
  const [catalog, categories] = await Promise.all([
    listStoreProducts({ sort: "popular" }),
    listStoreCategories(),
  ]);
  const terms = searchTerms(filters.q);
  const { products, corrected } = terms.length
    ? searchCatalog(catalog, terms, categoryWordsOf(categories))
    : { products: catalog, corrected: null };
  const listing = await applyListing(products, filters, categories);
  return { filters, categories, corrected, matched: products.length, ...listing };
});

function rawQuery(params: Params): string {
  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    const value = Array.isArray(v) ? v[0] : v;
    if (value !== undefined) search.set(k, value);
  }
  return search.toString();
}

export async function generateMetadata({ searchParams }: { searchParams: Promise<Params> }): Promise<Metadata> {
  const params = await searchParams;
  const { filters, items } = await runSearch(rawQuery(params));
  const title = filters.q ? `${filters.q} — Search results | Zupona` : "Search — Zupona";
  return {
    title,
    description: filters.q
      ? `Shop ${filters.q} on Zupona. Cash on Delivery all over Bangladesh.`
      : "Search products on Zupona.",
    // Only the plain search for a word that found products is worth a
    // search engine's time; a filtered or empty one is noise in its index.
    robots:
      !filters.q || items.length === 0 || hasFilters(filters)
        ? { index: false, follow: true }
        : undefined,
    alternates: filters.q ? { canonical: `/search?q=${encodeURIComponent(filters.q)}` } : undefined,
  };
}

export default async function SearchPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const [result, user, popular] = await Promise.all([
    runSearch(rawQuery(params)),
    getCurrentUser(),
    getPopularSearches(10),
  ]);
  const { filters, items, facets, corrected, categories } = result;

  const filtered = hasFilters(filters);
  // Log the search as typed, once: a filter click on the same results is not
  // a new search, and counting it would skew what shoppers look for.
  const wishlist = await Promise.all([
    getWishlistProductIds(user?.id ?? null),
    filters.q && !filtered && filters.sort === "relevance"
      ? // The corrected spelling when there was one: "shrt" found shirts, so
        // what the shopper wanted -- and what "Popular" should show -- is "shirt".
        logSearch(corrected ?? filters.q, result.matched, user?.id ?? null)
      : Promise.resolve(),
  ]).then(([ids]) => ids);

  const heading = filters.q
    ? `${items.length} result${items.length === 1 ? "" : "s"} for “${filters.q}”`
    : "All products";

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
          <span className="text-ink">Search</span>
        </nav>

        <h1 className="mt-2 text-lg font-bold text-heading tab:text-2xl">{heading}</h1>
        {corrected ? (
          <p className="mt-1 text-[13px] text-ink-slate">
            No exact match for “{filters.q}”. Showing results for{" "}
            <Link
              href={`/search?${listingQuery({ ...filters, q: corrected })}`}
              className="font-bold text-brand hover:underline"
            >
              {corrected}
            </Link>
            .
          </p>
        ) : null}

        {filters.q ? <PixelEvent event="Search" params={{ search_string: filters.q }} /> : null}

        {result.matched > 0 ? (
          <div className="mt-3 tab:mt-4">
            <ListingFilterBar basePath="/search" filters={filters} facets={facets} total={items.length} />
          </div>
        ) : null}

        {items.length > 0 ? (
          // Keyed by the query so a new search starts from the first page.
          <PagedProductGrid
            key={rawQuery(params)}
            products={items.map(toSummary)}
            wishlistIds={[...wishlist]}
            isSignedIn={Boolean(user)}
            pageSize={20}
          />
        ) : result.matched > 0 ? (
          <Empty
            title="No products match these filters"
            body="Try removing a filter or two."
            action={{ href: `/search?${listingQuery({ ...filters, category: null, price: null, sizes: [], colors: [], brands: [], deals: false, freeDelivery: false, rating4: false })}`, label: "Clear filters" }}
          />
        ) : (
          <>
            <Empty
              title={filters.q ? `Nothing found for “${filters.q}”` : "What are you looking for?"}
              body={filters.q ? "Check the spelling, try a more general word, or try one of these:" : "Try one of these:"}
            />
            {/* Until the shop has search traffic, its departments stand in. */}
            <PopularChips
              terms={popular.length > 0 ? popular : categories.slice(0, 8).map((c) => c.name)}
            />
            <div className="mt-6 flex justify-center">
              <Link
                href="/categories"
                className="inline-flex h-11 items-center gap-2 rounded-full bg-brand px-5 text-[13.5px] font-bold text-white hover:bg-brand-dark"
              >
                <LayoutGrid className="h-4 w-4" /> Browse categories
              </Link>
            </div>
          </>
        )}
      </main>

      <SiteFooter />
      <BottomNav />
    </div>
  );
}

function Empty({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: { href: string; label: string };
}) {
  return (
    <div className="mt-10 flex flex-col items-center gap-2 text-center">
      <span className="grid h-16 w-16 place-items-center rounded-full bg-brand-tint">
        <SearchX className="h-7 w-7 text-brand" />
      </span>
      <p className="text-[15px] font-bold text-heading">{title}</p>
      <p className="max-w-sm text-[13px] text-ink-slate">{body}</p>
      {action ? (
        <Link
          href={action.href}
          className="mt-2 rounded-full bg-brand px-5 py-2.5 text-[13px] font-bold text-white"
        >
          {action.label}
        </Link>
      ) : null}
    </div>
  );
}

function PopularChips({ terms }: { terms: string[] }) {
  if (terms.length === 0) return null;
  return (
    <div className="mx-auto mt-4 flex max-w-xl flex-wrap justify-center gap-2">
      {terms.map((term) => (
        <Link
          key={term}
          href={`/search?q=${encodeURIComponent(term)}`}
          prefetch={false}
          className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line bg-white px-3.5 text-[13px] font-semibold text-ink hover:border-brand"
        >
          <TrendingUp className="h-3.5 w-3.5 text-urgency" />
          {term}
        </Link>
      ))}
    </div>
  );
}
