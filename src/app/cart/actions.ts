"use server";

import { getDB } from "@/lib/db";
import { getOrCreateShopper, getShopper } from "@/lib/session";
import { getStoreProductCard } from "@/lib/storefront";
import { resolveSelection } from "@/lib/selection";
import { createBuyNowSession } from "@/lib/buyNow";

/* No sign-in is needed to shop. Adding to the cart or buying now makes a guest
 * for a signed-out browser; changing a line only ever touches a cart that
 * already exists. */

export async function addToCartAction(productId: string, color = "", quantity = 1): Promise<void> {
  // Checked against the live catalog, so a product unpublished in the admin
  // panel can no longer be added to a cart.
  if (!(await getStoreProductCard(productId))) return;
  const user = await getOrCreateShopper();

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
  const user = await getShopper();
  if (!user) return;
  const db = await getDB();

  if (quantity < 1) {
    await db.prepare("DELETE FROM cart_items WHERE id = ? AND user_id = ?").bind(itemId, user.id).run();
    return;
  }

  /* Capped at what is actually on the shelf. The stepper already stops there,
   * but the stepper is a convenience: a request that asks for more than exists
   * is clamped here, where it counts, rather than being taken and refused at
   * checkout. Lines with no variant keep their previous behaviour. */
  const row = await db
    .prepare(
      `SELECT c.variant_id, v.stock_quantity, v.reserved_quantity
       FROM cart_items c
       LEFT JOIN product_variants v ON v.id = c.variant_id
       WHERE c.id = ? AND c.user_id = ?`
    )
    .bind(itemId, user.id)
    .first<{ variant_id: string | null; stock_quantity: number | null; reserved_quantity: number | null }>();

  if (!row) return;

  let wanted = Math.floor(quantity);
  if (row.variant_id) {
    const available = Math.max(0, (row.stock_quantity ?? 0) - (row.reserved_quantity ?? 0));
    if (available <= 0) {
      await db.prepare("DELETE FROM cart_items WHERE id = ? AND user_id = ?").bind(itemId, user.id).run();
      return;
    }
    wanted = Math.min(wanted, available);
  }

  await db
    .prepare("UPDATE cart_items SET quantity = ? WHERE id = ? AND user_id = ?")
    .bind(wanted, itemId, user.id)
    .run();
}

export async function removeFromCartAction(itemId: string): Promise<void> {
  const user = await getShopper();
  if (!user) return;
  const db = await getDB();
  await db.prepare("DELETE FROM cart_items WHERE id = ? AND user_id = ?").bind(itemId, user.id).run();
}

/* -------------------------------------------------------------------------- */
/* Selection-aware add to cart                                                */
/* -------------------------------------------------------------------------- */

/** Why an add was refused, or nothing when it went through.
 *
 * A result rather than a thrown error: the product page shows the reason next
 * to the button, and "only 3 left" is information the shopper needs, not an
 * exception. */
export interface AddSelectionResult {
  ok: boolean;
  error?: string;
}

/** Adds a chosen variant to the cart, deciding everything on the server.
 *
 * The browser sends an id and a quantity and nothing else -- no price, no
 * stock figure, no discount. All three are read here from the database, so a
 * tampered request buys at the real price or not at all. The quantity is
 * checked against what is actually available *including what is already in
 * the cart*, which is what stops three-then-three emptying a shelf of five.
 *
 * `addToCartAction` above is untouched and still serves the existing product
 * page; this is the path the dynamic product page uses. */
export async function addSelectionToCartAction(input: {
  productId: string;
  variantId?: string | null;
  quantity: number;
}): Promise<AddSelectionResult> {
  // The browser sends an id and a quantity; the price, the stock and the
  // options all come back out of the database here.
  const selection = await resolveSelection(input);
  if (!selection.ok) return selection;
  if (selection.available <= 0) return { ok: false, error: "This option is out of stock." };

  const user = await getOrCreateShopper();
  const db = await getDB();
  const existing = await db
    .prepare(
      selection.variantId
        ? "SELECT id, quantity FROM cart_items WHERE user_id = ? AND product_id = ? AND variant_id = ?"
        : "SELECT id, quantity FROM cart_items WHERE user_id = ? AND product_id = ? AND color = ?"
    )
    .bind(user.id, selection.productId, selection.variantId ?? selection.label)
    .first<{ id: string; quantity: number }>();

  // What is already in the cart counts against the shelf, which is what stops
  // three-then-three emptying a stock of five.
  const alreadyInCart = existing?.quantity ?? 0;
  if (alreadyInCart + selection.quantity > selection.available) {
    const room = selection.available - alreadyInCart;
    return {
      ok: false,
      error:
        room > 0
          ? `Only ${room} more available.`
          : "You already have all the available stock in your cart.",
    };
  }

  if (existing) {
    await db
      .prepare("UPDATE cart_items SET quantity = ?, variant_id = ? WHERE id = ?")
      .bind(alreadyInCart + selection.quantity, selection.variantId, existing.id)
      .run();
  } else {
    await db
      .prepare(
        "INSERT INTO cart_items (id, user_id, product_id, variant_id, color, quantity) VALUES (?, ?, ?, ?, ?, ?)"
      )
      .bind(
        crypto.randomUUID(),
        user.id,
        selection.productId,
        selection.variantId,
        selection.label,
        selection.quantity
      )
      .run();
  }

  return { ok: true };
}

/** Buy Now: opens a session for this one line and leaves the cart alone.
 *
 * Deliberately not "add to cart, then go to checkout" -- that bought whatever
 * else was already there. */
export async function buyNowAction(input: {
  productId: string;
  variantId?: string | null;
  quantity: number;
}): Promise<AddSelectionResult> {
  const user = await getOrCreateShopper();
  const result = await createBuyNowSession(user.id, input);
  return result.ok ? { ok: true } : { ok: false, error: result.error };
}
