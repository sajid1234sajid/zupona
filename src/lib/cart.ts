import { getDB } from "@/lib/db";
import { getReferencedProductsByIds, getStoreProductsByIds } from "@/lib/storefront";
import { UNLIMITED_STOCK } from "@/lib/stockLimits";
import type { CartItem } from "@/types";

interface CartRow {
  id: string;
  product_id: string;
  variant_id: string | null;
  color: string;
  quantity: number;
  /** NULL when the variant inherits the product price, or when the line has
   * no variant at all. */
  variant_price: number | null;
  variant_old_price: number | null;
  stock_quantity: number | null;
  reserved_quantity: number | null;
  variant_active: number | null;
  /** 0 when the product sells without a ceiling, so the line's quantity is not
   * weighed against a count. */
  track_inventory: number;
}

export async function getCartItems(userId: string): Promise<CartItem[]> {
  const db = await getDB();
  const { results } = await db
    .prepare(
      `SELECT c.id, c.product_id, c.variant_id, c.color, c.quantity,
              v.price AS variant_price, v.old_price AS variant_old_price,
              v.stock_quantity, v.reserved_quantity, v.is_active AS variant_active,
              COALESCE(p.track_inventory, 1) AS track_inventory
       FROM cart_items c
       LEFT JOIN product_variants v ON v.id = c.variant_id
       LEFT JOIN products p ON p.id = c.product_id
       WHERE c.user_id = ? ORDER BY c.created_at DESC`
    )
    .bind(userId)
    .all<CartRow>();

  // One lookup for the whole cart rather than one per line, and it returns only
  // active products. Anything a line names that is not in it has been archived
  // or unpublished since, so it is looked up a second time without the status
  // filter -- not to sell it, but so the line can still be drawn and then be
  // marked as no longer available. The second query only runs when something is
  // actually missing.
  const productIds = results.map((row) => row.product_id);
  const catalog = await getStoreProductsByIds(productIds);
  const missing = productIds.filter((id) => !catalog.has(id));
  const unlisted = missing.length > 0 ? await getReferencedProductsByIds(missing) : new Map();

  return results
    .map((row) => {
      const product = catalog.get(row.product_id) ?? unlisted.get(row.product_id);
      // The product row itself is gone. `cart_items.product_id` carries no
      // foreign key, so an orphan line is possible -- and there is no name,
      // picture or price left to draw it with, so this one really is dropped.
      if (!product) return null;

      // Two ways a line can stop being buyable, and neither may make it vanish.
      // The variant it names was retired, or the product itself was archived.
      // An item disappearing from a cart with no explanation is worse than one
      // shown as no longer available -- so the line is kept and marked. It
      // cannot be bought: it is left out of the total, its stepper is disabled,
      // and checkout refuses while it is there.
      const variantRetired =
        row.variant_id !== null && (row.variant_active === null || row.variant_active !== 1);
      const productArchived = !catalog.has(row.product_id);
      const unavailable = variantRetired || productArchived;

      // The variant's own price where it has one, the product's otherwise --
      // the `effectivePrice` the schema asks callers to read rather than
      // `price`. Every total downstream is built from this.
      const price = row.variant_price ?? product.price;
      const oldPrice = row.variant_old_price ?? product.oldPrice;
      // A retired variant or an archived product is unbuyable whatever its
      // stock says. Past that, a product that does not count its units has no
      // ceiling at all -- the same answer a line with no variant has always
      // given, now reached for a second reason.
      const available = unavailable
        ? 0
        : row.track_inventory === 0
          ? UNLIMITED_STOCK
          : row.variant_id
            ? Math.max(0, (row.stock_quantity ?? 0) - (row.reserved_quantity ?? 0))
            : product.inStock
              ? UNLIMITED_STOCK
              : 0;

      return {
        id: row.id,
        productId: row.product_id,
        variantId: row.variant_id,
        color: row.color,
        quantity: row.quantity,
        available,
        unavailable,
        product: {
          id: product.id,
          name: product.name,
          image: product.image,
          price,
          oldPrice,
          discountPercent:
            oldPrice > price ? Math.round(((oldPrice - price) / oldPrice) * 100) : 0,
          rating: product.rating,
          reviews: product.reviews,
        },
      } satisfies CartItem;
    })
    .filter((item): item is CartItem => item !== null);
}

export async function getCartCount(userId: string | null): Promise<number> {
  if (!userId) return 0;
  const db = await getDB();
  const row = await db
    .prepare("SELECT COALESCE(SUM(quantity), 0) as count FROM cart_items WHERE user_id = ?")
    .bind(userId)
    .first<{ count: number }>();
  return row?.count ?? 0;
}

/** What the shopper would pay. A line that can no longer be bought is not in
 * it, so the total always matches what checkout would actually charge. */
export function cartSubtotal(items: CartItem[]): number {
  return items
    .filter((item) => !item.unavailable)
    .reduce((sum, item) => sum + item.product.price * item.quantity, 0);
}
