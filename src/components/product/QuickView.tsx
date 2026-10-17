"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, LoaderCircle, ShoppingCart, X } from "lucide-react";
import Image from "@/components/ui/StoreImage";
import type { StoreProduct } from "@/lib/storefront";
import Price from "@/components/ui/Price";
import { addSelectionToCartAction } from "@/app/cart/actions";
import { callAction } from "@/lib/callAction";
import { signalCartAdd } from "@/lib/cartSignal";
import { trackPixel } from "@/components/analytics/MetaPixel";
import OptionGroups from "./dynamic/OptionGroups";
import QuantityPicker from "./dynamic/QuantityPicker";
import { findVariant, initialSelections, resolvePricing, type Selections } from "./dynamic/variantMatching";

/** The picker a product card opens when its product comes in options.
 *
 * A shirt cannot go into a cart as "a shirt": it needs a size, and often a
 * colour. The card's cart button used to add it anyway, with nothing chosen,
 * which left an order line nobody could pack. Now the button opens this:
 * the photo, the price, the same option selectors and quantity the product
 * page uses, and an Add to cart that stays disabled until every option is
 * picked. The server checks the choice again when it is added.
 *
 * A bottom sheet on a phone, a dialog on a laptop. */
export default function QuickView({
  productId,
  slug,
  onClose,
  onAdded,
}: {
  productId: string;
  slug: string;
  onClose: () => void;
  onAdded: () => void;
}) {
  const router = useRouter();
  const [product, setProduct] = useState<StoreProduct | null>(null);
  const [failed, setFailed] = useState(false);
  const [selections, setSelections] = useState<Selections>({});
  const [quantity, setQuantity] = useState(1);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/products/${encodeURIComponent(productId)}`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(String(response.status));
        return response.json() as Promise<StoreProduct>;
      })
      .then((loaded) => {
        setProduct(loaded);
        // A size is the shopper's to choose: pre-picking one from a grid tap
        // is how the wrong size gets ordered. A colour can start chosen --
        // the picture shows which it is.
        const start = initialSelections(loaded);
        const size = (loaded.optionGroups ?? []).find((group) => group.key === "size");
        if (size && size.values.length > 1) delete start.size;
        setSelections(start);
      })
      .catch((error) => {
        if ((error as Error)?.name !== "AbortError") setFailed(true);
      });
    return () => controller.abort();
  }, [productId]);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const groups = useMemo(() => product?.optionGroups ?? [], [product]);
  const variants = useMemo(() => product?.variants ?? [], [product]);
  const keys = useMemo(() => groups.map((group) => group.key), [groups]);
  const variant = useMemo(() => findVariant(variants, selections, keys), [variants, selections, keys]);
  const pricing = product ? resolvePricing(product, variant) : null;

  const missing = groups.find((group) => !selections[group.key]);
  const canAdd =
    Boolean(product) &&
    (pricing?.available ?? 0) > 0 &&
    !missing &&
    (groups.length === 0 || Boolean(variant));

  // The variant's own picture when it has one.
  const image =
    (variant?.imageId && product?.media?.find((item) => item.id === variant.imageId)?.url) ||
    product?.image;

  function add() {
    if (!product || !canAdd) return;
    setMessage(null);
    startTransition(async () => {
      const attempt = await callAction(() =>
        addSelectionToCartAction({ productId: product.id, variantId: variant?.id ?? null, quantity })
      );
      if (!attempt.ok) {
        setMessage("Connection problem — please try again.");
        return;
      }
      if (!attempt.value.ok) {
        setMessage(attempt.value.error ?? "Could not add to the cart.");
        return;
      }
      signalCartAdd(quantity);
      trackPixel("AddToCart", {
        content_ids: [product.id],
        content_name: product.name,
        content_type: "product",
        currency: "BDT",
        value: (attempt.value.price ?? pricing?.price ?? product.price) * quantity,
      }, attempt.value.eventId);
      router.refresh();
      onAdded();
    });
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-heading/45 tab:items-center tab:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={product ? `Choose options for ${product.name}` : "Choose options"}
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div className="relative max-h-[88vh] w-full overflow-y-auto rounded-t-3xl bg-white p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] tab:max-w-[760px] tab:rounded-3xl tab:p-6">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 z-10 grid h-9 w-9 place-items-center rounded-full bg-white/90 text-ink hover:bg-brand-mist"
        >
          <X className="h-5 w-5" />
        </button>

        {failed ? (
          <p className="py-10 text-center text-[13px] text-ink-muted">
            Could not load this product.{" "}
            <Link href={`/products/${slug}`} className="font-semibold text-brand">
              Open its page
            </Link>
          </p>
        ) : !product || !pricing ? (
          <div className="flex gap-4" aria-busy="true">
            <div className="aspect-[4/5] w-28 shrink-0 animate-pulse rounded-2xl bg-skeleton tab:w-[300px]" />
            <div className="flex-1 space-y-3 pt-2">
              <div className="h-4 w-3/4 animate-pulse rounded bg-skeleton" />
              <div className="h-6 w-1/3 animate-pulse rounded bg-skeleton" />
              <div className="h-10 w-full animate-pulse rounded-xl bg-skeleton" />
            </div>
          </div>
        ) : (
          <div className="tab:grid tab:grid-cols-[300px_1fr] tab:gap-6">
            <div className="flex gap-3 tab:block">
              <div className="relative aspect-[4/5] w-28 shrink-0 overflow-hidden rounded-2xl bg-brand-mist tab:w-full">
                {image ? (
                  <Image src={image} alt={product.name} fill sizes="(min-width: 700px) 300px, 112px" style={{ objectFit: "contain" }} />
                ) : null}
              </div>
              <div className="min-w-0 pr-8 tab:hidden">
                <h2 className="line-clamp-2 text-[14px] font-semibold text-heading">{product.name}</h2>
                <Prices pricing={pricing} />
              </div>
            </div>

            <div className="mt-4 tab:mt-0">
              <div className="hidden pr-8 tab:block">
                <h2 className="line-clamp-2 text-lg font-bold text-heading">{product.name}</h2>
                <Prices pricing={pricing} />
              </div>

              <div className="mt-4 space-y-4">
                <OptionGroups
                  groups={groups}
                  variants={variants}
                  selections={selections}
                  onSelect={(key, value) => {
                    setSelections((current) => ({ ...current, [key]: value }));
                    setQuantity(1);
                    setMessage(null);
                  }}
                />
                <QuantityPicker quantity={quantity} available={pricing.available} onChange={setQuantity} />
              </div>

              <button
                type="button"
                onClick={add}
                disabled={!canAdd || pending}
                className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-brand text-[15px] font-bold text-white transition-colors hover:bg-brand-dark disabled:bg-brand/40"
              >
                {pending ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <ShoppingCart className="h-5 w-5" />}
                Add to cart
              </button>
              <p className="mt-2 min-h-[18px] text-center text-[12.5px] font-semibold text-urgency" role="status">
                {message ??
                  (pricing.available <= 0
                    ? "This option is out of stock."
                    : missing
                      ? `Please select a ${missing.name.toLowerCase()}`
                      : "")}
              </p>

              <Link
                href={`/products/${slug}`}
                prefetch={false}
                onClick={onClose}
                className="mt-1 flex items-center justify-center gap-1 text-[13px] font-semibold text-brand hover:underline"
              >
                View full details <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

function Prices({ pricing }: { pricing: { price: number; compareAtPrice: number; discountPercent: number } }) {
  return <Price price={pricing.price} compareAt={pricing.compareAtPrice} size="sheet" className="mt-1.5" />;
}
