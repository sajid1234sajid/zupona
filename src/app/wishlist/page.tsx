import type { Metadata } from "next";
import { Heart, PiggyBank, TrendingDown, Flame } from "lucide-react";
import Link from "next/link";
import ProductHeader from "@/components/layout/ProductHeader";
import BottomNav from "@/components/layout/BottomNav";
import WishlistClient from "@/components/wishlist/WishlistClient";
import { getCurrentUser } from "@/lib/session";
import { getWishlistEntries, wishlistSavings, wishlistTotal } from "@/lib/wishlist";
import { isWishlistSort } from "@/lib/wishlistSorts";
import { formatPrice } from "@/lib/format";
import type { WishlistSort } from "@/types";

export const metadata: Metadata = {
  title: "My Wishlist — Zupona",
  description: "Everything you have saved, with price drops and live offers flagged.",
};

export default async function WishlistPage({ searchParams }: PageProps<"/wishlist">) {
  // Deliberately getCurrentUser, not requireUser: bouncing a signed-out
  // shopper straight to a login form hides what the page is for. Baymard's
  // finding on saved-for-later is that the perceived cost of signing up is
  // exactly what stops people using a wishlist, so explain it first.
  const user = await getCurrentUser();

  const query = await searchParams;
  const requested = Array.isArray(query.sort) ? query.sort[0] : query.sort;
  const sort: WishlistSort = isWishlistSort(requested) ? requested : "recent";

  const entries = user ? await getWishlistEntries(user.id, sort) : [];
  const savings = wishlistSavings(entries);
  const total = wishlistTotal(entries);

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-[#f3f5f4] pb-20">
      <ProductHeader />
      <main className="flex-1 px-4 pt-4">
        <div className="flex items-baseline justify-between">
          <h1 className="text-lg font-bold text-heading">My Wishlist</h1>
          {entries.length > 0 && (
            <span className="text-[10px] text-ink-slate">
              {entries.length} {entries.length === 1 ? "item" : "items"} ·{" "}
              {formatPrice(total)}
            </span>
          )}
        </div>

        {!user ? (
          <div className="mt-10 flex flex-col items-center gap-3 text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-tint">
              <Heart className="h-7 w-7 text-brand" />
            </span>
            <p className="text-sm font-semibold text-ink">Sign in to see your wishlist</p>
            <p className="max-w-xs text-xs text-ink-slate">
              Saved items follow your account, so they are waiting on every device — and
              Zupona flags them when the price drops or they land in a flash sale.
            </p>
            <Link
              href="/account/login"
              className="mt-2 rounded-full bg-brand px-6 py-2.5 text-sm font-semibold text-white"
            >
              Sign in
            </Link>
            <Link href="/offers" className="text-xs font-semibold text-brand">
              Browse today&apos;s offers instead →
            </Link>
          </div>
        ) : entries.length === 0 ? (
          <div className="mt-10 flex flex-col items-center gap-3 text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-tint">
              <Heart className="h-7 w-7 text-brand" />
            </span>
            <p className="text-sm font-semibold text-ink">Your wishlist is empty</p>
            <p className="max-w-xs text-xs text-ink-slate">
              Tap the heart on any product to save it here. We&apos;ll show you when it gets
              cheaper.
            </p>
            <div className="mt-2 flex items-center gap-2">
              <Link
                href="/categories"
                className="rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-white"
              >
                Browse categories
              </Link>
              <Link
                href="/offers"
                className="rounded-full border border-brand px-5 py-2.5 text-sm font-semibold text-brand"
              >
                See offers
              </Link>
            </div>
          </div>
        ) : (
          <>
            {/* What changed since these were saved — the reason to come back. */}
            {(savings.total > 0 || savings.droppedCount > 0) && (
              <div className="mt-3 rounded-xl bg-white p-3 shadow-card">
                <div className="flex items-center gap-1.5">
                  <PiggyBank className="h-4 w-4 text-brand" />
                  <p className="text-[11px] font-bold text-heading">
                    Buying this list today saves {formatPrice(savings.total)}
                  </p>
                </div>
                {(savings.droppedCount > 0 || savings.onOfferCount > 0) && (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {savings.droppedCount > 0 && (
                      <span className="flex items-center gap-1 rounded-full bg-brand-tint px-2 py-0.5 text-[9px] font-semibold text-brand-dark">
                        <TrendingDown className="h-2.5 w-2.5" />
                        {savings.droppedCount} price{" "}
                        {savings.droppedCount === 1 ? "drop" : "drops"} since you saved
                      </span>
                    )}
                    {savings.onOfferCount > 0 && (
                      <span className="flex items-center gap-1 rounded-full bg-accent-red/10 px-2 py-0.5 text-[9px] font-semibold text-accent-red">
                        <Flame className="h-2.5 w-2.5" />
                        {savings.onOfferCount} in the flash sale
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}

            <WishlistClient entries={entries} sort={sort} />
          </>
        )}
      </main>
      <BottomNav />
    </div>
  );
}
