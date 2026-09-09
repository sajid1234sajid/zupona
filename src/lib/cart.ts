import { getDB } from "@/lib/db";
import { getStoreProductsByIds } from "@/lib/storefront";
import type { CartItem } from "@/types";

interface CartRow {
  id: string;
  product_id: string;
  color: string;
  quantity: number;
}

export async function getCartItems(userId: string): Promise<CartItem[]> {
  const db = await getDB();
  const { results } = await db
    .prepare("SELECT id, product_id, color, quantity FROM cart_items WHERE user_id = ? ORDER BY created_at DESC")
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
      return {
        id: row.id,
        productId: row.product_id,
        color: row.color,
        quantity: row.quantity,
        product: {
          id: product.id,
          name: product.name,
          image: product.image,
          price: product.price,
          oldPrice: product.oldPrice,
          discountPercent: product.discountPercent,
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
