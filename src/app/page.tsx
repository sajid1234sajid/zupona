import Header from "@/components/layout/Header";
import BottomNav from "@/components/layout/BottomNav";
import HeroBanner from "@/components/home/HeroBanner";
import CategoryGrid from "@/components/home/CategoryGrid";
import PromoBanners from "@/components/home/PromoBanners";
import FeaturedProducts from "@/components/home/FeaturedProducts";
import SearchProvider from "@/components/search/SearchProvider";
import { getCurrentUser } from "@/lib/session";
import { getWishlistProductIds } from "@/lib/wishlist";
import { listStoreCategories, listStoreProducts } from "@/lib/storefront";

/** The storefront home page.
 *
 * The whole shoppable catalog is read once and handed to the grid, which
 * filters it in the browser: that is what makes typing in the header's search
 * box filter instantly instead of waiting on a round trip. The curated
 * products are picked out of the same rows rather than fetched again -- a
 * second query for `is_featured = 1` returned a subset of what was already in
 * hand and doubled the home page's database reads. The departments are read
 * alongside them rather than one after another. */
export default async function Home() {
  const user = await getCurrentUser();
  const [wishlistIds, catalog, categories] = await Promise.all([
    getWishlistProductIds(user?.id ?? null),
    listStoreProducts({ sort: "popular" }),
    listStoreCategories(),
  ]);

  const featured = catalog.filter((product) => product.featured);

  return (
    <SearchProvider>
      {/* The bottom padding clears the fixed tab bar, so the last row of
          product cards can always be scrolled clear of it. */}
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-white pb-[68px] tab:max-w-none tab:pb-12">
        <Header />
        <main className="flex-1 tab:mx-auto tab:w-full tab:max-w-[1180px] tab:px-6 tab:pt-5">
          <HeroBanner />
          <CategoryGrid categories={categories} />
          <PromoBanners />
          <FeaturedProducts
            featured={featured}
            catalog={catalog}
            wishlistIds={Array.from(wishlistIds)}
            isSignedIn={Boolean(user)}
          />
        </main>
        <BottomNav />
      </div>
    </SearchProvider>
  );
}
