"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Heart, LayoutGrid, LoaderCircle, ShoppingCart, Star, Zap } from "lucide-react";
import type { StoreProduct } from "@/lib/storefront";
import { formatPrice } from "@/lib/format";
import { addSelectionToCartAction, buyNowAction } from "@/app/cart/actions";
import { callAction } from "@/lib/callAction";
import { trackPixel } from "@/components/analytics/MetaPixel";
import { toggleWishlistAction } from "@/app/wishlist/actions";
import ProductMedia from "./ProductMedia";
import OptionGroups from "./OptionGroups";
import QuantityPicker from "./QuantityPicker";
import ShareButton from "./ShareButton";
import FeatureBar from "./FeatureBar";
import PurchaseInfo, { type DeliveryLine } from "./PurchaseInfo";
import {
  findVariant,
  initialSelections,
  resolvePricing,
  type Selections,
} from "./variantMatching";

/** What a refused request says. The shopper did nothing wrong and pressing
 * again nearly always works, so the message asks for exactly that. */
const NETWORK_MESSAGE = "Connection problem — please try again.";

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
  returnDays,
  exchangeDays,
  estimatedDelivery,
  reviewSummary,
  hasSimilar,
  initiallyWishlisted,
  showStock,
}: {
  product: StoreProduct;
  /** Built on the server from the category tree, which the read model returns
   * as ids rather than a trail. */
  breadcrumbs: string[];
  deliveryLines: DeliveryLine[];
  returnDays: number;
  exchangeDays: number;
  estimatedDelivery: string | null;
  /** Read fresh from the reviews table rather than the cached product, so a
   * review just posted is counted straight away. */
  reviewSummary: { average: number; total: number };
  /** Whether there is a Similar Products section for "View Similar" to reach. */
  hasSimilar: boolean;
  initiallyWishlisted: boolean;
  /** Whether the shopper sees how many units are left. Off, the stats row says
   * only whether the item can be bought -- the count is the shop's own figure
   * and the admin panel is where it is read. */
  showStock: boolean;
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

  // A product with options but nothing sellable left -- every combination
  // retired in the admin panel -- has no variant for a cart line to name, so it
  // cannot be bought whatever its stock says. The distinction matters because
  // `variants` is empty in two different situations: a product that never had
  // options, which sells from the product itself, and one whose combinations
  // have all been withdrawn, which sells nothing.
  const soldOutOfOptions = optionGroups.length > 0 && variants.length === 0;
  const sellable = available > 0 && !soldOutOfOptions;
  const canBuy =
    sellable && (optionGroups.length === 0 || (Boolean(variant) && selectionComplete));

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

  function addToCart() {
    setFeedback(null);
    return async () => {
      // Through `callAction`, so a request the Worker refuses becomes a line of
      // text under the button rather than the end of the page.
      const attempt = await callAction(() =>
        addSelectionToCartAction({
          productId: product.id,
          variantId: variant?.id ?? null,
          quantity,
        })
      );

      if (!attempt.ok) {
        setFeedback({ ok: false, message: NETWORK_MESSAGE });
        return;
      }

      const result = attempt.value;
      if (!result.ok) {
        setFeedback({ ok: false, message: result.error ?? "Could not add to the cart." });
        return;
      }

      setFeedback({ ok: true, message: "Added to your cart." });

      // Reported from the browser, and only once the server has said yes: an
      // add to cart Meta hears about that never happened teaches a campaign
      // the wrong thing. The variant carries the price where it has one.
      trackPixel("AddToCart", {
        content_ids: [product.id],
        content_name: product.name,
        content_type: "product",
        currency: "BDT",
        value: (variant?.price ?? product.price) * quantity,
      });
      // Refreshes the header's cart count from the server rather than guessing
      // it, so what the badge shows is what the database holds.
      router.refresh();
    };
  }

  /** Buy Now opens a session for this line alone. It does not touch the cart,
   * so a shopper with items saved does not pay for them by accident. */
  function buyNow() {
    setFeedback(null);
    return async () => {
      const attempt = await callAction(() =>
        buyNowAction({
          productId: product.id,
          variantId: variant?.id ?? null,
          quantity,
        })
      );

      if (!attempt.ok) {
        setFeedback({ ok: false, message: NETWORK_MESSAGE });
        return;
      }

      const result = attempt.value;
      if (!result.ok) {
        setFeedback({ ok: false, message: result.error ?? "Could not start checkout." });
        return;
      }

      router.push("/checkout?mode=buynow");
    };
  }

  function toggleWishlist() {
    const next = !wishlisted;
    setWishlisted(next);
    startWish(async () => {
      // The heart has already moved; if the save is refused, put it back rather
      // than letting the rejection escape and take the page with it.
      const attempt = await callAction(() => toggleWishlistAction(product.id));
      if (!attempt.ok) {
        setWishlisted(!next);
        return;
      }
      router.refresh();
    });
  }

  const actions = (
    <>
      <button
        type="button"
        onClick={() => startAdd(addToCart())}
        disabled={!canBuy || addPending || buyPending}
        className="flex min-h-[46px] flex-1 items-center justify-center gap-2 rounded-full border-2 border-brand-darkest bg-white px-4 text-sm font-extrabold text-brand-darkest transition disabled:cursor-not-allowed disabled:opacity-45 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
      >
        {addPending ? (
          <LoaderCircle className="h-4 w-4 animate-spin" />
        ) : (
          <ShoppingCart className="h-[18px] w-[18px]" />
        )}
        {sellable ? "Add to Cart" : "Out of Stock"}
      </button>

      <button
        type="button"
        onClick={() => startBuy(buyNow())}
        disabled={!canBuy || addPending || buyPending}
        className="flex min-h-[46px] flex-1 items-center justify-center gap-2 rounded-full bg-brand px-4 text-sm font-extrabold text-white transition disabled:cursor-not-allowed disabled:opacity-45 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
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
                  {index > 0 && <span className="px-1.5 text-ink-faint">/</span>}
                  {crumb}
                </span>
              ))}
            </nav>
          )}

          <ProductMedia
            media={media}
            activeId={activeMediaId}
            onSelect={setActiveMediaId}
            badgeLabel={product.badgeLabel}
            productName={product.name}
            toolbar={<ShareButton title={product.name} />}
            overlayStart={
              (reviewSummary.total > 0 || product.soldCount > 0) && (
                <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-bold text-heading shadow-card">
                  {reviewSummary.total > 0 && (
                    <span className="flex items-center gap-0.5">
                      <Star className="h-3 w-3 fill-gold text-gold" aria-hidden />
                      {reviewSummary.average.toFixed(1)}
                    </span>
                  )}
                  {reviewSummary.total > 0 && product.soldCount > 0 && (
                    <span aria-hidden className="h-3 w-px bg-line" />
                  )}
                  {product.soldCount > 0 && <span>{product.soldCount.toLocaleString("en-US")} sold</span>}
                </span>
              )
            }
            overlayEnd={
              hasSimilar && (
                <a
                  href="#similar"
                  className="flex min-h-[32px] shrink-0 items-center gap-1.5 rounded-full bg-white/95 px-3 text-[11px] font-bold text-brand-darkest shadow-card focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                >
                  <LayoutGrid className="h-3.5 w-3.5" aria-hidden />
                  View Similar
                </a>
              )
            }
          />
        </div>

        <div className="min-w-0 pt-4 tab:pt-0">
          <p className="text-[11px] font-extrabold uppercase tracking-wide text-brand">
            {product.categoryName}
            {product.brand && <span className="text-ink-soft"> · {product.brand}</span>}
          </p>

          <div className="mt-1.5 flex items-start justify-between gap-3">
            <h1 className="text-[clamp(22px,6.3vw,32px)] font-extrabold leading-[1.12] tracking-[-0.02em] text-heading">
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

          {/* Reviews | Sold | Stock. Availability follows the selected option, so
              it speaks for the size on screen. Three ways it can read: a
              product that counts nothing says nothing at all, one that counts
              but keeps the figure to itself says In Stock or Out of Stock, and
              one the shop has chosen to be open about names the number.
              `!== false` because KV can still be serving an entry written
              before the field existed, the way the option fields are read. */}
          <div className="mt-2.5 flex flex-wrap items-center gap-y-1.5 text-[13px]">
            <a
              href="#reviews"
              className="flex min-h-[36px] items-center gap-1 rounded-md font-semibold text-heading focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              {reviewSummary.total > 0 && (
                <>
                  <Star className="h-4 w-4 fill-gold text-gold" aria-hidden />
                  {reviewSummary.average.toFixed(1)}
                  <span className="text-ink-muted">·</span>
                </>
              )}
              {reviewSummary.total} {reviewSummary.total === 1 ? "Review" : "Reviews"}
            </a>
            <span aria-hidden className="mx-2.5 h-3.5 w-px bg-line" />
            <span className="font-semibold text-heading">
              Sold {product.soldCount.toLocaleString("en-US")}
            </span>
            {(product.tracksInventory !== false || soldOutOfOptions) && (
              <>
                <span aria-hidden className="mx-2.5 h-3.5 w-px bg-line" />
                <span className={`font-semibold ${sellable ? "text-brand" : "text-accent-red"}`}>
                  {sellable
                    ? showStock
                      ? `Stock ${available.toLocaleString("en-US")}`
                      : "In Stock"
                    : "Out of Stock"}
                </span>
              </>
            )}
          </div>

          <div className="mt-3 flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="text-[30px] font-extrabold leading-none tracking-tight text-brand">
              {formatPrice(price)}
            </span>
            {compareAtPrice > price && (
              <span className="text-sm text-ink-faint line-through">{formatPrice(compareAtPrice)}</span>
            )}
            {discountPercent > 0 && (
              <span className="text-sm font-extrabold text-brand">({discountPercent}% OFF)</span>
            )}
          </div>

          <div className="mt-4 rounded-2xl border border-line bg-white p-4">
            {optionGroups.length > 0 && (
              <div className="mb-4">
                <OptionGroups
                  groups={optionGroups}
                  variants={variants}
                  selections={selections}
                  onSelect={choose}
                />
              </div>
            )}

            <QuantityPicker quantity={quantity} available={available} onChange={setQuantity} />

            <div className="mt-4 border-t border-dashed border-line pt-4">
              <PurchaseInfo
                returnDays={returnDays}
                exchangeDays={exchangeDays}
                estimatedDelivery={estimatedDelivery}
                deliveryLines={deliveryLines}
                returnPolicy={product.returnPolicy}
                warranty={product.warranty}
              />
            </div>
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
        </div>
      </div>

      {/* Mobile only: the buy buttons ride above the tab bar. Both go away
          once there is room to put them beside the product instead. */}
      <div className="fixed inset-x-0 bottom-[68px] z-40 flex gap-2.5 border-t border-line bg-surface px-4 py-2.5 tab:hidden">
        {actions}
      </div>
    </>
  );
}
