"use server";

import { revalidatePath } from "next/cache";
import { getDB } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { changeOrderStatus } from "@/lib/orderStatus";
import { addSelectionToCartAction } from "@/app/cart/actions";
import { CANCEL_REASONS } from "@/lib/cancelReasons";


/** A shopper cancels their own order, until it ships.
 *
 * The order's real status is read here: the tracker on the page is partly a
 * forecast, and only an order still placed or confirmed in the database can
 * be cancelled from the account. Everything that follows a cancellation --
 * stock returned, points and the coupon given back, the status history and a
 * notification -- is the same `changeOrderStatus` the admin panel uses. */
export async function cancelMyOrderAction(
  orderId: string,
  reason: string
): Promise<{ ok: boolean; error?: string }> {
  const user = await requireUser();
  const db = await getDB();
  const order = await db
    .prepare("SELECT status FROM orders WHERE id = ? AND user_id = ?")
    .bind(orderId, user.id)
    .first<{ status: string }>();
  if (!order) return { ok: false, error: "Order not found." };
  if (order.status !== "placed" && order.status !== "confirmed") {
    return { ok: false, error: "This order has already shipped and can't be cancelled here. Contact us for help." };
  }

  const why = (CANCEL_REASONS as readonly string[]).includes(reason) ? reason : "Other";
  await changeOrderStatus({
    orderId,
    status: "cancelled",
    note: `Cancelled by the customer: ${why}`,
    actorId: user.id,
    suborders: "all",
  });
  revalidatePath("/account/orders");
  revalidatePath(`/account/orders/${orderId}`);
  return { ok: true };
}

/** Puts everything from an earlier order back in the cart, at today's price
 * and only what can still be bought. Returns what could not be added. */
export async function buyAgainAction(orderId: string): Promise<{ added: number; skipped: string[] }> {
  const user = await requireUser();
  const db = await getDB();
  const { results } = await db
    .prepare(
      `SELECT oi.product_id, oi.variant_id, oi.name, oi.quantity FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       WHERE o.id = ? AND o.user_id = ?`
    )
    .bind(orderId, user.id)
    .all<{ product_id: string; variant_id: string | null; name: string; quantity: number }>();

  let added = 0;
  const skipped: string[] = [];
  for (const line of results) {
    const result = await addSelectionToCartAction({
      productId: line.product_id,
      variantId: line.variant_id,
      quantity: line.quantity,
    });
    if (result.ok) added++;
    else skipped.push(line.name);
  }
  revalidatePath("/cart");
  return { added, skipped };
}
