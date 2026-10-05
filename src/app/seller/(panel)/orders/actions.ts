"use server";

import { revalidatePath } from "next/cache";
import { getDB } from "@/lib/db";
import { AuthorizationError, logAdminAction } from "@/lib/admin";
import { requireApprovedSeller } from "@/lib/sellers";
import { nextSellerSteps } from "@/lib/sellerCenter";
import { changeOrderStatus } from "@/lib/orderStatus";
import { FULFILMENT_RANK } from "@/lib/orderStock";
import { statusLabel } from "@/lib/orders";
import type { OrderStatus } from "@/types";

export interface OrderStepState {
  error?: string;
  success?: string;
}

const RANKED = Object.entries(FULFILMENT_RANK).sort((a, b) => a[1] - b[1]);

function refresh(orderNumber: string): void {
  revalidatePath("/seller/orders");
  revalidatePath(`/seller/orders/${orderNumber}`);
  revalidatePath("/seller");
  revalidatePath("/admin/orders");
}

/**
 * Moves this store's share of an order one step on.
 *
 * When the store is the order's only seller -- the usual case -- its share
 * *is* the order, so the step goes through `changeOrderStatus` exactly as an
 * admin's would: the customer's tracker, their notification and the stock all
 * move with it. In a joint order the seller moves only their own share, and
 * the order follows once every seller has caught up, so the customer is never
 * told "shipped" while half the parcel is still on a shelf.
 */
export async function sellerOrderStepAction(
  _prevState: OrderStepState,
  formData: FormData
): Promise<OrderStepState> {
  try {
    const { user, seller } = await requireApprovedSeller();

    const suborderId = String(formData.get("suborderId") ?? "");
    const step = String(formData.get("step") ?? "");
    const reason = String(formData.get("note") ?? "").trim().slice(0, 300) || null;
    const courier = String(formData.get("courier") ?? "").trim().slice(0, 80) || null;
    const tracking = String(formData.get("tracking") ?? "").trim().slice(0, 80) || null;

    const db = await getDB();
    const share = await db
      .prepare(
        `SELECT so.id, so.order_id, so.status, o.order_number, o.user_id, o.status AS order_status,
                (SELECT COUNT(*) FROM suborders x WHERE x.order_id = so.order_id) AS share_count
         FROM suborders so JOIN orders o ON o.id = so.order_id
         WHERE so.id = ? AND so.seller_id = ?`
      )
      .bind(suborderId, seller.id)
      .first<{
        id: string;
        order_id: string;
        status: string;
        order_number: string;
        user_id: string;
        order_status: string;
        share_count: number;
      }>();

    if (!share) return { error: "That order isn't in your store." };

    // Courier details alone: correcting a tracking number after dispatch.
    if (step === "tracking") {
      if (!courier && !tracking) return { error: "Enter the courier or the tracking number." };
      await db
        .prepare("UPDATE suborders SET courier_name = ?, tracking_number = ? WHERE id = ?")
        .bind(courier, tracking, share.id)
        .run();
      await logAdminAction(user.id, "seller.order.tracking", "order", share.order_id, {
        after: { courier, tracking },
      });
      refresh(share.order_number);
      return { success: "Courier details saved." };
    }

    const sole = share.share_count <= 1;
    if (!nextSellerSteps(share.status, sole).includes(step)) {
      return { error: "This order has already moved on. Reload the page to see where it is now." };
    }
    if (step === "cancelled" && !reason) {
      return { error: "Say why you are cancelling. The customer reads this." };
    }
    if (step === "shipped" && !courier) {
      return { error: "Enter the courier (or \"Own delivery\") before marking it shipped." };
    }

    if (courier || tracking) {
      await db
        .prepare(
          `UPDATE suborders SET courier_name = COALESCE(?, courier_name),
                                tracking_number = COALESCE(?, tracking_number)
           WHERE id = ?`
        )
        .bind(courier, tracking, share.id)
        .run();
    }

    const note =
      step === "cancelled"
        ? `Cancelled by the seller: ${reason}`
        : step === "shipped"
          ? `Shipped with ${courier}${tracking ? ` · ${tracking}` : ""}`
          : reason;

    const orderRank = FULFILMENT_RANK[share.order_status];
    if (share.order_status === "cancelled" || share.order_status === "returned") {
      return { error: "This order has been cancelled." };
    }
    if (step === "cancelled" && orderRank !== undefined && orderRank > FULFILMENT_RANK.confirmed) {
      return { error: "This order has already been dispatched, so it can't be cancelled here." };
    }

    if (sole && step !== "cancelled" && orderRank !== undefined && orderRank >= FULFILMENT_RANK[step]) {
      // An admin has already moved the order past this step. Never drag the
      // order back to meet a lagging share -- bring the share up instead.
      await db
        .prepare("UPDATE suborders SET status = ? WHERE id = ?")
        .bind(share.order_status, share.id)
        .run();
    } else if (sole) {
      const change = await changeOrderStatus({
        orderId: share.order_id,
        status: step as OrderStatus,
        note,
        actorId: user.id,
      });

      // The order can already be where the share is going -- an admin moved
      // it, and the share was left behind. Bring the share up to it.
      if (!change) {
        await db
          .prepare("UPDATE suborders SET status = ? WHERE id = ?")
          .bind(step, share.id)
          .run();
      }
    } else {
      await moveOwnShare(share, step, note, user.id);
    }

    await logAdminAction(user.id, `seller.order.${step}`, "order", share.order_id, {
      before: { status: share.status },
      after: { status: step, courier, tracking, sole },
    });

    refresh(share.order_number);
    return { success: `Order marked ${statusLabel(step as OrderStatus).toLowerCase()}.` };
  } catch (error) {
    if (error instanceof AuthorizationError) return { error: error.message };
    throw error;
  }
}

/** One seller's share of a joint order, and the order catching up behind it. */
async function moveOwnShare(
  share: { id: string; order_id: string; status: string; order_number: string; user_id: string },
  step: string,
  note: string | null,
  actorId: string
): Promise<void> {
  const db = await getDB();

  // Claimed against the status it was read in, so a double tap moves it once.
  const claimed = await db
    .prepare(
      `UPDATE suborders SET status = ?,
              shipped_at = CASE WHEN ? = 'shipped' THEN datetime('now') ELSE shipped_at END,
              delivered_at = CASE WHEN ? = 'delivered' THEN datetime('now') ELSE delivered_at END
       WHERE id = ? AND status = ?`
    )
    .bind(step, step, step, share.id, share.status)
    .run();
  if ((claimed.meta.changes ?? 0) === 0) return;

  const statements = [
    db
      .prepare(
        `INSERT INTO order_status_history (id, order_id, suborder_id, status, note, changed_by)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .bind(crypto.randomUUID(), share.order_id, share.id, step, note, actorId),
  ];

  // The customer hears about a parcel leaving or arriving; a seller merely
  // confirming their half is not news to them.
  if (step === "shipped" || step === "delivered") {
    statements.push(
      db
        .prepare(
          `INSERT INTO notifications (id, user_id, title, body, type, order_id)
           VALUES (?, ?, ?, ?, 'order', ?)`
        )
        .bind(
          crypto.randomUUID(),
          share.user_id,
          `Part of order #${share.order_number} is ${statusLabel(step as OrderStatus).toLowerCase()}`,
          note ?? "One of the parcels in your order has moved on.",
          share.order_id
        )
    );
  }
  await db.batch(statements);

  // The order stands where its slowest seller stands. Once every live share
  // has passed the order's own status, the order moves up to meet them --
  // which is also the moment stock is committed, through the shared path.
  const slowest = await db
    .prepare(
      `SELECT MIN(CASE status ${RANKED.map(([status, rank]) => `WHEN '${status}' THEN ${rank}`).join(" ")}
                  ELSE NULL END) AS rank
       FROM suborders WHERE order_id = ? AND status NOT IN ('cancelled', 'returned')`
    )
    .bind(share.order_id)
    .first<{ rank: number | null }>();

  const order = await db
    .prepare("SELECT status FROM orders WHERE id = ?")
    .bind(share.order_id)
    .first<{ status: string }>();

  const target = RANKED.find(([, rank]) => rank === slowest?.rank)?.[0];
  if (!target || !order) return;
  if ((FULFILMENT_RANK[order.status] ?? 99) >= FULFILMENT_RANK[target]) return;

  await changeOrderStatus({
    orderId: share.order_id,
    status: target as OrderStatus,
    note: null,
    actorId,
    suborders: "raise",
  });
}
