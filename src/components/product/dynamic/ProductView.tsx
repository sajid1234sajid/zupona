"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Heart, LoaderCircle, ShoppingCart, Star, Zap } from "lucide-react";
import type { StoreMediaItem, StoreProduct } from "@/lib/storefront";
import { formatPrice } from "@/lib/format";
import { addSelectionToCartAction } from "@/app/cart/actions";
import { toggleWishlistAction } from "@/app/wishlist/actions";
import ProductMedia from "./ProductMedia";
import VideoModal from "./VideoModal";
import OptionGroups from "./OptionGroups";
import QuantityPicker from "./QuantityPicker";
import ShareButton from "./ShareButton";
import FeatureBar from "./FeatureBar";
import DeliveryCard, { type DeliveryLine } from "./DeliveryCard";
import {
  findVariant,
  initialSelections,
  resolvePricing,
  type Selections,
} from "./variantMatching";

/** The product page, for every product.
 *
 * There is one of these. A watch, a shoe, a shirt, a hijab and a serum all
 * render through it; what differs is the data, never the component. Which
 * option selectors appear, whether there is a video, whether a badge shows --
 * all of it follows from what the product actually has.
 *
 * Everything the shopper picks is held here, because a colour changes the
 * price, the stock, the picture and what sizes remain: those cannot each own
 * their own copy of the truth. */
export default function ProductView({
  product,
  breadcrumbs,
  deliveryLines,
  initiallyWishlisted,
}: {
  product: StoreProduct;
  /** Built on the server from the category tree, which the read model returns
   * as ids rather than a trail. */
  breadcrumbs: string[];
  deliveryLines: DeliveryLine[];
  initiallyWishlisted: boolean;
}) {
  const router = useRouter();

  // KV can still be serving an entry written before these fields existed, so
  // they are read defensively -- the same way `videos` already is.
  // Memoised because `?? []` would hand back a fresh array on every render,
  // which would in turn make every dependent memo recompute for no reason.
  const optionGroups = useMemo(() => product.optionGroups ?? [], [product.optionGroups]);
  const variants = useMemo(() => product.variants ?? [], [product.variants]);
  const media = useMemo(() => product.media ?? [], [product.media]);
  const groupKeys = useMemo(() => optionGroups.map((group) => group.key), [optionGroups]);

  const [selections, setSelections] = useState<Selections>(() => initialSelections(product));
  const [activeMediaId, setActiveMediaId] = useState(media[0]?.id ?? "");
  const [quantity, setQuantity] = useState(1);
  const [wishlisted, setWishlisted] = useState(initiallyWishlisted);
  const [playing, setPlaying] = useState<StoreMediaItem | null>(null);
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);

  const [addPending, startAdd] = useTransition();
  const [buyPending, startBuy] = useTransition();
  const [wishPending, startWish] = useTransition();

  const variant = useMemo(
    () => findVariant(variants, selections, groupKeys),
    [variants, selections, groupKeys]
  );
  const { price, compareAtPrice, available, discountPercent } = resolvePricing(product, variant);

  // Every group has to be answered before anything can be bought, so a shirt
  // cannot be added with a colour and no size.
  const selectionComplete = groupKeys.every((key) => Boolean(selections[key]));
  const canBuy = available > 0 && (variants.length === 0 || (Boolean(variant) && selectionComplete));

  function choose(groupKey: string, value: string) {
    const next = { ...selections, [groupKey]: value };
    setSelections(next);
    setFeedback(null);
    setQuantity(1);

    // A variant with its own picture brings the gallery with it.
    const matched = findVariant(variants, next, groupKeys);
    if (matched?.imageId && media.some((item) => item.id === matched.imageId)) {
      setActiveMediaId(matched.imageId);
    }
  }

  function addToCart(then?: () => void) {
    setFeedback(null);
    return async () => {
      const result = await addSelectionToCartAction({
        productId: product.id,
        variantId: variant?.id ?? null,
        quantity,
      });

      if (!result.ok) {
        setFeedback({ ok: false, message: result.error ?? "Could not add to the cart." });
        return;
      }

      setFeedback({ ok: true, message: "Added to your cart." });
      // Refreshes the header's cart count from the server rather than guessing
      // it, so what the badge shows is what the database holds.
      router.refresh();
      then?.();
    };
  }

  function toggleWishlist() {
    const next = !wishlisted;
    setWishlisted(next);
    startWish(async () => {
      await toggleWishlistAction(product.id);
      router.refresh();
    });
  }

  const actions = (
    <>
      <button
        type="button"
        onClick={() => startAdd(addToCart())}
        disabled={!canBuy || addPending || buyPending}
        className="flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-full bg-brand px-4 text-sm font-black text-white transition disabled:cursor-not-allowed disabled:opacity-45 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
      >
        {addPending ? (
          <LoaderCircle className="h-4 w-4 animate-spin" />
        ) : (
          <ShoppingCart className="h-[18px] w-[18px]" />
        )}
        {available > 0 ? "Add to Cart" : "Out of Stock"}
      </button>

      <button
        type="button"
        onClick={() => startBuy(addToCart(() => router.push("/checkout")))}
        disabled={!canBuy || addPending || buyPending}
        className="flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-full border-2 border-brand bg-white px-4 text-sm font-black text-brand transition disabled:cursor-not-allowed disabled:opacity-45 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
      >
        {buyPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Zap className="h-[18px] w-[18px] fill-current" />}
        Buy Now
      </button>
    </>
  );

  return (
    <>
      <div className="tab:grid tab:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)] tab:items-start tab:gap-8">
        <div className="min-w-0">
          {breadcrumbs.length > 0 && (
            <nav aria-label="Breadcrumb" className="mb-3 hidden text-xs text-ink-soft tab:block">
              {breadcrumbs.map((crumb, index) => (
                <span key={`${crumb}-${index}`}>
                  {index > 0 && <span className="px-1.5 text-[#b5c6c0]">/</span>}
                  {crumb}
                </span>
              ))}
            </nav>
          )}

          <ProductMedia
            media={media}
            activeId={activeMediaId}
            onSelect={setActiveMediaId}
            onPlayVideo={setPlaying}
            badgeLabel={product.badgeLabel}
            productName={product.name}
            toolbar={<ShareButton title={product.name} />}
          />
        </div>

        <div className="min-w-0 pt-4 tab:pt-0">
          <p className="text-[11px] font-extrabold uppercase tracking-wide text-brand">
            {product.categoryName}
            {product.brand && <span className="text-ink-soft"> · {product.brand}</span>}
          </p>

          <div className="mt-1.5 flex items-start justify-between gap-3">
            <h1 className="text-[26px] font-extrabold leading-tight tracking-tight text-heading tab:text-[32px]">
              {product.name}
            </h1>

            <button
              type="button"
              onClick={toggleWishlist}
              disabled={wishPending}
              aria-pressed={wishlisted}
              aria-label={wishlisted ? "Remove from wishlist" : "Add to wishlist"}
              className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-brand-tint transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
            >
              <Heart
                className={`h-5 w-5 ${wishlisted ? "fill-accent-red text-accent-red" : "text-brand-darkest"}`}
              />
            </button>
          </div>

          {product.shortDescription && (
            <p className="mt-1.5 text-sm text-ink-soft">{product.shortDescription}</p>
          )}

          <div className="mt-2.5 flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
            <span className="flex items-center gap-0.5" aria-label={`Rated ${product.rating} out of 5`}>
              {[0, 1, 2, 3, 4].map((index) => (
                <Star
                  key={index}
                  className={`h-[18px] w-[18px] ${
                    product.rating >= index + 0.5 ? "fill-gold text-gold" : "fill-[#e3e9e7] text-[#e3e9e7]"
                  }`}
                />
              ))}
            </span>
            <span className="text-[15px] font-bold text-brand">{product.rating.toFixed(1)}</span>
            <span className="text-sm text-heading">({product.reviews} Reviews)</span>
            {product.soldCount > 0 && (
              <span className="flex w-full items-center gap-1.5 text-[13px] text-ink-soft">
                <ShoppingCart className="h-4 w-4" aria-hidden />
                {product.soldCount.toLocaleString("en-US")}+ sold
              </span>
            )}
          </div>

          <div className="mt-3.5 flex flex-wrap items-center gap-2.5">
            <span className="text-[30px] font-black leading-none tracking-tight text-heading">
              {formatPrice(price)}
            </span>
            {compareAtPrice > price && (
              <span className="text-sm text-[#8c8e90] line-through">{formatPrice(compareAtPrice)}</span>
            )}
            {discountPercent > 0 && (
              <span className="rounded-full bg-brand px-2.5 py-1.5 text-[11px] font-black text-white">
                {discountPercent}% OFF
              </span>
            )}
          </div>

          <div className="mt-5">
            <OptionGroups
              groups={optionGroups}
              variants={variants}
              selections={selections}
              onSelect={choose}
            />
          </div>

          <div className="mt-5">
            <QuantityPicker quantity={quantity} available={available} onChange={setQuantity} />
          </div>

          {feedback && (
            <p
              role="status"
              className={`mt-3 rounded-xl px-3 py-2.5 text-xs font-semibold ${
                feedback.ok ? "bg-mint text-brand-dark" : "bg-accent-red/10 text-accent-red"
              }`}
            >
              {feedback.message}
              {feedback.ok && (
                <Link href="/cart" className="ml-2 underline">
                  View cart
                </Link>
              )}
            </p>
          )}

          <div className="mt-4 hidden gap-3 tab:flex">{actions}</div>

          <FeatureBar features={product.features ?? []} />

          <DeliveryCard
            lines={deliveryLines}
            returnPolicy={product.returnPolicy}
            warranty={product.warranty}
          />
        </div>
      </div>

      {/* Mobile only: the buy buttons ride above the tab bar. Both go away
          once there is room to put them beside the product instead. */}
      <div className="fixed inset-x-0 bottom-[68px] z-40 flex gap-2.5 border-t border-[#deebe6] bg-surface/95 px-4 py-2.5 backdrop-blur tab:hidden">
        {actions}
      </div>

      {playing && (
        <VideoModal
          src={playing.url}
          poster={playing.poster}
          title={product.name}
          onClose={() => setPlaying(null)}
        />
      )}
    </>
  );
}
