import type { Metadata } from "next";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import ProductHeader from "@/components/layout/ProductHeader";
import DesktopHeader from "@/components/layout/DesktopHeader";
import BottomNav from "@/components/layout/BottomNav";
import ProductCard from "@/components/home/ProductCard";
import { listStoreProducts } from "@/lib/storefront";
import { getCurrentUser } from "@/lib/session";
import { getWishlistProductIds } from "@/lib/wishlist";

export const metadata: Metadata = {
  title: "New Arrivals — Zupona",
  description: "The latest products to land on Zupona, newest first.",
};

/** Everything the shop has listed recently, newest first.
 *
 * The menu's "New Arrivals" needed somewhere real to go, and the catalog
 * already sorts by `created_at` -- this is `listStoreProducts` with that sort,
 * which means the same KV-cached read the rest of the storefront uses rather
 * than a query of its own. */
export default async function NewArrivalsPage() {
  const user = await getCurrentUser();
  const [wishlistIds, products] = await Promise.all([
    getWishlistProductIds(user?.id ?? null),
    listStoreProducts({ sort: "newest", limit: 40 }),
  ]);

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-white pb-[68px] tab:max-w-none tab:pb-12">
      <div className="tab:hidden">
        <ProductHeader />
      </div>
      <DesktopHeader />
      <main className="flex-1 px-3.5 pt-3.5 tab:mx-auto tab:w-full tab:max-w-[1180px] tab:px-6 tab:pt-6">
        <div className="flex items-center gap-2 tab:gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-tint text-brand tab:h-11 tab:w-11">
            <Sparkles className="h-[18px] w-[18px]" strokeWidth={2.25} />
          </span>
          <span className="leading-tight">
            <h1 className="text-base font-bold text-brand-darkest tab:text-2xl">New Arrivals</h1>
            <p className="text-[10px] text-ink-muted tab:text-sm">
              {products.length} {products.length === 1 ? "product" : "products"}, newest first
            </p>
          </span>
        </div>

        {products.length === 0 ? (
          <div className="mt-10 flex flex-col items-center gap-3 text-center">
            <p className="text-sm font-semibold text-ink">Nothing new just yet</p>
            <p className="max-w-xs text-xs text-ink-muted">
              New stock lands here as soon as it is listed. In the meantime, the
              shop is worth a browse.
            </p>
            <Link
              href="/categories"
              className="mt-2 rounded-full bg-brand px-6 py-2.5 text-sm font-semibold text-white"
            >
              Browse categories
            </Link>
          </div>
        ) : (
          <div className="mt-3 grid grid-cols-2 gap-1.5 tab:mt-5 tab:grid-cols-3 tab:gap-3 lg:grid-cols-4 xl:grid-cols-5">
            {products.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                isWishlisted={wishlistIds.has(product.id)}
                isSignedIn={Boolean(user)}
              />
            ))}
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  );
}
