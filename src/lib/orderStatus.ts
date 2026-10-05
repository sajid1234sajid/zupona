/** Moving an order along, for every panel that can.
 *
 * Four things happen together and must not diverge: the order's own status,
 * the per-seller suborders that fulfilment keys off, the history trail the
 * customer's tracker reads, and a notification so the shopper hears about it.
 * Stock then follows the status through `applyStockForStatus`, at most once.
 *
 * The admin panel moves orders by hand; the Seller Center moves them when a
 * seller confirms or ships. Both call this, so a seller's "Confirm" commits
 * stock exactly the way an admin's would rather than through a lookalike. */

import { getDB } from "@/lib/db";
import { statusLabel } from "@/lib/orders";
import { applyStockForStatus, FULFILMENT_RANK, type StockOutcome } from "@/lib/orderStock";
import type { OrderStatus } from "@/types";

export const ORDER_STATUSES: OrderStatus[] = [
  "placed",
  "confirmed",
  "shipped",
  "out_for_delivery",
  "delivered",
  "cancelled",
];

/** SQL for a suborder's place in the fulfilment order. Anything off the happy
 * path (cancelled, returned) ranks above everything, so "raise only" never
 * drags a cancelled share back into the flow. */
const SUBORDER_RANK_SQL = `CASE status ${Object.entries(FULFILMENT_RANK)
  .map(([status, rank]) => `WHEN '${status}' THEN ${rank}`)
  .join(" ")} ELSE 99 END`;

export interface StatusChange {
  before: { status: string };
  stock: StockOutcome;
}

/**
 * Sets an order's status and everything that hangs off it.
 *
 * `suborders: "all"` is the admin's move: every seller's share follows the
 * order, backwards included, because an admin correcting a mistake means it.
 * `"raise"` is for an order that is catching up with its sellers -- a share
 * that has already shipped is never pulled back to "confirmed" because the
 * slowest seller in the order has only just confirmed.
 *
 * Resolves with null when nothing changed: an unknown order, or one already in
 * that status.
 */
export async function changeOrderStatus(params: {
  orderId: string;
  status: OrderStatus;
  note: string | null;
  actorId: string;
  suborders?: "all" | "raise";
}): Promise<StatusChange | null> {
  const { orderId, status, note, actorId } = params;
  if (!ORDER_STATUSES.includes(status)) return null;

  const db = await getDB();
  const before = await db
    .prepare("SELECT status, order_number, user_id FROM orders WHERE id = ?")
    .bind(orderId)
    .first<{ status: string; order_number: string; user_id: string }>();

  if (!before || before.status === status) return null;

  const label = statusLabel(status);
  const raiseOnly = params.suborders === "raise" && status !== "cancelled";

  await db.batch([
    db
      .prepare("UPDATE orders SET status = ?, updated_at = datetime('now') WHERE id = ?")
      .bind(status, orderId),
    db
      .prepare(
        `UPDATE suborders SET status = ?,
                shipped_at = CASE WHEN ? = 'shipped' THEN datetime('now') ELSE shipped_at END,
                delivered_at = CASE WHEN ? = 'delivered' THEN datetime('now') ELSE delivered_at END
         WHERE order_id = ?${raiseOnly ? ` AND ${SUBORDER_RANK_SQL} < ?` : ""}`
      )
      .bind(
        ...[status, status, status, orderId],
        ...(raiseOnly ? [FULFILMENT_RANK[status] ?? 0] : [])
      ),
    db
      .prepare(
        `INSERT INTO order_status_history (id, order_id, status, note, changed_by)
         VALUES (?, ?, ?, ?, ?)`
      )
      .bind(crypto.randomUUID(), orderId, status, note, actorId),
    db
      .prepare(
        `INSERT INTO notifications (id, user_id, title, body, type, order_id)
         VALUES (?, ?, ?, ?, 'order', ?)`
      )
      .bind(
        crypto.randomUUID(),
        before.user_id,
        `Order #${before.order_number} is ${label.toLowerCase()}`,
        note ?? `Your order is now marked as ${label.toLowerCase()}.`,
        orderId
      ),
  ]);

  /* Stock follows the status, at most once. Reaching confirmed or beyond turns
   * the hold into a sale; cancelling gives it back, either as a released hold
   * or as a return, depending on whether it was already sold. Repeating a
   * status does nothing, because the order has already left the state the move
   * would have claimed. */
  const stock = await applyStockForStatus(orderId, status);

  return { before: { status: before.status }, stock };
}
