"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "@/components/ui/StoreImage";
import { Star, Heart, LoaderCircle, Check } from "lucide-react";
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
 * Anyone can add to the cart without signing in. A wishlist belongs to an
 * account, so a signed-out shopper is sent to sign in rather than having that
 * tap do nothing -- a redirect thrown inside an action is not followed from
 * here, which is what made the button look broken to a guest. */
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
    startCartTransition(async () => {
      await addToCartAction(product.id);
      setJustAdded(true);
      router.refresh();
    });
  }

  return (
    <article className="flex min-w-0 flex-col overflow-hidden rounded-xl border border-line bg-white">
      <div className="relative">
        {/* A square photo that scales with the column, so the tile is the same
            shape in every two-column grid instead of a fixed-height strip. */}
        <Link
          // A grid draws dozens of these, and each one prefetching costs an
          // RSC round trip for a product nobody has asked for yet. Measured on
          // the offers page, that was twenty-one requests fired off during a
          // single tab change, competing for a phone's bandwidth with the page
          // the shopper actually wanted. The tap itself is what fetches.
          prefetch={false}
          href={`/product/${product.id}`}
          className="relative block aspect-square overflow-hidden bg-brand-mist"
        >
          <Image
            src={product.image}
            alt={product.name}
            fill
            sizes="(max-width: 480px) 46vw, 200px"
            className="object-cover"
            // An admin upload is served by /api/media, which the image
            // optimizer cannot fetch: it answers 404 and the tile shows a
            // broken image. Those files are already stored at a sane size.
            unoptimized={product.image.startsWith("/api/media/")}
          />
        </Link>

        {product.discountPercent > 0 && (
          <span className="pointer-events-none absolute left-1.5 top-1.5 rounded-full bg-brand px-1.5 py-[2px] text-[10px] font-bold leading-none text-white">
            -{product.discountPercent}%
          </span>
        )}

        <button
          type="button"
          aria-label={wishlisted ? "Remove from wishlist" : "Add to wishlist"}
          aria-pressed={wishlisted}
          onClick={handleWishlistToggle}
          disabled={wishlistPending}
          className="absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-full bg-white/95 shadow-card"
        >
          <Heart
            className={`h-3.5 w-3.5 ${
              wishlisted ? "fill-accent-red text-accent-red" : "text-ink-muted"
            }`}
            strokeWidth={2.2}
          />
        </button>
      </div>

      <div className="flex flex-1 flex-col p-1.5">
        <Link prefetch={false} href={`/product/${product.id}`} className="block">
          <h3 className="line-clamp-2 min-h-[2.5em] text-[12px] font-semibold leading-[1.25] text-heading">
            {product.name}
          </h3>
          <span className="mt-1 flex items-center gap-0.5">
            <Star className="h-3 w-3 fill-gold text-gold" />
            <span className="text-[10.5px] font-medium text-ink-slate">
              {product.rating} ({product.reviews})
            </span>
          </span>
        </Link>

        {/* Price and Add always share one row, the button bottom-right. The old
            price sits under the new one so the row stays narrow enough for the
            categories pane on a 320px phone without cutting the price off. */}
        <div className="mt-auto flex items-end justify-between gap-0.5 pt-1.5">
          <span className="flex min-w-0 flex-col">
            <span className="whitespace-nowrap text-[13px] font-extrabold leading-tight text-brand-darkest">
              {formatPrice(product.price)}
            </span>
            {product.oldPrice > product.price && (
              <span className="whitespace-nowrap text-[10px] leading-tight text-ink-slate line-through">
                {formatPrice(product.oldPrice)}
              </span>
            )}
          </span>

          <button
            type="button"
            onClick={handleAddToCart}
            disabled={cartPending}
            aria-label={justAdded ? "Added to cart" : "Add to cart"}
            className="inline-flex h-7 min-w-[32px] shrink-0 items-center justify-center rounded-full bg-brand px-1.5 text-[10.5px] font-bold text-white transition-colors disabled:opacity-70"
          >
            {cartPending ? (
              <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
            ) : justAdded ? (
              <Check className="h-3.5 w-3.5" strokeWidth={2.8} />
            ) : (
              "Add"
            )}
          </button>
        </div>
      </div>
    </article>
  );
}
