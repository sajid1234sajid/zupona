import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft, ChevronRight, LayoutGrid, PackageSearch } from "lucide-react";
import ProductHeader from "@/components/layout/ProductHeader";
import BottomNav from "@/components/layout/BottomNav";
import ProductCard from "@/components/home/ProductCard";
import CategoryToolbar from "@/components/category/CategoryToolbar";
import {
  breadcrumbFor,
  collectDescendantIds,
  getCategoryByPath,
  type CategoryNode,
} from "@/lib/categoryService";
import { isCategorySort, type CategorySort } from "@/lib/categorySorts";
import { countStoreProducts, listStoreProducts } from "@/lib/storefront";
import { toSummary } from "@/lib/categories";
import { getCurrentUser } from "@/lib/session";
import { getWishlistProductIds } from "@/lib/wishlist";

/** A category landing page, at every level of the tree.
 *
 * One route serves all three levels -- `/category/electronics`,
 * `/category/electronics/mobiles`, `/category/electronics/mobiles/smartphones`
 * -- because they differ only in how deep the breadcrumb goes and which
 * subcategories are shown. A category has exactly one canonical address, built
 * from its slug path, and anything else that identifies it (its id, or the
 * right slug reached by the wrong ancestry) redirects there rather than
 * rendering a duplicate page.
 *
 * Products are listed for the category *and everything beneath it*, so a
 * department page is not empty just because every product is filed two levels
 * down. Subcategories come before the product grid, which is what a shopper
 * who landed on a broad category actually needs first.
 */

const SITE_URL = "https://zupona.com";

/** Products per page. Divides cleanly by the 2-, 3- and 5-column grids this
 * page uses, so the last row is never a lone orphan on any breakpoint. */
const PAGE_SIZE = 30;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

async function resolve(segments: string[]) {
  return getCategoryByPath(segments.map((segment) => decodeURIComponent(segment)));
}

export async function generateMetadata({
  params,
}: PageProps<"/category/[...path]">): Promise<Metadata> {
  const { path } = await params;
  const found = await resolve(path);
  if (!found) return { title: "Category not found — Zupona" };

  const { node } = found;
  const trail = breadcrumbFor(node)
    .map((crumb) => crumb.name)
    .join(" · ");

  const title = node.seoTitle ?? `${node.name} — Buy Online in Bangladesh | Zupona`;
  const description =
    node.seoDescription ??
    node.descriptionEn ??
    node.subtitle ??
    `Shop ${node.name} on Zupona. ${node.totalProductCount} ${
      node.totalProductCount === 1 ? "product" : "products"
    } across ${trail}, delivered across Bangladesh.`;

  return {
    title,
    description,
    alternates: { canonical: node.href },
    openGraph: {
      title,
      description,
      url: `${SITE_URL}${node.href}`,
      type: "website",
      images: node.imageUrl ? [{ url: node.imageUrl }] : undefined,
    },
  };
}

export default async function CategoryPage({
  params,
  searchParams,
}: PageProps<"/category/[...path]">) {
  const { path } = await params;
  const found = await resolve(path);
  if (!found) notFound();

  const { node, canonical } = found;
  const query = await searchParams;

  // `?sub=` is how subcategories used to be selected. Those links are in
  // people's history and in search results, so they are honoured once and
  // turned into the nested address rather than 404'd.
  const legacySub = first(query.sub);
  if (legacySub) {
    const child = node.children.find(
      (candidate) => candidate.id === legacySub || candidate.slug === legacySub
    );
    if (child) redirect(child.href);
  }

  if (!canonical) redirect(node.href);

  const requestedSort = first(query.sort);
  const sort: CategorySort = isCategorySort(requestedSort) ? requestedSort : "popular";
  const dealsOnly = first(query.deals) === "1";

  // The listing and its total are built from one description of the query, so
  // the count above the grid can never disagree with the grid under it.
  const scope = {
    categoryIds: collectDescendantIds(node),
    // Short stand-in for the id list when the result is cached; the list can
    // run past KV's key limit on a large department.
    scopeId: node.id,
    sort,
    minDiscount: dealsOnly ? 1 : undefined,
  };

  const total = await countStoreProducts(scope);
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  // A page number past the end lands on the last page rather than on an empty
  // grid: a stale link should still show products.
  const page = Math.min(Math.max(1, Number(first(query.page) ?? 1) || 1), pageCount);

  const [matches, user] = await Promise.all([
    listStoreProducts({ ...scope, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE }),
    getCurrentUser(),
  ]);
  const wishlistIds = await getWishlistProductIds(user?.id ?? null);

  const trail = breadcrumbFor(node);
  const parentHref = node.ancestors[node.ancestors.length - 1]?.href ?? "/categories";
  const description = node.descriptionEn ?? node.subtitle;

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-[#f3f5f4] pb-20 lg:max-w-6xl lg:bg-white lg:pb-10">
      <ProductHeader />

      <main className="flex-1 px-4 pt-3 lg:px-8 lg:pt-6">
        <Breadcrumb trail={trail} />

        <div className="mt-1.5 flex items-center gap-2 lg:mt-4">
          <Link
            href={parentHref}
            aria-label="Back"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white shadow-sm lg:hidden"
          >
            <ChevronLeft className="h-4 w-4 text-neutral-600" />
          </Link>
          <div className="min-w-0">
            <h1 className="truncate text-base font-bold text-neutral-800 lg:text-3xl">
              {node.name}
              {node.nameBn ? (
                <span className="ml-2 text-[11px] font-medium text-neutral-400 lg:text-base">
                  {node.nameBn}
                </span>
              ) : null}
            </h1>
            {description ? (
              <p className="truncate text-[10px] text-neutral-400 lg:mt-1 lg:whitespace-normal lg:text-sm">
                {description}
              </p>
            ) : null}
          </div>
        </div>

        {node.children.length > 0 && <SubcategoryCards parent={node} />}

        <div className="mt-2 lg:mt-6">
          <CategoryToolbar
            basePath={node.href}
            sort={sort}
            dealsOnly={dealsOnly}
            resultCount={total}
          />
        </div>

        {matches.length === 0 ? (
          <div className="mt-12 flex flex-col items-center gap-3 text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-tint">
              <PackageSearch className="h-7 w-7 text-brand" />
            </span>
            <p className="text-sm font-semibold text-neutral-700">Nothing here yet</p>
            <p className="max-w-xs text-xs text-neutral-400">
              {dealsOnly
                ? "No discounted items in this selection right now. Try clearing the deals filter."
                : `We have not listed anything in ${node.name} yet. Browse a nearby category instead.`}
            </p>
            <Link
              href={dealsOnly ? node.href : parentHref}
              className="mt-1 rounded-full bg-brand px-6 py-2.5 text-sm font-semibold text-white"
            >
              {dealsOnly ? `Show all ${node.name}` : "Browse categories"}
            </Link>
          </div>
        ) : (
          <div className="mt-2.5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:mt-4 lg:grid-cols-5 lg:gap-4">
            {matches.map((product) => (
              <ProductCard
                key={product.id}
                product={toSummary(product)}
                isWishlisted={wishlistIds.has(product.id)}
              />
            ))}
          </div>
        )}

        {pageCount > 1 && (
          <Pager basePath={node.href} page={page} pageCount={pageCount} sort={sort} dealsOnly={dealsOnly} />
        )}
      </main>

      <BottomNav />
      <BreadcrumbJsonLd trail={trail} />
    </div>
  );
}

/** Page links for a category listing.
 *
 * Plain links, not buttons: a page of a category is an address, so it survives
 * a refresh, a back-navigation and being shared, the same reasoning the sort
 * and deals controls already follow. The sort and filter in force are carried
 * through; `page=1` is left off so the first page has one canonical URL.
 *
 * Long lists collapse to first / neighbours / last rather than printing every
 * number, which on a phone would wrap into several rows of tap targets. */
function Pager({
  basePath,
  page,
  pageCount,
  sort,
  dealsOnly,
}: {
  basePath: string;
  page: number;
  pageCount: number;
  sort: CategorySort;
  dealsOnly: boolean;
}) {
  const hrefFor = (target: number) => {
    const params = new URLSearchParams();
    if (sort !== "popular") params.set("sort", sort);
    if (dealsOnly) params.set("deals", "1");
    if (target > 1) params.set("page", String(target));
    const query = params.toString();
    return query ? `${basePath}?${query}` : basePath;
  };

  const numbers: number[] = [];
  for (let n = 1; n <= pageCount; n += 1) {
    if (n === 1 || n === pageCount || Math.abs(n - page) <= 1) numbers.push(n);
  }

  const step =
    "flex h-9 min-w-9 items-center justify-center rounded-lg px-2 text-xs font-semibold transition-colors";

  return (
    <nav aria-label="Pagination" className="mt-5 flex flex-wrap items-center justify-center gap-1.5">
      {page > 1 && (
        <Link href={hrefFor(page - 1)} rel="prev" className={`${step} border border-neutral-200 bg-white text-neutral-600`}>
          <ChevronLeft className="h-4 w-4" />
          <span className="sr-only">Previous page</span>
        </Link>
      )}

      {numbers.map((n, index) => (
        <span key={n} className="flex items-center gap-1.5">
          {index > 0 && numbers[index - 1] !== n - 1 && (
            <span className="px-0.5 text-xs text-neutral-400" aria-hidden>
              …
            </span>
          )}
          <Link
            href={hrefFor(n)}
            aria-current={n === page ? "page" : undefined}
            aria-label={`Page ${n}`}
            className={`${step} ${
              n === page
                ? "bg-brand text-white"
                : "border border-neutral-200 bg-white text-neutral-600"
            }`}
          >
            {n}
          </Link>
        </span>
      ))}

      {page < pageCount && (
        <Link href={hrefFor(page + 1)} rel="next" className={`${step} border border-neutral-200 bg-white text-neutral-600`}>
          <ChevronRight className="h-4 w-4" />
          <span className="sr-only">Next page</span>
        </Link>
      )}
    </nav>
  );
}

function Breadcrumb({ trail }: { trail: { name: string; href: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="min-w-0">
      <ol className="flex items-center gap-1 overflow-x-auto text-[10px] text-neutral-400 no-scrollbar lg:text-xs">
        <li className="shrink-0">
          <Link href="/" className="hover:text-brand">
            Home
          </Link>
        </li>
        {trail.map((crumb, index) => (
          <li key={crumb.href} className="flex shrink-0 items-center gap-1">
            <ChevronRight className="h-3 w-3 shrink-0" aria-hidden />
            {index === trail.length - 1 ? (
              <span aria-current="page" className="font-semibold text-brand">
                {crumb.name}
              </span>
            ) : (
              <Link href={crumb.href} className="hover:text-brand">
                {crumb.name}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

/** "Shop by Category" — the children of whatever level this page is at. */
function SubcategoryCards({ parent }: { parent: CategoryNode }) {
  return (
    <section aria-labelledby="shop-by-category" className="mt-3 lg:mt-6">
      <h2
        id="shop-by-category"
        className="text-[10px] font-semibold uppercase tracking-wide text-neutral-400 lg:text-xs"
      >
        Shop by Category
      </h2>

      <div className="mt-1.5 grid grid-cols-4 gap-2 sm:grid-cols-6 lg:mt-3 lg:grid-cols-8 lg:gap-4">
        {parent.children.map((child) => {
          const image = child.imageUrl ?? child.iconUrl;
          return (
            <Link
              key={child.id}
              href={child.href}
              className="group flex flex-col items-center gap-1 text-center lg:gap-2"
            >
              <span className="relative aspect-square w-full overflow-hidden rounded-lg bg-neutral-100 transition group-hover:ring-2 group-hover:ring-brand lg:rounded-xl">
                {image ? (
                  <Image
                    src={image}
                    alt=""
                    fill
                    sizes="(min-width: 1024px) 120px, 90px"
                    unoptimized={image.startsWith("/api/media/")}
                    className="object-cover"
                  />
                ) : (
                  <span className="flex h-full w-full items-center justify-center bg-brand-tint">
                    <LayoutGrid className="h-4 w-4 text-brand lg:h-6 lg:w-6" />
                  </span>
                )}
                {child.totalProductCount > 0 && (
                  <span className="absolute bottom-0.5 right-0.5 rounded bg-black/55 px-1 text-[8px] font-semibold text-white lg:text-[10px]">
                    {child.totalProductCount}
                  </span>
                )}
              </span>
              <span className="line-clamp-2 text-[9.5px] font-medium leading-tight text-neutral-700 lg:text-xs">
                {child.name}
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

/** BreadcrumbList structured data, so search results show the category's place
 * in the tree rather than a bare URL. */
function BreadcrumbJsonLd({ trail }: { trail: { name: string; href: string }[] }) {
  const data = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
      ...trail.map((crumb, index) => ({
        "@type": "ListItem",
        position: index + 2,
        name: crumb.name,
        item: `${SITE_URL}${crumb.href}`,
      })),
    ],
  };

  return (
    <script
      type="application/ld+json"
      // The payload is built here from our own data, never from user input.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
