import type { Metadata } from "next";
import Header from "@/components/layout/Header";
import BottomNav from "@/components/layout/BottomNav";
import SearchProvider from "@/components/search/SearchProvider";
import CategoryBrowser, { type BrowseCategory } from "@/components/category/CategoryBrowser";
import { getCategoryIndex, getNavigationCategories } from "@/lib/categoryService";
import { listCategoryOverviews } from "@/lib/storefront";

export const metadata: Metadata = {
  title: "All Categories — Zupona",
  description:
    "Browse every Zupona department, section and product type — fashion, electronics, beauty, baby care and more.",
  alternates: { canonical: "/categories" },
};

/** The category index.
 *
 * Two reads, joined by id: the navigation tree (three levels, cached) and the
 * per-department merchandising extras (cheapest price, best discount, a few
 * popular products). Neither is queried per department -- that shape is what
 * made this page expensive before.
 *
 * The page uses the storefront's own header rather than the compact one, and
 * tells its search box that here it searches categories: `CategoryBrowser`
 * reads the same shared query, so the one box in the design does the job
 * without a second search field on the page.
 */
export default async function CategoriesPage() {
  const [tree, overviews, index] = await Promise.all([
    getNavigationCategories(),
    listCategoryOverviews(),
    getCategoryIndex(),
  ]);

  const extras = new Map(overviews.map((overview) => [overview.id, overview]));

  const categories: BrowseCategory[] = tree.map((node) => {
    const overview = extras.get(node.id);
    return {
      ...node,
      fromPrice: overview?.fromPrice ?? null,
      bestDiscount: overview?.bestDiscount ?? 0,
      highlights: (overview?.highlights ?? []).map((product) => ({
        id: product.id,
        name: product.name,
        image: product.image,
        price: product.price,
        discountPercent: product.discountPercent,
      })),
    };
  });

  const featuredIds = index.all.filter((node) => node.isFeatured).map((node) => node.id);

  return (
    <SearchProvider>
      {/* `h-dvh` with `overflow-hidden`, not `min-h-screen`: the rail and the
          pane scroll independently inside the shell, which is the whole point
          of the rail staying put. `dvh` rather than `vh` so a mobile browser's
          collapsing address bar cannot cut the last row off. */}
      <div className="mx-auto flex h-dvh w-full max-w-md flex-col overflow-hidden bg-white lg:h-auto lg:max-w-6xl lg:overflow-visible">
        <Header searchPlaceholder="Search categories..." />
        <CategoryBrowser categories={categories} featuredIds={featuredIds} />
        <BottomNav />
      </div>
    </SearchProvider>
  );
}
