import Header from "@/components/layout/Header";
import BottomNav from "@/components/layout/BottomNav";
import HeroBanner from "@/components/home/HeroBanner";
import CategoryGrid from "@/components/home/CategoryGrid";
import PromoBanners from "@/components/home/PromoBanners";
import FeaturedProducts from "@/components/home/FeaturedProducts";
import SearchProvider from "@/components/search/SearchProvider";
import { getCurrentUser } from "@/lib/session";
import { getWishlistProductIds } from "@/lib/wishlist";
import { listStoreProducts } from "@/lib/storefront";

/** The storefront home page.
 *
 * Two catalog reads rather than one: `featured` is the curated grid a shopper
 * lands on, `catalog` is what the header's search box looks through. Both are
 * fetched here on the server so typing into the search box filters instantly
 * instead of waiting on a round trip. */
export default async function Home() {
  const user = await getCurrentUser();
  const [wishlistIds, featured, catalog] = await Promise.all([
    getWishlistProductIds(user?.id ?? null),
    listStoreProducts({ featuredOnly: true, sort: "popular" }),
    listStoreProducts({ sort: "popular" }),
  ]);

  return (
    <SearchProvider>
      {/* The bottom padding clears the fixed tab bar, so the last row of
          product cards can always be scrolled clear of it. */}
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-white pb-[68px]">
        <Header />
        <main className="flex-1">
          <HeroBanner />
          <CategoryGrid />
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
