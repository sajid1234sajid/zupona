import type { Metadata } from "next";
import Link from "next/link";
import { Flame, PiggyBank, Tag, Truck } from "lucide-react";
import ProductHeader from "@/components/layout/ProductHeader";
import BottomNav from "@/components/layout/BottomNav";
import ProductCard from "@/components/home/ProductCard";
import FlashSaleTimer from "@/components/offers/FlashSaleTimer";
import FlashSaleCard from "@/components/offers/FlashSaleCard";
import CouponWallet from "@/components/offers/CouponWallet";
import {
  DEAL_TABS,
  dealProducts,
  flashSaleItems,
  flashSaleName,
  flashSaleWindow,
  freeDeliveryProgress,
  headlineDiscount,
  isDealTab,
  listOfferCoupons,
  totalSavingsAvailable,
  type DealTabId,
} from "@/lib/offers";
import { getCurrentUser } from "@/lib/session";
import { getWishlistProductIds } from "@/lib/wishlist";
import { getCartItems, cartSubtotal } from "@/lib/cart";
import { formatPrice } from "@/lib/format";

export const metadata: Metadata = {
  title: "Offers & Flash Sale — Zupona",
  description: "Live flash sale, collectible coupons and every deal running on Zupona today.",
};

export default async function OffersPage({ searchParams }: PageProps<"/offers">) {
  const query = await searchParams;
  const requested = Array.isArray(query.tab) ? query.tab[0] : query.tab;
  const tab: DealTabId = isDealTab(requested) ? requested : "all";

  const user = await getCurrentUser();
  const [wishlistIds, cartItems] = await Promise.all([
    getWishlistProductIds(user?.id ?? null),
    user ? getCartItems(user.id) : Promise.resolve([]),
  ]);

  // All five come from the database now, so a flash sale scheduled in the
  // admin panel and a coupon created there both appear here.
  const [saleWindow, saleName, saleItems, deals, savings, topDiscount, coupons] =
    await Promise.all([
    flashSaleWindow(),
    flashSaleName(),
    flashSaleItems(),
    dealProducts(tab),
    totalSavingsAvailable(),
    headlineDiscount(),
    listOfferCoupons(),
  ]);

  const endsAt = saleWindow?.endsAt ?? null;
  const delivery = await freeDeliveryProgress(cartSubtotal(cartItems));

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-[#f3f5f4] pb-20">
      <ProductHeader />

      <main className="flex-1">
        {/* Savings meter. Every other deals page states a discount percentage;
            this states the number shoppers actually care about — the Taka on
            the table right now — computed from the live catalog, not typed in. */}
        <section className="px-4 pt-3">
          <div className="rounded-2xl bg-gradient-to-br from-brand-darkest via-brand-dark to-brand p-4 text-white shadow-card">
            <div className="flex items-center gap-1.5">
              <PiggyBank className="h-4 w-4 text-brand-light" />
              <p className="text-[10px] font-semibold uppercase tracking-wide text-white/70">
                Savings live right now
              </p>
            </div>
            <p className="mt-1 text-2xl font-extrabold leading-none">{formatPrice(savings)}</p>
            <p className="mt-1 text-[11px] text-white/70">
              across {deals.length} discounted products · up to {topDiscount}% off
            </p>

            {user && cartItems.length > 0 && (
              <div className="mt-3 rounded-xl bg-white/10 px-3 py-2">
                <div className="flex items-center gap-1.5 text-[10px] font-semibold">
                  <Truck className="h-3.5 w-3.5" />
                  {delivery.qualified ? (
                    <span>Your cart qualifies for free delivery</span>
                  ) : (
                    <span>
                      {formatPrice(delivery.remaining)} more for free delivery
                    </span>
                  )}
                </div>
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-white/25">
                  <div
                    className="h-full rounded-full bg-brand-light"
                    style={{ width: `${Math.max(delivery.percent, 3)}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Flash sale — only when one is actually running in the admin panel */}
        {saleItems.length > 0 && endsAt && (
          <section className="pt-4">
            <div className="flex items-center justify-between px-4">
              <div className="flex items-center gap-1.5">
                <Flame className="h-4 w-4 fill-accent-red text-accent-red" />
                <h2 className="text-[13px] font-bold text-heading">{saleName}</h2>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[9.5px] font-semibold text-ink-slate">Ends in</span>
                <FlashSaleTimer endsAt={endsAt.toISOString()} />
              </div>
            </div>

            <div className="mt-2 flex gap-2 overflow-x-auto px-4 pb-1 no-scrollbar">
              {saleItems.map((item) => (
                <FlashSaleCard key={item.product.id} item={item} />
              ))}
            </div>
          </section>
        )}

        {/* Coupons */}
        <section className="pt-4">
          <div className="flex items-center gap-1.5 px-4">
            <Tag className="h-4 w-4 text-brand" />
            <h2 className="text-[13px] font-bold text-heading">Collect coupons</h2>
            <span className="ml-auto text-[9.5px] text-ink-slate">Apply at checkout</span>
          </div>
          <div className="mt-2">
            <CouponWallet coupons={coupons} />
          </div>
        </section>

        {/* Deals */}
        <section className="px-4 pt-4">
          <h2 className="text-[13px] font-bold text-heading">All deals</h2>

          <div className="mt-2 flex gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
            {DEAL_TABS.map((option) => {
              const isActive = option.id === tab;
              return (
                <Link
                  key={option.id}
                  href={option.id === "all" ? "/offers" : `/offers?tab=${option.id}`}
                  scroll={false}
                  className={`shrink-0 rounded-full px-3 py-1 text-[10px] font-semibold transition-colors ${
                    isActive
                      ? "bg-brand text-white"
                      : "border border-line bg-white text-ink-slate"
                  }`}
                >
                  {option.label}
                </Link>
              );
            })}
          </div>

          {deals.length === 0 ? (
            <p className="mt-8 text-center text-xs text-ink-slate">
              No deals in this selection right now.
            </p>
          ) : (
            <div className="mt-2.5 grid grid-cols-2 gap-2 pb-4">
              {deals.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  isWishlisted={wishlistIds.has(product.id)}
                />
              ))}
            </div>
          )}
        </section>
      </main>

      <BottomNav />
    </div>
  );
}
