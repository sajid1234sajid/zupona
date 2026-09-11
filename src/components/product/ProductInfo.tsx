"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Heart, Star } from "lucide-react";
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
        <h1 className="text-lg font-bold text-heading">{product.name}</h1>
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
              className={`h-3.5 w-3.5 ${
                index < Math.round(product.rating)
                  ? "fill-gold text-gold"
                  : "fill-line text-line"
              }`}
            />
          ))}
        </div>
        <span className="text-xs font-semibold text-ink">{product.rating}</span>
        <span className="text-xs text-ink-slate">({product.reviews} Reviews)</span>
      </div>
    </div>
  );
}
