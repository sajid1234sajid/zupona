import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, PackageSearch } from "lucide-react";
import ProductHeader from "@/components/layout/ProductHeader";
import DesktopHeader from "@/components/layout/DesktopHeader";
import BottomNav from "@/components/layout/BottomNav";
import SiteFooter from "@/components/layout/SiteFooter";
import PagedProductGrid from "@/components/product/PagedProductGrid";
import ListingFilterBar from "@/components/listing/ListingFilterBar";
import JsonLd from "@/components/seo/JsonLd";
import { getCategory, getSubcategory, productsInCategory, toSummary } from "@/lib/categories";
import { applyListing } from "@/lib/listing";
import { clearFilters, hasFilters, listingQuery, parseListing } from "@/lib/listingParams";
import { listStoreCategories } from "@/lib/storefront";
import { getCurrentUser } from "@/lib/session";
import { SITE_URL, shareMetadata } from "@/lib/shareCard";
import { getWishlistProductIds } from "@/lib/wishlist";

type Params = Record<string, string | string[] | undefined>;

const first = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;

export async function generateMetadata({
  params,
  searchParams,
}: PageProps<"/category/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const query = (await searchParams) as Params;
  const category = await getCategory(slug);
  if (!category) return { title: "Category not found — Zupona" };

  const requestedSub = first(query.sub);
  const sub = requestedSub ? await getSubcategory(slug, requestedSub) : undefined;
  const name = sub ? sub.name : category.name;
  const path = sub ? `/category/${slug}?sub=${sub.id}` : `/category/${slug}`;

  const title = `${name} – Buy Online in Bangladesh | Zupona`;
  const description = `${category.subtitle ? `${category.subtitle}. ` : ""}Shop ${name} on Zupona. Cash on Delivery all over Bangladesh.`;

  // The brand card rather than the category's own picture: those are drawn
  // as small chips and look lost at preview size.
  return {
    title,
    description,
    // A filtered or re-sorted list is the same page to a search engine; the
    // plain category address is the one to index.
    alternates: { canonical: path },
    robots: hasFilters(parseListing(query, "relevance")) ? { index: false, follow: true } : undefined,
    ...shareMetadata({ title, description, path }),
  };
}

export default async function CategoryPage({ params, searchParams }: PageProps<"/category/[slug]">) {
  const { slug } = await params;
  const category = await getCategory(slug);
  if (!category) notFound();

  const query = (await searchParams) as Params;

  // An unknown ?sub= is ignored rather than 404'd: a stale link should still
  // land on the category, just unfiltered.
  const requestedSub = first(query.sub);
  const subcategory = requestedSub ? await getSubcategory(slug, requestedSub) : undefined;
  const subcategoryId = subcategory?.id ?? null;

  // The department's own type chips choose the sub-department, so the
  // listing's category filter is not offered here.
  const filters = { ...parseListing(query, "relevance"), category: null, q: "" };

  const [products, categories, user] = await Promise.all([
    productsInCategory({ categoryId: slug, subcategoryId: subcategoryId ?? undefined, sort: "popular" }),
    listStoreCategories(),
    getCurrentUser(),
  ]);
  const [{ items, facets }, wishlistIds] = await Promise.all([
    applyListing(products, filters, categories),
    getWishlistProductIds(user?.id ?? null),
  ]);
  facets.categories = [];

  const basePath = `/category/${slug}`;
  const keepParams = subcategoryId ? `sub=${subcategoryId}` : "";
  const subcategories = (category.subcategories ?? []).filter((sub) => sub.productCount > 0);
  const name = subcategory ? subcategory.name : category.name;

  // Breadcrumbs and the first products, for search engines.
  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
          { "@type": "ListItem", position: 2, name: category.name, item: `${SITE_URL}${basePath}` },
          ...(subcategory
            ? [{ "@type": "ListItem", position: 3, name: subcategory.name, item: `${SITE_URL}${basePath}?sub=${subcategory.id}` }]
            : []),
        ],
      },
      {
        "@type": "ItemList",
        itemListElement: items.slice(0, 24).map((product, i) => ({
          "@type": "ListItem",
          position: i + 1,
          url: `${SITE_URL}/products/${product.slug}`,
          name: product.name,
        })),
      },
    ],
  };

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-white pb-20 tab:max-w-none tab:pb-0">
      <div className="tab:hidden">
        <ProductHeader />
      </div>
      <DesktopHeader />
      <JsonLd data={schema} />

      <main className="flex-1 px-4 pt-3 tab:mx-auto tab:w-full tab:max-w-shell tab:px-6 tab:pt-5">
        <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1 text-[11.5px] text-ink-muted">
          <Link href="/" className="hover:text-brand-darkest">
            Home
          </Link>
          <ChevronRight className="h-3 w-3" strokeWidth={2.5} />
          <Link href="/categories" className="hover:text-brand-darkest">
            Categories
          </Link>
          <ChevronRight className="h-3 w-3" strokeWidth={2.5} />
          {subcategory ? (
            <>
              <Link href={basePath} className="hover:text-brand-darkest">
                {category.name}
              </Link>
              <ChevronRight className="h-3 w-3" strokeWidth={2.5} />
              <span className="text-ink">{subcategory.name}</span>
            </>
          ) : (
            <span className="text-ink">{category.name}</span>
          )}
        </nav>

        <div className="mt-2 flex flex-wrap items-baseline gap-x-3">
          <h1 className="text-lg font-bold text-heading tab:text-2xl">{name}</h1>
          <span className="text-[12px] text-ink-muted tab:text-sm">
            {items.length} {items.length === 1 ? "item" : "items"}
          </span>
        </div>
        {category.subtitle && !subcategory ? (
          <p className="mt-0.5 text-[12px] text-ink-slate tab:text-sm">{category.subtitle}</p>
        ) : null}

        {subcategories.length > 0 && (
          // Wraps on a laptop: a sideways-scrolling row with no scrollbar
          // cannot be scrolled with a mouse.
          <div className="-mx-4 mt-3 flex gap-1.5 overflow-x-auto px-4 pb-0.5 no-scrollbar tab:mx-0 tab:mt-4 tab:flex-wrap tab:gap-2 tab:overflow-visible tab:px-0">
            <Link
              href={basePath}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition-colors tab:px-4 tab:text-[13px] ${
                subcategoryId === null ? "bg-brand text-white" : "border border-line bg-white text-ink-slate"
              }`}
            >
              All
            </Link>
            {subcategories.map((sub) => (
              <Link
                key={sub.id}
                href={`${basePath}?sub=${sub.id}`}
                className={`shrink-0 rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition-colors tab:px-4 tab:text-[13px] ${
                  subcategoryId === sub.id ? "bg-brand text-white" : "border border-line bg-white text-ink-slate"
                }`}
              >
                {sub.name}
              </Link>
            ))}
          </div>
        )}

        {products.length > 0 ? (
          <div className="mt-3 tab:mt-4">
            <ListingFilterBar
              basePath={basePath}
              keepParams={keepParams}
              filters={filters}
              facets={facets}
              total={items.length}
              relevanceLabel="Popular"
            />
          </div>
        ) : null}

        {items.length === 0 ? (
          <div className="mt-12 flex flex-col items-center gap-3 text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-tint">
              <PackageSearch className="h-7 w-7 text-brand" />
            </span>
            <p className="text-sm font-semibold text-ink">
              {products.length > 0 ? "No products match these filters" : "Nothing here yet"}
            </p>
            <p className="max-w-xs text-xs text-ink-slate">
              {products.length > 0
                ? "Try removing a filter or two."
                : "This section has no products at the moment. Try another type."}
            </p>
            <Link
              href={
                products.length > 0
                  ? `${basePath}?${[keepParams, listingQuery(clearFilters(filters))].filter(Boolean).join("&")}`
                  : basePath
              }
              className="mt-1 rounded-full bg-brand px-6 py-2.5 text-sm font-semibold text-white"
            >
              {products.length > 0 ? "Clear filters" : `Show all ${category.name}`}
            </Link>
          </div>
        ) : (
          <PagedProductGrid
            key={JSON.stringify(query)}
            products={items.map(toSummary)}
            wishlistIds={[...wishlistIds]}
            isSignedIn={Boolean(user)}
            pageSize={20}
          />
        )}
      </main>

      <SiteFooter />
      <BottomNav />
    </div>
  );
}
