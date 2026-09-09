"use server";

import { revalidatePath } from "next/cache";
import { getDB } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { getStoreProductCard, getStoreProductsByIds } from "@/lib/storefront";
import { flashPriceFor } from "@/lib/offers";

/** Every wishlist mutation revalidates these: the list itself, and the two
 * places that render a wishlist count or a filled heart. */
function revalidateWishlist(): void {
  revalidatePath("/wishlist");
  revalidatePath("/");
  revalidatePath("/cart");
}

export async function toggleWishlistAction(productId: string): Promise<void> {
  const user = await requireUser();
  const product = await getStoreProductCard(productId);
  if (!product) return;

  const db = await getDB();
  const existing = await db
    .prepare("SELECT id FROM wishlist_items WHERE user_id = ? AND product_id = ?")
    .bind(user.id, productId)
    .first<{ id: string }>();

  if (existing) {
    await db.prepare("DELETE FROM wishlist_items WHERE id = ?").bind(existing.id).run();
  } else {
    // The price is captured at save time so the list can show a price drop
    // later. Flash price wins when one is running, otherwise it would look
    // like a drop the moment the sale ends.
    const savedPrice = (await flashPriceFor(productId)) ?? product.price;
    await db
      .prepare(
        "INSERT INTO wishlist_items (id, user_id, product_id, saved_price) VALUES (?, ?, ?, ?)"
      )
      .bind(crypto.randomUUID(), user.id, productId, savedPrice)
      .run();
  }

  revalidateWishlist();
}

export async function removeFromWishlistAction(productId: string): Promise<void> {
  const user = await requireUser();
  const db = await getDB();
  await db
    .prepare("DELETE FROM wishlist_items WHERE user_id = ? AND product_id = ?")
    .bind(user.id, productId)
    .run();
  revalidateWishlist();
}

export async function removeManyFromWishlistAction(productIds: string[]): Promise<void> {
  const user = await requireUser();
  if (productIds.length === 0) return;

  const db = await getDB();
  const placeholders = productIds.map(() => "?").join(", ");
  await db
    .prepare(
      `DELETE FROM wishlist_items WHERE user_id = ? AND product_id IN (${placeholders})`
    )
    .bind(user.id, ...productIds)
    .run();
  revalidateWishlist();
}

export async function clearWishlistAction(): Promise<void> {
  const user = await requireUser();
  const db = await getDB();
  await db.prepare("DELETE FROM wishlist_items WHERE user_id = ?").bind(user.id).run();
  revalidateWishlist();
}

export interface MoveResult {
  moved: number;
  /** Names of items that could not be moved, so the UI can say which. */
  skipped: string[];
}

/** Moves saved items into the cart.
 *
 * "Move" is the NN/g reading of the gesture: the item leaves the wishlist,
 * because leaving it in both places is what makes shoppers buy twice. Callers
 * that want it kept in both pass `keep: true`.
 *
 * Cart insert mirrors `addToCartAction`: the (user, product, color) unique
 * constraint means an existing line has its quantity bumped instead of a
 * second row appearing. */
export async function moveToCartAction(
  productIds: string[],
  options: { keep?: boolean } = {}
): Promise<MoveResult> {
  const user = await requireUser();
  // One catalog read covers both the "can this move" check and the names used
  // in the skipped list below.
  const catalog = await getStoreProductsByIds(productIds);
  const known = productIds.filter((id) => catalog.has(id));
  if (known.length === 0) return { moved: 0, skipped: [] };

  const db = await getDB();
  const placeholders = known.map(() => "?").join(", ");

  // One read of the existing lines, so N products cost 1 query rather than N.
  const { results: existing } = await db
    .prepare(
      `SELECT id, product_id, quantity FROM cart_items
       WHERE user_id = ? AND color = '' AND product_id IN (${placeholders})`
    )
    .bind(user.id, ...known)
    .all<{ id: string; product_id: string; quantity: number }>();

  const existingByProduct = new Map(existing.map((row) => [row.product_id, row]));

  const statements = known.map((productId) => {
    const line = existingByProduct.get(productId);
    return line
      ? db
          .prepare("UPDATE cart_items SET quantity = ? WHERE id = ?")
          .bind(line.quantity + 1, line.id)
      : db
          .prepare(
            "INSERT INTO cart_items (id, user_id, product_id, color, quantity) VALUES (?, ?, ?, '', 1)"
          )
          .bind(crypto.randomUUID(), user.id, productId);
  });

  if (!options.keep) {
    statements.push(
      db
        .prepare(
          `DELETE FROM wishlist_items WHERE user_id = ? AND product_id IN (${placeholders})`
        )
        .bind(user.id, ...known)
    );
  }

  await db.batch(statements);
  revalidateWishlist();

  // A product that has been unpublished since it was saved has no catalog
  // row, so its id is the only label left to show.
  const skipped = productIds
    .filter((id) => !known.includes(id))
    .map((id) => catalog.get(id)?.name ?? id);

  return { moved: known.length, skipped };
}
