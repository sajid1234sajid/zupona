import { formatPrice } from "@/lib/format";

/** The shop's one way of drawing a price: the amount, the struck "was" price
 * and the discount, in three sizes. The percentage is worked out here from
 * the two prices and never passed in, so a page cannot show a discount the
 * prices do not add up to. No hooks, so server and client pages both use it. */

export type PriceSize = "card" | "pdp" | "sheet" | "cart";

export function discountOf(price: number, compareAt: number | null | undefined): number {
  return compareAt && compareAt > price ? Math.round(((compareAt - price) / compareAt) * 100) : 0;
}

const NOW: Record<PriceSize, string> = {
  card: "whitespace-nowrap text-[13px] font-extrabold leading-tight text-price tab:text-[15px]",
  pdp: "text-[30px] font-extrabold leading-none tracking-tight text-price",
  sheet: "text-xl font-extrabold text-price",
  cart: "whitespace-nowrap text-sm font-bold text-price",
};

const WAS: Record<PriceSize, string> = {
  card: "text-[10px]",
  pdp: "text-sm",
  sheet: "text-[13px]",
  cart: "text-[11px]",
};

/** The amount on its own, where a layout splits it from the "was" line. */
export function PriceNow({ price, size = "card", className = "" }: { price: number; size?: PriceSize; className?: string }) {
  return <span className={`${NOW[size]} ${className}`}>{formatPrice(price)}</span>;
}

/** The struck price and the discount. A card in a narrow column says "-28%";
 * given room it says "(28% OFF)". Renders nothing without a real discount. */
export function PriceWas({
  price,
  compareAt,
  size = "card",
  className = "",
}: {
  price: number;
  compareAt: number | null | undefined;
  size?: PriceSize;
  className?: string;
}) {
  const percent = discountOf(price, compareAt);
  if (!compareAt || compareAt <= price) return null;
  return (
    <span className={`inline-flex flex-wrap items-baseline gap-x-1 leading-tight ${WAS[size]} ${className}`}>
      <span className="whitespace-nowrap text-price-was line-through">{formatPrice(compareAt)}</span>
      {percent > 0 ? (
        size === "card" ? (
          <span className="whitespace-nowrap font-bold text-discount">
            <span className="@[150px]:hidden">-{percent}%</span>
            <span className="hidden @[150px]:inline">({percent}% OFF)</span>
          </span>
        ) : (
          <span className="whitespace-nowrap rounded-full bg-discount/10 px-1.5 py-0.5 font-extrabold text-discount">
            -{percent}%
          </span>
        )
      ) : null}
    </span>
  );
}

export default function Price({
  price,
  compareAt,
  size = "card",
  className = "",
}: {
  price: number;
  compareAt?: number | null;
  size?: PriceSize;
  className?: string;
}) {
  return (
    <span className={`inline-flex flex-wrap items-baseline gap-x-2 gap-y-1 ${className}`}>
      <PriceNow price={price} size={size} />
      <PriceWas price={price} compareAt={compareAt} size={size} />
    </span>
  );
}
