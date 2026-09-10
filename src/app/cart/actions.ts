"use server";

import { getDB } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { getStoreProduct, getStoreProductCard } from "@/lib/storefront";

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
  const user = await requireUser();

  const quantity = Math.floor(Number(input.quantity));
  if (!Number.isFinite(quantity) || quantity < 1) {
    return { ok: false, error: "Choose how many you want." };
  }

  // Read from the catalog rather than trusting anything sent with the request.
  const product = await getStoreProduct(input.productId);
  if (!product) return { ok: false, error: "This product is no longer available." };

  let variantId: string | null = null;
  let available = product.stockTotal;
  let selectionLabel = "";

  if (product.variants.length > 0) {
    const variant = product.variants.find((entry) => entry.id === input.variantId);
    if (!variant) return { ok: false, error: "Choose an option before adding to the cart." };

    variantId = variant.id;
    available = variant.available;

    // The label is what the cart and the order line print. Built in the order
    // the options are shown, so "Olive / M" always reads the same way -- and,
    // because cart rows are unique per (user, product, label), it is also what
    // keeps two sizes of one shirt as two lines rather than one.
    selectionLabel = product.optionGroups
      .map((group) => variant.optionValues[group.key])
      .filter(Boolean)
      .join(" / ");
  }

  if (available <= 0) return { ok: false, error: "This option is out of stock." };

  const db = await getDB();
  const existing = await db
    .prepare("SELECT id, quantity FROM cart_items WHERE user_id = ? AND product_id = ? AND color = ?")
    .bind(user.id, input.productId, selectionLabel)
    .first<{ id: string; quantity: number }>();

  const alreadyInCart = existing?.quantity ?? 0;
  if (alreadyInCart + quantity > available) {
    const room = available - alreadyInCart;
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
      .bind(alreadyInCart + quantity, variantId, existing.id)
      .run();
  } else {
    await db
      .prepare(
        "INSERT INTO cart_items (id, user_id, product_id, variant_id, color, quantity) VALUES (?, ?, ?, ?, ?, ?)"
      )
      .bind(crypto.randomUUID(), user.id, input.productId, variantId, selectionLabel, quantity)
      .run();
  }

  return { ok: true };
}
