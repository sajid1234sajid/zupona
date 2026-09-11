"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Star, Heart, LoaderCircle } from "lucide-react";
import type { ProductSummary } from "@/types";
import { formatPrice } from "@/lib/format";
import { toggleWishlistAction } from "@/app/wishlist/actions";
import { addToCartAction } from "@/app/cart/actions";

/** A product tile.
 *
 * The links and the two buttons are siblings rather than nested, because a
 * button inside an anchor is invalid HTML and leaves keyboard users unable to
 * reach either reliably. The photo and the title are the links; wishlist and
 * add-to-cart are ordinary buttons sitting beside them.
 *
 * Carts and wishlists belong to an account, so a signed-out shopper is sent to
 * sign in rather than having the tap do nothing. The server actions redirect
 * too, but a redirect thrown inside an action is not followed from here, which
 * is what made both buttons look broken to a guest. */
export default function ProductCard({
  product,
  isWishlisted = false,
  isSignedIn = false,
}: {
  product: ProductSummary;
  isWishlisted?: boolean;
  isSignedIn?: boolean;
}) {
  const router = useRouter();
  const [wishlisted, setWishlisted] = useState(isWishlisted);
  const [wishlistPending, startWishlistTransition] = useTransition();
  const [cartPending, startCartTransition] = useTransition();
  const [justAdded, setJustAdded] = useState(false);

  function handleWishlistToggle() {
    if (!isSignedIn) {
      router.push("/account/login");
      return;
    }
    // Flipped straight away so the tap feels instant; the server action is
    // what actually decides, and `router.refresh()` reconciles the header
    // count with whatever it stored.
    setWishlisted((value) => !value);
    startWishlistTransition(async () => {
      await toggleWishlistAction(product.id);
      router.refresh();
    });
  }

  function handleAddToCart() {
    if (!isSignedIn) {
      router.push("/account/login");
      return;
    }
    startCartTransition(async () => {
      await addToCartAction(product.id);
      setJustAdded(true);
      router.refresh();
    });
  }

  return (
    <article className="overflow-hidden rounded-xl border border-brand-tint bg-white p-1.5">
      <div className="relative">
        <Link
          href={`/product/${product.id}`}
          className="relative block h-[74px] overflow-hidden rounded-lg bg-brand-mist"
        >
          <Image
            src={product.image}
            alt={product.name}
            fill
            sizes="(max-width: 480px) 46vw, 200px"
            className="object-cover"
          />
        </Link>

        {product.discountPercent > 0 && (
          <span className="pointer-events-none absolute left-1 top-1 rounded-md bg-white/95 px-1 py-[1px] text-[10px] font-extrabold text-brand shadow-card">
            -{product.discountPercent}%
          </span>
        )}

        <button
          type="button"
          aria-label={wishlisted ? "Remove from wishlist" : "Add to wishlist"}
          aria-pressed={wishlisted}
          onClick={handleWishlistToggle}
          disabled={wishlistPending}
          className="absolute right-1 top-1 grid h-[18px] w-[18px] place-items-center rounded-full bg-white/95 shadow-card"
        >
          <Heart
            className={`h-[11px] w-[11px] ${
              wishlisted ? "fill-accent-red text-accent-red" : "text-ink-muted"
            }`}
            strokeWidth={2.4}
          />
        </button>
      </div>

      <Link href={`/product/${product.id}`} className="mt-1 block">
        <h3 className="truncate text-[12px] font-bold leading-tight text-heading">{product.name}</h3>
        <span className="mt-[3px] flex items-center gap-0.5">
          <Star className="h-[12px] w-[12px] fill-gold text-gold" />
          <span className="text-[11px] font-medium text-ink-slate">
            {product.rating} ({product.reviews})
          </span>
        </span>
      </Link>

      <div className="mt-1 flex items-center justify-between gap-1">
        <span className="min-w-0">
          <span className="block truncate text-[14px] font-extrabold leading-[1.25] text-brand-darkest">
            {formatPrice(product.price)}
          </span>
          {product.oldPrice > product.price && (
            <span className="mt-[2px] block truncate text-[11px] leading-[1.3] text-ink-slate line-through">
              {formatPrice(product.oldPrice)}
            </span>
          )}
        </span>

        <button
          type="button"
          onClick={handleAddToCart}
          disabled={cartPending}
          className="inline-flex shrink-0 items-center justify-center gap-1 rounded-full bg-brand px-2.5 py-[6px] text-[11px] font-bold text-white disabled:opacity-70"
        >
          {cartPending ? (
            <LoaderCircle className="h-2.5 w-2.5 animate-spin" />
          ) : justAdded ? (
            "Added"
          ) : (
            "Add to Cart"
          )}
        </button>
      </div>
    </article>
  );
}
