import type { Metadata } from "next";
import ProductHeader from "@/components/layout/ProductHeader";
import DesktopHeader from "@/components/layout/DesktopHeader";
import BottomNav from "@/components/layout/BottomNav";
import CategoryBrowser from "@/components/category/CategoryBrowser";
import { categoryOverviews } from "@/lib/categories";
import { getCurrentUser } from "@/lib/session";
import { getWishlistProductIds } from "@/lib/wishlist";

export const metadata: Metadata = {
  title: "All Categories — Zupona",
  description: "Browse every Zupona department, from fashion and electronics to baby care.",
};

export default async function CategoriesPage() {
  // `categoryOverviews` is the same for every visitor, so it starts with the
  // session lookup instead of after it. Only the wishlist has to wait to learn
  // whose it is.
  const [user, categories] = await Promise.all([getCurrentUser(), categoryOverviews()]);
  const wishlistIds = await getWishlistProductIds(user?.id ?? null);

  return (
    // h-screen (not min-h-screen): the two panes scroll independently inside
    // the shell, which is the whole point of the rail staying put.
    <div className="mx-auto flex h-screen w-full max-w-md flex-col overflow-hidden bg-white pb-16 tab:max-w-none tab:bg-brand-mist tab:pb-0">
      <div className="tab:hidden">
        <ProductHeader />
      </div>
      <DesktopHeader />
      <div className="shrink-0 border-b border-line-soft px-4 py-2.5 tab:mx-auto tab:w-full tab:max-w-shell tab:border-0 tab:px-6 tab:pb-0 tab:pt-5">
        <h1 className="text-base font-bold text-heading tab:text-2xl">All Categories</h1>
        <p className="text-[10px] text-ink-slate tab:text-sm">
          {categories.length} departments ·{" "}
          {categories.reduce((total, category) => total + category.productCount, 0)} products
        </p>
      </div>
      <CategoryBrowser
        categories={categories}
        wishlistIds={[...wishlistIds]}
        isSignedIn={Boolean(user)}
      />
      <BottomNav />
    </div>
  );
}
