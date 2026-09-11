import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, PackageSearch } from "lucide-react";
import ProductHeader from "@/components/layout/ProductHeader";
import BottomNav from "@/components/layout/BottomNav";
import ProductCard from "@/components/home/ProductCard";
import CategoryToolbar from "@/components/category/CategoryToolbar";
import {
  getCategory,
  getSubcategory,
  isCategorySort,
  productsInCategory,
  toSummary,
  type CategorySort,
} from "@/lib/categories";
import { getCurrentUser } from "@/lib/session";
import { getWishlistProductIds } from "@/lib/wishlist";

export async function generateMetadata({
  params,
}: PageProps<"/category/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const category = await getCategory(slug);
  if (!category) return { title: "Category not found — Zupona" };

  return {
    title: `${category.name} — Zupona`,
    description: category.subtitle ?? `Shop ${category.name} on Zupona.`,
  };
}

export default async function CategoryPage({
  params,
  searchParams,
}: PageProps<"/category/[slug]">) {
  const { slug } = await params;
  const category = await getCategory(slug);
  if (!category) notFound();

  const query = await searchParams;
  const first = (value: string | string[] | undefined): string | undefined =>
    Array.isArray(value) ? value[0] : value;

  // An unknown ?sub= is ignored rather than 404'd: a stale link should still
  // land on the category, just unfiltered.
  const requestedSub = first(query.sub);
  const subcategory = requestedSub ? await getSubcategory(slug, requestedSub) : undefined;
  const subcategoryId = subcategory?.id ?? null;

  const requestedSort = first(query.sort);
  const sort: CategorySort = isCategorySort(requestedSort) ? requestedSort : "popular";
  const dealsOnly = first(query.deals) === "1";

  const matches = await productsInCategory({
    categoryId: slug,
    subcategoryId: subcategoryId ?? undefined,
    sort,
    minDiscount: dealsOnly ? 1 : undefined,
  });

  const user = await getCurrentUser();
  const wishlistIds = await getWishlistProductIds(user?.id ?? null);

  const basePath = `/category/${slug}`;
  const subcategories = category.subcategories ?? [];

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-[#f3f5f4] pb-20">
      <ProductHeader />

      <main className="flex-1 px-4 pt-3">
        <div className="flex items-center gap-2">
          <Link
            href="/categories"
            aria-label="Back to categories"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white shadow-sm"
          >
            <ChevronLeft className="h-4 w-4 text-ink-slate" />
          </Link>
          <div className="min-w-0">
            <h1 className="truncate text-base font-bold text-heading">
              {subcategory ? subcategory.name : category.name}
            </h1>
            <p className="truncate text-[10px] text-ink-slate">
              {subcategory ? category.name : category.subtitle}
            </p>
          </div>
        </div>

        {subcategories.length > 0 && (
          <div className="mt-2.5 flex gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
            <Link
              href={basePath}
              className={`shrink-0 rounded-full px-3 py-1 text-[10px] font-semibold transition-colors ${
                subcategoryId === null
                  ? "bg-brand text-white"
                  : "border border-line bg-white text-ink-slate"
              }`}
            >
              All
            </Link>
            {subcategories.map((sub) => (
              <Link
                key={sub.id}
                href={`${basePath}?sub=${sub.id}`}
                className={`shrink-0 rounded-full px-3 py-1 text-[10px] font-semibold transition-colors ${
                  subcategoryId === sub.id
                    ? "bg-brand text-white"
                    : "border border-line bg-white text-ink-slate"
                }`}
              >
                {sub.name}
              </Link>
            ))}
          </div>
        )}

        <div className="mt-2">
          <CategoryToolbar
            basePath={basePath}
            sort={sort}
            subcategoryId={subcategoryId}
            dealsOnly={dealsOnly}
            resultCount={matches.length}
          />
        </div>

        {matches.length === 0 ? (
          <div className="mt-12 flex flex-col items-center gap-3 text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-tint">
              <PackageSearch className="h-7 w-7 text-brand" />
            </span>
            <p className="text-sm font-semibold text-ink">Nothing here yet</p>
            <p className="max-w-xs text-xs text-ink-slate">
              {dealsOnly
                ? "No discounted items in this selection right now. Try clearing the deals filter."
                : "This section has no products at the moment. Try another type."}
            </p>
            <Link
              href={basePath}
              className="mt-1 rounded-full bg-brand px-6 py-2.5 text-sm font-semibold text-white"
            >
              Show all {category.name}
            </Link>
          </div>
        ) : (
          <div className="mt-2.5 grid grid-cols-2 gap-2">
            {matches.map((product) => (
              <ProductCard
                key={product.id}
                product={toSummary(product)}
                isWishlisted={wishlistIds.has(product.id)}
              />
            ))}
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  );
}
