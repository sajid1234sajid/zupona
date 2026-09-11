"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Heart, ShoppingCart, Star } from "lucide-react";
import { formatPrice } from "@/lib/format";
import { toggleWishlistAction } from "@/app/wishlist/actions";
import type { StoreProduct } from "@/lib/storefront";

export default function ProductInfo({
  product,
  isWishlisted = false,
}: {
  product: StoreProduct;
  isWishlisted?: boolean;
}) {
  const router = useRouter();
  const [wishlisted, setWishlisted] = useState(isWishlisted);
  const [pending, startTransition] = useTransition();

  function handleToggle() {
    setWishlisted((v) => !v);
    startTransition(async () => {
      await toggleWishlistAction(product.id);
      router.refresh();
    });
  }

  return (
    <div className="px-4 pt-3">
      <div className="flex items-start justify-between gap-3">
        <h1 className="text-[22px] font-extrabold leading-tight text-heading">{product.name}</h1>
        <button
          aria-label="Toggle wishlist"
          onClick={handleToggle}
          disabled={pending}
          className="shrink-0 pt-0.5"
        >
          <Heart
            className={`h-5 w-5 ${
              wishlisted ? "fill-accent-red text-accent-red" : "text-ink-slate"
            }`}
          />
        </button>
      </div>

      <div className="mt-1.5 flex items-center gap-1.5">
        <div className="flex items-center gap-0.5">
          {Array.from({ length: 5 }).map((_, index) => (
            <Star
              key={index}
              className={`h-[17px] w-[17px] ${
                product.rating >= index + 1
                  ? "fill-gold text-gold"
                  : product.rating >= index + 0.5
                    ? "fill-gold/60 text-gold"
                    : "fill-line text-line"
              }`}
            />
          ))}
        </div>
        <span className="text-[13px] font-bold text-brand">{product.rating}</span>
        <span className="text-[13px] text-ink-slate">({product.reviews} Reviews)</span>
      </div>

      {/* The reference runs title -> rating -> sold -> price -> old price ->
          discount before the trust strip. The sold count and the price row
          were missing here, so the page jumped from the rating straight to the
          swatches and left the price only in the hero. */}
      {product.soldCount > 0 && (
        <p className="mt-2 flex items-center gap-1.5 text-[13px] text-ink-soft">
          <ShoppingCart className="h-4 w-4" strokeWidth={2} />
          {product.soldCount.toLocaleString("en-US")}+ sold
        </p>
      )}

      <div className="mt-2.5 flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
        <span className="text-[30px] font-extrabold leading-none text-heading">
          {formatPrice(product.price)}
        </span>
        {product.discountPercent > 0 && (
          <>
            <span className="text-[15px] text-ink-faint line-through">
              {formatPrice(product.oldPrice)}
            </span>
            <span className="rounded-full bg-brand px-2.5 py-1 text-[11px] font-bold text-white">
              {product.discountPercent}% OFF
            </span>
          </>
        )}
      </div>
    </div>
  );
}
