/** Turning "the browser says it wants this" into "here is what it actually costs".
 *
 * Both ways of buying -- adding to the cart and Buy Now -- start here, so there
 * is one place that decides whether a selection is real and what it is worth.
 * The request carries a product id, an optional variant id and a quantity, and
 * nothing else: no price, no stock figure, no discount. All three are read back
 * out of the catalogue here.
 *
 * Server-only. Callers are server actions and server components. */

import { getStoreProduct } from "@/lib/storefront";
import { UNLIMITED_STOCK } from "@/lib/stockLimits";

export type ResolvedSelection =
  | {
      ok: true;
      productId: string;
      variantId: string | null;
      quantity: number;
      /** The chosen options as shown on a cart or order line, "Olive / M". */
      label: string;
      /** The variant's own price, or the product's where it has none. */
      price: number;
      oldPrice: number;
      /** Stock left after existing reservations. */
      available: number;
      name: string;
      image: string;
      /** Whether this product carries its own delivery, for the Buy Now line
       * that checkout prices. A Buy Now order is one product, so this alone
       * decides it -- unlike a cart, which has to be free on every line. */
      freeDelivery: boolean;
    }
  | { ok: false; error: string };

/**
 * Resolves and validates a selection against the database.
 *
 * A product with variants must name one: an id that does not belong to this
 * product, or none at all, is refused rather than quietly falling back to the
 * first row. A product without variants needs no selection.
 */
export async function resolveSelection(input: {
  productId: string;
  variantId?: string | null;
  quantity: number;
}): Promise<ResolvedSelection> {
  const quantity = Math.floor(Number(input.quantity));
  if (!Number.isFinite(quantity) || quantity < 1) {
    return { ok: false, error: "Choose how many you want." };
  }

  const product = await getStoreProduct(input.productId);
  if (!product) return { ok: false, error: "This product is no longer available." };

  const variants = product.variants ?? [];

  // Empty for two different reasons, and only one of them is sellable. A
  // product that never had options sells from the product row itself; one whose
  // combinations have all been retired in the admin panel has nothing left for
  // a cart line to name, and must be refused here rather than quietly becoming
  // an option-less line. The page already disables the button -- this is the
  // copy of the rule that counts.
  if (variants.length === 0 && (product.optionGroups ?? []).length > 0) {
    return { ok: false, error: "This product is not available right now." };
  }

  if (variants.length === 0) {
    return {
      ok: true,
      productId: product.id,
      variantId: null,
      quantity,
      label: "",
      price: product.price,
      oldPrice: product.oldPrice,
      available: product.tracksInventory ? product.stockTotal : UNLIMITED_STOCK,
      name: product.name,
      image: product.image,
      freeDelivery: product.freeDelivery === true,
    };
  }

  const variant = variants.find((entry) => entry.id === input.variantId);
  if (!variant) return { ok: false, error: "Choose an option before continuing." };

  // Built in the order the options are shown, so the same variant always reads
  // the same way -- and, because a cart row is unique per variant, the label is
  // for the shopper rather than a key.
  //
  // `optionValues` holds each group's slug, because that is what the page
  // matches a selection on. The slug is not what anyone should read: a value
  // created in the option builder is "black-gold" with a label of "Black &
  // Gold", and it is the label that belongs on a cart line, an order line and
  // a confirmation. They are the same string only for products that predate
  // the builder, which is why this went unnoticed.
  const label = (product.optionGroups ?? [])
    .map((group) => {
      const slug = variant.optionValues[group.key];
      if (!slug) return null;
      return group.values.find((value) => value.value === slug)?.label ?? slug;
    })
    .filter(Boolean)
    .join(" / ");

  return {
    ok: true,
    productId: product.id,
    variantId: variant.id,
    quantity,
    label,
    price: variant.price,
    oldPrice: variant.compareAtPrice,
    available: variant.available,
    name: product.name,
    image: product.image,
    freeDelivery: product.freeDelivery === true,
  };
}
