import { getDB } from "@/lib/db";
import { getStoreProductsByIds } from "@/lib/storefront";
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
}

export async function getCartItems(userId: string): Promise<CartItem[]> {
  const db = await getDB();
  const { results } = await db
    .prepare(
      `SELECT c.id, c.product_id, c.variant_id, c.color, c.quantity,
              v.price AS variant_price, v.old_price AS variant_old_price,
              v.stock_quantity, v.reserved_quantity, v.is_active AS variant_active
       FROM cart_items c
       LEFT JOIN product_variants v ON v.id = c.variant_id
       WHERE c.user_id = ? ORDER BY c.created_at DESC`
    )
    .bind(userId)
    .all<CartRow>();

  // One lookup for the whole cart rather than one per line. A product that has
  // since been archived is simply missing from the map, which drops it from
  // the cart instead of rendering an empty row.
  const catalog = await getStoreProductsByIds(results.map((row) => row.product_id));

  return results
    .map((row) => {
      const product = catalog.get(row.product_id);
      if (!product) return null;

      // A line naming a variant that has since been deleted or deactivated is
      // dropped the same way an archived product is: better an item quietly
      // gone from the cart than one that cannot be bought at checkout.
      if (row.variant_id && (row.variant_active === null || row.variant_active !== 1)) return null;

      // The variant's own price where it has one, the product's otherwise --
      // the `effectivePrice` the schema asks callers to read rather than
      // `price`. Every total downstream is built from this.
      const price = row.variant_price ?? product.price;
      const oldPrice = row.variant_old_price ?? product.oldPrice;
      const available = row.variant_id
        ? Math.max(0, (row.stock_quantity ?? 0) - (row.reserved_quantity ?? 0))
        : product.inStock
          ? Number.MAX_SAFE_INTEGER
          : 0;

      return {
        id: row.id,
        productId: row.product_id,
        variantId: row.variant_id,
        color: row.color,
        quantity: row.quantity,
        available,
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

export function cartSubtotal(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
}
