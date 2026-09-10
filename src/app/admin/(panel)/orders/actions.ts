"use server";

import { revalidatePath } from "next/cache";
import { getDB } from "@/lib/db";
import { logAdminAction, requireStaff } from "@/lib/admin";
import { statusLabel } from "@/lib/orders";
import { applyStockForStatus } from "@/lib/orderStock";
import type { OrderStatus } from "@/types";

const ORDER_STATUSES: OrderStatus[] = [
  "placed",
  "confirmed",
  "shipped",
  "out_for_delivery",
  "delivered",
  "cancelled",
];

const PAYMENT_STATUSES = ["pending", "paid", "failed", "refunded", "partially_refunded"];

function refresh(orderId?: string): void {
  revalidatePath("/admin/orders");
  if (orderId) revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/admin");
}

/** Moves an order along and records why.
 *
 * Three things happen together and must not diverge: the order's own status,
 * the per-seller suborders that fulfillment keys off, and the history trail
 * the customer's tracker reads. A notification is written in the same batch so
 * the shopper hears about it without a separate job. */
export async function setOrderStatusAction(formData: FormData): Promise<void> {
  const staff = await requireStaff();
  const orderId = String(formData.get("orderId") ?? "");
  const status = String(formData.get("status") ?? "") as OrderStatus;
  const note = String(formData.get("note") ?? "").trim() || null;

  if (!orderId || !ORDER_STATUSES.includes(status)) return;

  const db = await getDB();
  const before = await db
    .prepare("SELECT status, order_number, user_id FROM orders WHERE id = ?")
    .bind(orderId)
    .first<{ status: string; order_number: string; user_id: string }>();

  if (!before || before.status === status) return;

  const label = statusLabel(status);

  await db.batch([
    db
      .prepare("UPDATE orders SET status = ?, updated_at = datetime('now') WHERE id = ?")
      .bind(status, orderId),
    db
      .prepare(
        `UPDATE suborders SET status = ?,
                shipped_at = CASE WHEN ? = 'shipped' THEN datetime('now') ELSE shipped_at END,
                delivered_at = CASE WHEN ? = 'delivered' THEN datetime('now') ELSE delivered_at END
         WHERE order_id = ?`
      )
      .bind(status, status, status, orderId),
    db
      .prepare(
        `INSERT INTO order_status_history (id, order_id, status, note, changed_by)
         VALUES (?, ?, ?, ?, ?)`
      )
      .bind(crypto.randomUUID(), orderId, status, note, staff.id),
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
  const stockOutcome = await applyStockForStatus(orderId, status);

  await logAdminAction(staff.id, `order.${status}`, "order", orderId, {
    before: { status: before.status },
    after: { status, stock: stockOutcome },
  });

  refresh(orderId);
}

export async function setPaymentStatusAction(formData: FormData): Promise<void> {
  const staff = await requireStaff();
  const orderId = String(formData.get("orderId") ?? "");
  const paymentStatus = String(formData.get("paymentStatus") ?? "");

  if (!orderId || !PAYMENT_STATUSES.includes(paymentStatus)) return;

  const db = await getDB();
  const before = await db
    .prepare("SELECT payment_status FROM orders WHERE id = ?")
    .bind(orderId)
    .first<{ payment_status: string }>();

  if (!before || before.payment_status === paymentStatus) return;

  await db
    .prepare("UPDATE orders SET payment_status = ?, updated_at = datetime('now') WHERE id = ?")
    .bind(paymentStatus, orderId)
    .run();

  await logAdminAction(staff.id, `order.payment.${paymentStatus}`, "order", orderId, {
    before,
    after: { payment_status: paymentStatus },
  });

  refresh(orderId);
}

/** Attaches courier details to every suborder in an order and, when the order
 * has not shipped yet, advances it -- entering a tracking number and then
 * separately marking it shipped is a step nobody remembers. */
export async function setTrackingAction(formData: FormData): Promise<void> {
  const staff = await requireStaff();
  const orderId = String(formData.get("orderId") ?? "");
  const courier = String(formData.get("courier") ?? "").trim() || null;
  const tracking = String(formData.get("tracking") ?? "").trim() || null;

  if (!orderId || (!courier && !tracking)) return;

  const db = await getDB();
  await db
    .prepare(
      "UPDATE suborders SET courier_name = ?, tracking_number = ? WHERE order_id = ?"
    )
    .bind(courier, tracking, orderId)
    .run();

  const order = await db
    .prepare("SELECT status FROM orders WHERE id = ?")
    .bind(orderId)
    .first<{ status: string }>();

  if (order && (order.status === "placed" || order.status === "confirmed")) {
    const shipped = new FormData();
    shipped.set("orderId", orderId);
    shipped.set("status", "shipped");
    shipped.set("note", tracking ? `Shipped with ${courier ?? "courier"} · ${tracking}` : "Shipped");
    await setOrderStatusAction(shipped);
  }

  await logAdminAction(staff.id, "order.tracking", "order", orderId, {
    after: { courier, tracking },
  });

  refresh(orderId);
}
