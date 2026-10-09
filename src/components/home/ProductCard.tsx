"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "@/components/ui/StoreImage";
import { Star, Heart, LoaderCircle, Check, ShoppingCart, Truck } from "lucide-react";
import type { ProductSummary } from "@/types";
import { formatPrice } from "@/lib/format";
import { toggleWishlistAction } from "@/app/wishlist/actions";
import { addToCartAction } from "@/app/cart/actions";
import { signalCartAdd } from "@/lib/cartSignal";

/** "84 sold", "1.2K+ sold", "13K+ sold" -- the figure rounded down, so the
 * plus is always true. */
function soldLabel(count: number): string {
  if (count < 1000) return `${count} sold`;
  const thousands = Math.floor(count / 100) / 10;
  return `${thousands >= 10 ? Math.floor(thousands) : thousands}K+ sold`;
}

/** The tag printed before the name: the admin panel's badge, or "Best Seller"
 * for a product ticked as one without a badge of its own. */
function tagFor(product: ProductSummary): string | null {
  return product.badgeLabel || (product.bestSeller ? "Best Seller" : null);
}

/** How many of a card's optional lines this product has, which is what makes
 * one card taller than the next. `MasonryGrid` reads it to place each card in
 * the shorter column, so it must count exactly the lines drawn below. */
export function cardLineCount(product: ProductSummary): number {
  return (
    (product.reviews > 0 ? 1 : 0) +
    (product.stockLeft ? 1 : 0) +
    (product.oldPrice > product.price ? 1 : 0) +
    (product.freeDelivery || product.brand ? 1 : 0)
  );
}

/** A product tile.
 *
 * Temu-style: under the photo every product says what is true of it and
 * nothing else. One card has stars, "Only 3 left", "84 sold", a crossed-out
 * price and "Free delivery"; the next has a name and a price. The grids place
 * them in two independent columns (`MasonryGrid`), so a short card never
 * leaves a hole beside a tall one.
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
  const tag = tagFor(product);
  const soldCount = product.soldCount ?? 0;
  const stockLeft = product.stockLeft ?? 0;

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
            in every two-column grid instead of a fixed-height strip. It is 4:5,
            the same shape as the product page's frame and the shape the admin
            uploader fits pictures to, so one picture fills both edge to edge.
            At 8:9 a picture fitted to 4:5 still showed a blurred band down
            each side of the tile. */}
        <Link
          // A grid draws dozens of these, and each one prefetching costs an
          // RSC round trip for a product nobody has asked for yet. Measured on
          // the offers page, that was twenty-one requests fired off during a
          // single tab change, competing for a phone's bandwidth with the page
          // the shopper actually wanted. The tap itself is what fetches.
          prefetch={false}
          href={`/products/${product.slug}`}
          className="relative block aspect-[4/5] overflow-hidden bg-brand-mist"
        >
          {/* The whole picture, never cropped -- a cropped tile cut the
              headline off the shop's banner-style photos. The space around it
              is the same picture at 64px, stretched: a picture that small is
              already soft when enlarged, so it needs only a light blur. A
              heavy CSS blur of the full-size picture looked the same but cost
              about 300ms of main-thread work across a grid on a throttled
              phone; this costs a couple of kilobytes per tile instead. */}
          <Image
            src={product.image}
            alt=""
            aria-hidden
            fill
            sizes="16px"
            className="scale-110 object-cover blur-[6px] brightness-90"
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

      <div className="flex flex-col gap-[3px] p-1.5">
        <Link prefetch={false} href={`/products/${product.slug}`} className="block">
          {/* One line, the way Temu sets it: the lines below are what tell
              products apart, and a second line of name pushed them down. The
              tag stays out of the categories pane's narrow tile, where it left
              room for one word of the name. */}
          <h3 className="line-clamp-1 text-[12px] font-semibold leading-[1.3] text-heading">
            {tag && (
              <span className="mr-1 hidden @[150px]:inline-block rounded-[3px] bg-[#e8590c] px-1 align-[1px] text-[9px] font-bold leading-[1.45] text-white">
                {tag}
              </span>
            )}
            {product.name}
          </h3>
        </Link>

        {product.reviews > 0 && (
          <span className="flex items-center gap-[1px] text-[10px] leading-none text-ink-slate">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                className={`h-2.5 w-2.5 shrink-0 ${
                  star <= Math.round(product.rating)
                    ? "fill-gold text-gold"
                    : "fill-line text-line"
                }`}
              />
            ))}
            <span className="ml-0.5">{product.reviews}</span>
          </span>
        )}

        {stockLeft > 0 && (
          <span className="text-[10px] font-semibold leading-none text-[#e8590c]">
            Only {stockLeft} left
          </span>
        )}

        {/* Price and the cart button share one row, the button at the right
            edge. "Sold" rides beside the price where there is room for it; the
            categories pane draws this tile 100px wide, and there it is left
            out rather than squeezing the price. */}
        <div className="flex items-center justify-between gap-1">
          <span className="flex min-w-0 items-baseline gap-1">
            <span className="whitespace-nowrap text-[13px] font-extrabold leading-tight text-brand-darkest">
              {formatPrice(product.price)}
            </span>
            {soldCount > 0 && (
              <span className="hidden truncate text-[10px] leading-tight text-ink-slate @[150px]:inline">
                {soldLabel(soldCount)}
              </span>
            )}
          </span>

          <button
            type="button"
            onClick={handleAddToCart}
            disabled={cartPending}
            aria-label={justAdded ? "Added to cart" : "Add to cart"}
            className="grid h-7 w-7 shrink-0 place-items-center rounded-full border-[1.5px] border-brand text-brand transition-colors disabled:opacity-70"
          >
            {cartPending ? (
              <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
            ) : justAdded ? (
              <Check className="h-3.5 w-3.5" strokeWidth={2.8} />
            ) : (
              <ShoppingCart className="h-3.5 w-3.5" strokeWidth={2.2} />
            )}
          </button>
        </div>

        {product.oldPrice > product.price && (
          <span className="flex flex-wrap items-baseline gap-x-1 text-[10px] leading-tight">
            <span className="whitespace-nowrap text-ink-slate line-through">
              {formatPrice(product.oldPrice)}
            </span>
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

        {product.freeDelivery ? (
          <span className="flex min-w-0 items-center gap-1 text-[10px] font-semibold leading-tight text-brand">
            <Truck className="h-3 w-3 shrink-0" strokeWidth={2.2} />
            <span className="truncate">Free delivery</span>
          </span>
        ) : (
          product.brand && (
            <span className="truncate text-[10px] leading-tight text-ink-slate">
              Brand: <span className="font-semibold text-ink">{product.brand}</span>
            </span>
          )
        )}
      </div>
    </article>
  );
}
