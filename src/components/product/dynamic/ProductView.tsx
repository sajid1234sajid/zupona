"use client";

import { useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Flame, Heart, LayoutGrid, LoaderCircle, MessageCircle, ShoppingCart, Star, Trophy, Zap } from "lucide-react";
import Image from "@/components/ui/StoreImage";
import type { ProductRank } from "@/lib/bestSellers";
import type { SizeGuide as SizeGuideTable } from "@/lib/sizeGuide";
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
import SizeGuide from "./SizeGuide";
import StickyColumn from "./StickyColumn";
import {
  findVariant,
  imageFor,
  openingSelections,
  optionSlug,
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
  requested = {},
  whatsapp,
  productUrl,
  rank = null,
  lowStockThreshold = 0,
  sizeGuide = null,
  fit = null,
  guarantees,
  details,
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
  /** Options named in the link (`?color=grey&size=m`), opened on. */
  requested?: Record<string, string>;
  /** The shop's WhatsApp number, for "Ask on WhatsApp". */
  whatsapp: string;
  /** This page's full address, quoted in the WhatsApp message. */
  productUrl: string;
  /** Its place among its category's best sellers, when it has one. */
  rank?: ProductRank | null;
  /** At or under this many left, the page says "Only N left". */
  lowStockThreshold?: number;
  sizeGuide?: SizeGuideTable | null;
  fit?: { small: number; true: number; large: number } | null;
  /** The promises box under the delivery details. */
  guarantees?: ReactNode;
  /** Description, reviews and the seller: under the gallery on a wide screen,
   * under the buy box on a phone. */
  details?: ReactNode;
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

  const [selections, setSelections] = useState<Selections>(() => openingSelections(product, requested));
  const [activeMediaId, setActiveMediaId] = useState(() => {
    const chosen = imageFor(variants, selections);
    return chosen && media.some((item) => item.id === chosen) ? chosen : (media[0]?.id ?? "");
  });
  const [missing, setMissing] = useState<string | null>(null);
  const actionsRef = useRef<HTMLDivElement>(null);
  const [barShown, setBarShown] = useState(false);

  useEffect(() => {
    const node = actionsRef.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      ([entry]) => setBarShown(!entry.isIntersecting && entry.boundingClientRect.top < 0),
      { rootMargin: "-64px 0px 0px 0px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
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
  const missingGroup = optionGroups.find((group) => !selections[group.key]) ?? null;
  const lowStock =
    showStock && product.tracksInventory !== false && Boolean(variant) && available > 0 && available <= lowStockThreshold;
  const chosenText = optionGroups
    .map((group) => group.values.find((value) => value.value === selections[group.key])?.label)
    .filter(Boolean)
    .join(", ");
  const chosenQuery = optionGroups
    .map((group) => {
      const label = group.values.find((value) => value.value === selections[group.key])?.label;
      return label ? `${group.key}=${optionSlug(label)}` : null;
    })
    .filter(Boolean)
    .join("&");
  const whatsappHref = `https://wa.me/${whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(
    `Hi Zupona! I have a question about this product:\n${product.name}${chosenText ? ` (${chosenText})` : ""} – ${formatPrice(price)}\n${productUrl}${chosenQuery ? `?${chosenQuery}` : ""}`
  )}`;

  /** Buying needs every option answered. Rather than a dead button, a tap
   * says which one is missing and takes the shopper to it. */
  function ready(): boolean {
    if (missingGroup) {
      setMissing(missingGroup.key);
      setFeedback({ ok: false, message: `Please select a ${missingGroup.name.toLowerCase()}.` });
      document.getElementById(`option-${missingGroup.key}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      return false;
    }
    if (!canBuy) {
      setFeedback({ ok: false, message: "That combination isn't available. Try another." });
      return false;
    }
    return true;
  }

  function choose(groupKey: string, value: string) {
    const next = { ...selections, [groupKey]: value };
    setSelections(next);
    setFeedback(null);
    setMissing(null);
    setQuantity(1);

    // A colour with its own picture brings the gallery with it, before the
    // size is chosen too.
    const picture = imageFor(variants, next);
    if (picture && media.some((item) => item.id === picture)) {
      setActiveMediaId(picture);
    }

    // The choice goes into the address, so a shared or bookmarked link opens
    // on the same colour and size. Other parameters (ad tracking) are kept.
    try {
      const url = new URL(window.location.href);
      for (const group of optionGroups) {
        const label = group.values.find((entry) => entry.value === next[group.key])?.label;
        if (label) url.searchParams.set(group.key, optionSlug(label));
      }
      window.history.replaceState(window.history.state, "", url);
    } catch {
      // An address that will not update is no reason to lose the choice.
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
        value: (result.price ?? variant?.price ?? product.price) * quantity,
      }, result.eventId);
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
    if (next) {
      trackPixel("AddToWishlist", {
        content_ids: [product.id],
        content_name: product.name,
        content_type: "product",
        currency: "BDT",
        value: variant?.price ?? product.price,
      });
    }
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
        onClick={() => ready() && startAdd(addToCart())}
        disabled={!sellable || addPending || buyPending}
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
        onClick={() => ready() && startBuy(buyNow())}
        disabled={!sellable || addPending || buyPending}
        className="flex min-h-[46px] flex-1 items-center justify-center gap-2 rounded-full bg-brand px-4 text-sm font-extrabold text-white transition disabled:cursor-not-allowed disabled:opacity-45 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
      >
        {buyPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Zap className="h-[18px] w-[18px] fill-current" />}
        Buy Now
      </button>
    </>
  );

  return (
    <>
      <div className="tab:grid tab:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)] tab:items-start tab:gap-x-8">
        <div className="min-w-0 tab:col-start-1 tab:row-start-1">
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

        {/* The buy box spans the gallery and the details beside it, and keeps
            to the screen while they scroll past. */}
        <div className="min-w-0 pt-4 tab:col-start-2 tab:row-span-2 tab:row-start-1 tab:self-stretch tab:pt-0">
        <StickyColumn>
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

          {rank ? (
            <Link
              href="/best-sellers"
              prefetch={false}
              className="mt-1.5 inline-flex min-h-[30px] items-center gap-1.5 rounded-full bg-badge-bg px-3 text-[12px] font-bold text-heading"
            >
              <Trophy className="h-3.5 w-3.5 text-rating" aria-hidden />#{rank.position} best seller in {rank.category}
            </Link>
          ) : null}

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
            {lowStock ? (
              <span className="inline-flex items-center gap-1 self-center rounded-full bg-urgency/10 px-2.5 py-1 text-[11.5px] font-bold text-urgency">
                <Flame className="h-3.5 w-3.5" aria-hidden />
                Only {available} left
              </span>
            ) : null}
          </div>

          <div className="mt-4 rounded-2xl border border-line bg-white p-4">
            {optionGroups.length > 0 && (
              <div className="mb-4">
                <OptionGroups
                  groups={optionGroups}
                  variants={variants}
                  selections={selections}
                  onSelect={choose}
                  missing={missing}
                  aside={(key) => (key === "size" && sizeGuide ? <SizeGuide guide={sizeGuide} fit={fit} /> : null)}
                />
                {fit && optionGroups.some((group) => group.key === "size") ? <FitLine fit={fit} /> : null}
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

          <div ref={actionsRef} className="mt-4 hidden gap-3 tab:flex">
            {actions}
          </div>

          <a
            href={whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 flex min-h-[44px] items-center justify-center gap-2 rounded-full border border-line bg-white text-[13px] font-bold text-heading hover:border-brand"
          >
            <MessageCircle className="h-[18px] w-[18px] text-[#25D366]" aria-hidden />
            Ask on WhatsApp
          </a>

          {guarantees ? <div className="mt-4">{guarantees}</div> : null}

          <FeatureBar features={product.features ?? []} />
        </StickyColumn>
        </div>

        {details ? <div className="mt-4 min-w-0 space-y-4 tab:col-start-1 tab:row-start-2 tab:mt-8">{details}</div> : null}
      </div>

      {/* Wide screens: once the buy buttons scroll out of sight, a slim bar
          under the header keeps them one click away. */}
      {barShown ? (
        <div className="fixed inset-x-0 top-16 z-30 hidden border-b border-line bg-white/95 shadow-card backdrop-blur tab:block">
          <div className="mx-auto flex max-w-[1200px] items-center gap-3 px-6 py-2">
            {media[0]?.poster ? (
              <span className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-mint">
                <Image src={media.find((item) => item.id === activeMediaId)?.poster ?? media[0].poster} alt="" fill sizes="44px" className="object-cover" />
              </span>
            ) : null}
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-bold text-heading">{product.name}</p>
              <p className="text-[12px] text-ink-slate">
                <span className="font-extrabold text-brand">{formatPrice(price)}</span>
                {chosenText ? ` · ${chosenText}` : ""}
              </p>
            </div>
            <div className="flex w-[340px] shrink-0 gap-2">{actions}</div>
          </div>
        </div>
      ) : null}

      {/* Mobile only: the buy buttons take the bottom of the screen, where the
          tab bar sits on other pages. They go away once there is room to put
          them beside the product instead. */}
      <div className="fixed inset-x-0 bottom-0 z-40 flex gap-2.5 border-t border-line bg-surface px-4 pt-2.5 pb-[calc(10px+env(safe-area-inset-bottom))] shadow-[0_-2px_12px_rgba(0,60,40,0.07)] tab:hidden">
        {actions}
      </div>
    </>
  );
}

/** "Most say true to size", from the reviews that answered, once enough have. */
function FitLine({ fit }: { fit: { small: number; true: number; large: number } }) {
  const answered = fit.small + fit.true + fit.large;
  if (answered < 3) return null;
  const share = (n: number) => Math.round((n / answered) * 100);
  const lean =
    fit.small > fit.true && fit.small >= fit.large
      ? `${share(fit.small)}% say it runs small – consider a size up`
      : fit.large > fit.true && fit.large > fit.small
        ? `${share(fit.large)}% say it runs large`
        : `${share(fit.true)}% say it fits true to size`;
  return <p className="mt-2.5 text-[12px] font-semibold text-ink-slate">ⓘ {lean} ({answered} reviews)</p>;
}
