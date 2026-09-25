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
import { signalCartAdd } from "@/lib/cartSignal";

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
    // Announced before the action rather than after it, the same way the
    // wishlist heart flips before its action: the server is what decides, but
    // waiting for it to answer left the badge still on the old number for
    // about two seconds, which is long enough for a shopper to think the tap
    // was ignored and press again. If the add is refused -- an unpublished
    // product -- `router.refresh()` brings the real count and the guess is
    // dropped, so nothing can stay wrong.
    signalCartAdd(1);
    startCartTransition(async () => {
      await addToCartAction(product.id);
      setJustAdded(true);
      router.refresh();
    });
  }

  return (
    <article className="@container flex min-w-0 flex-col overflow-hidden rounded-xl border border-line bg-white">
      <div className="relative">
        {/* A photo that scales with the column, so the tile is the same shape
            in every two-column grid instead of a fixed-height strip. It is a
            little taller than square because the shop's photos are portrait
            (2:3 to 3:4) and a square cut their headlines off; the height came
            out of the text below, so the tile as a whole is the size it was. */}
        <Link
          // A grid draws dozens of these, and each one prefetching costs an
          // RSC round trip for a product nobody has asked for yet. Measured on
          // the offers page, that was twenty-one requests fired off during a
          // single tab change, competing for a phone's bandwidth with the page
          // the shopper actually wanted. The tap itself is what fetches.
          prefetch={false}
          href={`/product/${product.id}`}
          className="relative block aspect-[8/9] overflow-hidden bg-brand-mist"
        >
          {/* The whole picture, never cropped -- a cropped tile cut the
              headline off the shop's banner-style photos. Where the picture is
              not the tile's shape, the space around it is the same picture
              blurred: same URL, same width, so it costs no extra bytes. */}
          <Image
            src={product.image}
            alt=""
            aria-hidden
            fill
            sizes="(max-width: 480px) 46vw, 200px"
            className="scale-110 object-cover blur-xl brightness-90"
            unoptimized={product.image.startsWith("/api/media/")}
          />
          <Image
            src={product.image}
            alt={product.name}
            fill
            sizes="(max-width: 480px) 46vw, 200px"
            style={{ objectFit: "contain" }}
            // An admin upload is served by /api/media, which the image
            // optimizer cannot fetch: it answers 404 and the tile shows a
            // broken image. Those files are already stored at a sane size.
            unoptimized={product.image.startsWith("/api/media/")}
          />
        </Link>

        {/* Bottom corner rather than top: the top of a product photo is where
            its headline is printed, and the discount lives beside the price. */}
        <button
          type="button"
          aria-label={wishlisted ? "Remove from wishlist" : "Add to wishlist"}
          aria-pressed={wishlisted}
          onClick={handleWishlistToggle}
          disabled={wishlistPending}
          className="absolute bottom-1.5 right-1.5 grid h-7 w-7 place-items-center rounded-full bg-white/95 shadow-card"
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
        </Link>

        {/* Price and Add always share one row, the button bottom-right. The old
            price sits under the new one so the row stays narrow enough for the
            categories pane on a 320px phone without cutting the price off. */}
        <div className="mt-auto flex items-end justify-between gap-0.5 pt-1">
          <span className="flex min-w-0 flex-col">
            {/* The stars ride on the price line rather than a row of their
                own, which is the height the photo was given; they appear once
                there is a review, since "0 (0)" on every tile said nothing. */}
            <span className="flex items-center gap-1">
              <span className="whitespace-nowrap text-[13px] font-extrabold leading-tight text-brand-darkest">
                {formatPrice(product.price)}
              </span>
              {product.reviews > 0 && (
                <span className="flex min-w-0 items-center gap-0.5 text-[10px] font-medium leading-none text-ink-slate">
                  <Star className="h-2.5 w-2.5 shrink-0 fill-gold text-gold" />
                  {product.rating}
                </span>
              )}
            </span>
            {product.oldPrice > product.price && (
              <span className="flex flex-wrap items-baseline gap-x-1 text-[10px] leading-tight">
                <span className="whitespace-nowrap text-ink-slate line-through">
                  {formatPrice(product.oldPrice)}
                </span>
                {/* The categories pane draws this tile 100px wide, where the
                    full wording runs under the Add button; there it is short. */}
                {product.discountPercent > 0 && (
                  <span className="whitespace-nowrap font-bold text-[#e8590c]">
                    <span className="@[150px]:hidden">-{product.discountPercent}%</span>
                    <span className="hidden @[150px]:inline">
                      ({product.discountPercent}% OFF)
                    </span>
                  </span>
                )}
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
