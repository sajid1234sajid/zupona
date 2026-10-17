import { BadgeCheck, Star, Store } from "lucide-react";
import Image from "@/components/ui/StoreImage";
import type { ProductSeller } from "@/lib/productSeller";

/** Who sells it: a marketplace seller's card, or the shop's own line. */
export default function SellerLine({ seller }: { seller: ProductSeller | null }) {
  if (!seller) {
    return (
      <section className="flex items-center gap-3 rounded-2xl border border-line bg-white p-4">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand-tint text-brand">
          <BadgeCheck className="h-6 w-6" aria-hidden />
        </span>
        <p className="text-[13px] text-ink-slate">
          <span className="block font-bold text-heading">Sold and delivered by Zupona</span>
          Covered by every Zupona promise: Cash on Delivery and easy returns.
        </p>
      </section>
    );
  }
  const year = seller.since ? new Date(`${seller.since.replace(" ", "T")}Z`).getUTCFullYear() : null;
  return (
    <section className="flex items-center gap-3 rounded-2xl border border-line bg-white p-4">
      <span className="relative grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-full bg-brand-mist text-brand">
        {seller.logo ? <Image src={seller.logo} alt="" fill sizes="44px" className="object-cover" /> : <Store className="h-5 w-5" />}
      </span>
      <div className="min-w-0 text-[12.5px] text-ink-slate">
        <p className="flex items-center gap-1 font-bold text-heading">
          Sold by {seller.name}
          {seller.verified ? <BadgeCheck className="h-4 w-4 text-brand" aria-label="Verified seller" /> : null}
        </p>
        <p>
          {seller.ratingCount > 0 ? (
            <>
              <Star className="mb-0.5 inline h-3.5 w-3.5 fill-rating text-rating" aria-hidden /> {seller.rating.toFixed(1)} ·{" "}
            </>
          ) : null}
          {seller.products} item{seller.products === 1 ? "" : "s"}
          {year ? ` · on Zupona since ${year}` : ""}
        </p>
      </div>
    </section>
  );
}
