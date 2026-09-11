import Image from "next/image";
import Link from "next/link";
import type { FlashSaleItem } from "@/types";
import { formatPrice } from "@/lib/format";

/** One flash-sale line.
 *
 * The claimed bar is the point of the card: Amazon's Lightning Deals put the
 * share of the allocation already gone next to the price, so scarcity is
 * legible before the tap rather than at checkout. The bar turns red past 80%
 * because that is where "worth deciding now" begins.
 */
export default function FlashSaleCard({ item }: { item: FlashSaleItem }) {
  const { product, salePrice, saving, claimedPercent, soldOut } = item;
  const nearlyGone = claimedPercent >= 80 && !soldOut;

  return (
    <Link
      href={`/product/${product.id}`}
      className="w-[112px] shrink-0 rounded-lg bg-white p-1.5 shadow-card"
    >
      <div className="relative h-[92px] overflow-hidden rounded-md bg-brand-mist">
        <Image
          src={product.image}
          alt={product.name}
          fill
          sizes="112px"
          className={`object-cover ${soldOut ? "opacity-45 grayscale" : ""}`}
        />
        {soldOut ? (
          <span className="absolute inset-x-0 bottom-0 bg-heading/80 py-0.5 text-center text-[9px] font-bold text-white">
            SOLD OUT
          </span>
        ) : (
          saving > 0 && (
            <span className="absolute left-1 top-1 rounded bg-accent-red px-1 py-0.5 text-[10px] font-bold text-white">
              Save {formatPrice(saving)}
            </span>
          )
        )}
      </div>

      <p className="mt-1 truncate text-[10.5px] font-semibold text-heading">
        {product.name}
      </p>

      <div className="mt-0.5 flex items-baseline gap-1">
        <span className="text-[12px] font-bold text-accent-red">{formatPrice(salePrice)}</span>
        <span className="text-[9px] text-ink-slate line-through">
          {formatPrice(product.price)}
        </span>
      </div>

      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-line">
        <div
          className={`h-full rounded-full ${
            soldOut ? "bg-ink-faint" : nearlyGone ? "bg-accent-red" : "bg-accent-orange"
          }`}
          style={{ width: `${Math.max(claimedPercent, 4)}%` }}
        />
      </div>
      <p
        className={`mt-0.5 text-[10px] font-semibold ${
          nearlyGone ? "text-accent-red" : "text-ink-slate"
        }`}
      >
        {soldOut
          ? "All claimed"
          : nearlyGone
            ? `Almost gone · ${claimedPercent}% claimed`
            : `${claimedPercent}% claimed`}
      </p>
    </Link>
  );
}
