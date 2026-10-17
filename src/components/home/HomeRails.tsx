import { Flame, Sparkles, Trophy, Zap } from "lucide-react";
import ProductRail from "./ProductRail";
import Countdown from "@/components/ui/Countdown";
import { listStoreProducts, type StoreProductCard } from "@/lib/storefront";
import { unitsSold } from "@/lib/bestSellers";
import { liveFlashSale } from "@/lib/offers";
import { toSummary } from "@/lib/categories";
import type { ProductSummary } from "@/types";

/** A rail needs this many products to be drawn at all: a row of two looks
 * like a shop with nothing in it. */
const MIN_RAIL = 5;
const RAIL_LENGTH = 12;

/** The home page's rows between the departments and the main feed: today's
 * deals (or the running flash sale, with its countdown), best sellers and new
 * arrivals. Every row is built from real data and left out entirely when it
 * would be short. */
export default async function HomeRails({
  catalog,
  sale,
  wishlistIds,
  isSignedIn,
}: {
  catalog: StoreProductCard[];
  /** The running flash sale, read once by the page. */
  sale: Awaited<ReturnType<typeof liveFlashSale>>;
  wishlistIds: string[];
  isSignedIn: boolean;
}) {
  const [units, newest] = await Promise.all([
    unitsSold(30).catch(() => ({}) as Record<string, number>),
    listStoreProducts({ sort: "newest", limit: RAIL_LENGTH }),
  ]);
  const byId = new Map(catalog.map((product) => [product.id, product]));

  // A running flash sale takes the deals row over: its name, its countdown,
  // its own prices. Otherwise the deepest discounts in the shop.
  let deals: ProductSummary[];
  if (sale && sale.items.length > 0) {
    deals = sale.items
      .filter((item) => !item.soldOut)
      .map((item) => {
        const card = byId.get(item.product.id);
        const base = { ...(card ? toSummary(card) : item.product), campaign: sale.name };
        const was = Math.max(base.oldPrice, base.price);
        return {
          ...base,
          price: item.salePrice,
          oldPrice: was,
          discountPercent: was > item.salePrice ? Math.round(((was - item.salePrice) / was) * 100) : 0,
        };
      });
  } else {
    deals = catalog
      .filter((product) => product.inStock && product.discountPercent > 0)
      .sort((a, b) => b.discountPercent - a.discountPercent)
      .slice(0, RAIL_LENGTH)
      .map(toSummary);
  }

  const bestSellers = catalog
    .filter((product) => (units[product.id] ?? 0) > 0)
    .sort((a, b) => (units[b.id] ?? 0) - (units[a.id] ?? 0))
    .slice(0, RAIL_LENGTH)
    .map(toSummary);

  const arrivals = newest.filter((product) => product.inStock).map(toSummary);

  const common = { wishlistIds, isSignedIn };

  return (
    <>
      {sale && deals.length > 0 ? (
        <ProductRail
          id="flash-sale"
          title={sale.name}
          icon={<Zap className="h-4 w-4 fill-urgency text-urgency tab:h-5 tab:w-5" />}
          extra={<Countdown endsAt={sale.endsAt} />}
          href="/offers"
          products={deals}
          {...common}
        />
      ) : deals.length >= MIN_RAIL ? (
        <ProductRail
          id="deals"
          title="Today's deals"
          icon={<Flame className="h-4 w-4 fill-urgency text-urgency tab:h-5 tab:w-5" />}
          href="/offers"
          products={deals}
          {...common}
        />
      ) : null}

      {bestSellers.length >= MIN_RAIL ? (
        <ProductRail
          id="best-sellers"
          title="Best sellers"
          icon={<Trophy className="h-4 w-4 text-rating tab:h-5 tab:w-5" />}
          href="/best-sellers"
          products={bestSellers}
          {...common}
        />
      ) : null}

      {arrivals.length >= MIN_RAIL ? (
        <ProductRail
          id="new-arrivals"
          title="New arrivals"
          icon={<Sparkles className="h-4 w-4 text-brand tab:h-5 tab:w-5" />}
          href="/new-arrivals"
          products={arrivals}
          {...common}
        />
      ) : null}
    </>
  );
}
