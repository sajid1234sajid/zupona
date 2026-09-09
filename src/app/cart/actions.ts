"use server";

import { getDB } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { getStoreProductCard } from "@/lib/storefront";

export async function addToCartAction(productId: string, color = "", quantity = 1): Promise<void> {
  const user = await requireUser();
  // Checked against the live catalog, so a product unpublished in the admin
  // panel can no longer be added to a cart.
  if (!(await getStoreProductCard(productId))) return;

  const db = await getDB();
  const existing = await db
    .prepare("SELECT id, quantity FROM cart_items WHERE user_id = ? AND product_id = ? AND color = ?")
    .bind(user.id, productId, color)
    .first<{ id: string; quantity: number }>();

  if (existing) {
    await db
      .prepare("UPDATE cart_items SET quantity = ? WHERE id = ?")
      .bind(existing.quantity + quantity, existing.id)
      .run();
  } else {
    await db
      .prepare("INSERT INTO cart_items (id, user_id, product_id, color, quantity) VALUES (?, ?, ?, ?, ?)")
      .bind(crypto.randomUUID(), user.id, productId, color, quantity)
      .run();
  }
}

export async function updateCartQuantityAction(itemId: string, quantity: number): Promise<void> {
  const user = await requireUser();
  const db = await getDB();

  if (quantity < 1) {
    await db.prepare("DELETE FROM cart_items WHERE id = ? AND user_id = ?").bind(itemId, user.id).run();
    return;
  }

  await db
    .prepare("UPDATE cart_items SET quantity = ? WHERE id = ? AND user_id = ?")
    .bind(quantity, itemId, user.id)
    .run();
}

export async function removeFromCartAction(itemId: string): Promise<void> {
  const user = await requireUser();
  const db = await getDB();
  await db.prepare("DELETE FROM cart_items WHERE id = ? AND user_id = ?").bind(itemId, user.id).run();
}
