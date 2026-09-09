/** The wishlist: saved products plus the signals that make the page worth
 * revisiting.
 *
 * Baymard and NN/g both find the same thing about saved-for-later lists — the
 * list itself is not the value, the *changes* are. So a wishlist row carries
 * more than the product: whether the price fell since it was saved
 * (`saved_price`, added in migration 0004), whether it is in the running flash
 * sale, and whether it is already in the cart. Those three answer "should I
 * buy this now?", which is the only reason the page gets opened twice.
 */

import { getDB } from "@/lib/db";
import { getStoreProductsByIds } from "@/lib/storefront";
import { categoryName, toSummary } from "@/lib/categories";
import { flashPriceMap } from "@/lib/offers";
import type { ProductSummary, WishlistEntry, WishlistSort } from "@/types";

export { WISHLIST_SORTS, isWishlistSort } from "@/lib/wishlistSorts";

interface WishlistRow {
  product_id: string;
  saved_price: number | null;
  created_at: string;
}

export async function getWishlistProductIds(userId: string | null): Promise<Set<string>> {
  if (!userId) return new Set();
  const db = await getDB();
  const { results } = await db
    .prepare("SELECT product_id FROM wishlist_items WHERE user_id = ?")
    .bind(userId)
    .all<{ product_id: string }>();
  return new Set(results.map((r) => r.product_id));
}

/** Kept for callers that only need the product cards (e.g. a compact strip).
 * The full page uses `getWishlistEntries`. */
export async function getWishlistProducts(userId: string): Promise<ProductSummary[]> {
  const entries = await getWishlistEntries(userId);
  return entries.map((entry) => entry.product);
}

/** Saved items, resolved against the catalog, the flash sale and the cart.
 *
 * Rows whose product no longer exists are skipped rather than rendered as a
 * blank card — the row stays in the database so nothing is silently destroyed
 * if the product comes back. */
export async function getWishlistEntries(
  userId: string,
  sort: WishlistSort = "recent"
): Promise<WishlistEntry[]> {
  const db = await getDB();

  const [saved, cart] = await db.batch<Record<string, never>>([
    db
      .prepare(
        `SELECT product_id, saved_price, created_at
         FROM wishlist_items WHERE user_id = ? ORDER BY created_at DESC`
      )
      .bind(userId),
    db.prepare("SELECT DISTINCT product_id FROM cart_items WHERE user_id = ?").bind(userId),
  ]);

  const rows = saved.results as unknown as WishlistRow[];
  const inCart = new Set(
    (cart.results as unknown as { product_id: string }[]).map((r) => r.product_id)
  );
  const [flashPrices, catalog] = await Promise.all([
    flashPriceMap(),
    getStoreProductsByIds(rows.map((row) => row.product_id)),
  ]);

  // Category names are resolved once per distinct category rather than per
  // saved item, since a wishlist usually repeats a handful of departments.
  const categoryNames = new Map<string, string>();
  for (const row of rows) {
    const product = catalog.get(row.product_id);
    const id = product?.categoryId;
    if (id && !categoryNames.has(id)) categoryNames.set(id, await categoryName(id));
  }

  const entries = rows
    .map((row) => {
      const product = catalog.get(row.product_id);
      if (!product) return null;

      return {
        product: toSummary(product),
        savedPrice: row.saved_price,
        priceDrop: row.saved_price ? Math.max(0, row.saved_price - product.price) : 0,
        savedAt: row.created_at,
        categoryId: product.categoryId ?? "",
        categoryName: product.categoryId
          ? categoryNames.get(product.categoryId) ?? "Uncategorised"
          : "Uncategorised",
        flashPrice: flashPrices.get(product.id) ?? null,
        inCart: inCart.has(product.id),
      } satisfies WishlistEntry;
    })
    .filter((entry): entry is WishlistEntry => entry !== null);

  return sortEntries(entries, sort);
}

function sortEntries(entries: WishlistEntry[], sort: WishlistSort): WishlistEntry[] {
  switch (sort) {
    case "price_asc":
      return [...entries].sort((a, b) => a.product.price - b.product.price);
    case "price_desc":
      return [...entries].sort((a, b) => b.product.price - a.product.price);
    case "discount":
      return [...entries].sort(
        (a, b) => b.product.discountPercent - a.product.discountPercent
      );
    case "recent":
    default:
      // Already newest-first from the query.
      return entries;
  }
}

export async function getWishlistCount(userId: string | null): Promise<number> {
  if (!userId) return 0;
  const db = await getDB();
  const row = await db
    .prepare("SELECT COUNT(*) as count FROM wishlist_items WHERE user_id = ?")
    .bind(userId)
    .first<{ count: number }>();
  return row?.count ?? 0;
}

/** What the shopper would save by buying everything on the list today:
 * the gap between each item's original price and its live selling price,
 * plus anything the price has dropped since it was saved. */
export function wishlistSavings(entries: WishlistEntry[]): {
  total: number;
  droppedCount: number;
  onOfferCount: number;
} {
  let total = 0;
  let droppedCount = 0;
  let onOfferCount = 0;

  for (const entry of entries) {
    const selling = entry.flashPrice ?? entry.product.price;
    total += Math.max(0, entry.product.oldPrice - selling);
    if (entry.priceDrop > 0) droppedCount += 1;
    if (entry.flashPrice !== null) onOfferCount += 1;
  }

  return { total, droppedCount, onOfferCount };
}

export function wishlistTotal(entries: WishlistEntry[]): number {
  return entries.reduce(
    (total, entry) => total + (entry.flashPrice ?? entry.product.price),
    0
  );
}
