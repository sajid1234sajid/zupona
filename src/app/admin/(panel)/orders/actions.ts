"use server";

import { revalidatePath } from "next/cache";
import { getDB } from "@/lib/db";
import { logAdminAction, requireStaff } from "@/lib/admin";
import { changeOrderStatus, ORDER_STATUSES } from "@/lib/orderStatus";
import { ensureSuborder } from "@/lib/suborders";
import type { OrderStatus } from "@/types";

const PAYMENT_STATUSES = ["pending", "paid", "failed", "refunded", "partially_refunded"];

function refresh(orderId?: string): void {
  revalidatePath("/admin/orders");
  if (orderId) revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/admin");
}

/** Moves an order along and records why. The order, its suborders, the
 * history trail, the customer's notification and the stock all move together
 * in `changeOrderStatus`, which the Seller Center uses too. */
export async function setOrderStatusAction(formData: FormData): Promise<void> {
  const staff = await requireStaff();
  const orderId = String(formData.get("orderId") ?? "");
  const status = String(formData.get("status") ?? "") as OrderStatus;
  const note = String(formData.get("note") ?? "").trim() || null;

  if (!orderId || !ORDER_STATUSES.includes(status)) return;

  const change = await changeOrderStatus({ orderId, status, note, actorId: staff.id });
  if (!change) return;

  await logAdminAction(staff.id, `order.${status}`, "order", orderId, {
    before: change.before,
    after: { status, stock: change.stock },
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

  /* Orders placed before suborders existed have none, and this used to write
   * into nothing at all -- the admin typed a tracking number, the page
   * reloaded, and it was gone. One is created for them here; the helper
   * re-reads afterwards, so two admins saving at once cannot make two. */
  const suborderId = await ensureSuborder(orderId);
  if (!suborderId) return;

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
