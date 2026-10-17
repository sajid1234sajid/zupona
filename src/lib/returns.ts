/** Return requests: a shopper asks from a delivered order, the admin walks
 * the request through its steps, and the shopper hears about each one.
 *
 * One row in `returns_refunds` per order line being returned, so a shopper
 * can send back one shirt of an order and keep the rest, and later return a
 * second line of the same order. A line can be returned up to the quantity
 * bought, counting every request on it that was not turned down.
 *
 * The window runs from delivery: the days set in Settings, or 7 when the shop
 * has not set any. "Changed my mind" is offered only when the owner has set a
 * window, because the policy page promises returns for anything else only
 * when the item was damaged, wrong or not as described.
 *
 * Settling a request does what the money side needs, at most once each: a
 * store credit becomes a single-use coupon in the shopper's wallet that only
 * they can use, and a refund or store credit takes back the points the
 * returned share of the order earned. Putting the item back on the shelf is
 * the admin's call at "Received", since a damaged item is not stock. */

import { getDB } from "@/lib/db";
import { getOrder } from "@/lib/orders";
import { getShopSettings } from "@/lib/shopSettings";
import { pointsStatements } from "@/lib/points";
import { stockChangeStatements } from "@/lib/inventory";
import {
  FINISHED,
  RETURN_REASONS,
  RETURN_STATUS_LABELS,
  REFUND_METHODS,
  RESOLUTIONS,
  MAX_RETURN_PHOTOS,
  type RefundMethod,
  type ReturnReason,
  type ReturnResolution,
  type ReturnStatus,
} from "@/lib/returnOptions";
import type { Order } from "@/types";

const DEFAULT_WINDOW_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface ReturnableLine {
  orderItemId: string;
  productId: string;
  name: string;
  image: string;
  color: string | null;
  price: number;
  bought: number;
  /** Bought, less what earlier requests already cover. */
  remaining: number;
}

export interface ReturnEligibility {
  order: Order;
  deliveredAt: string | null;
  /** ISO time the window closes; null while the order is not delivered. */
  deadline: string | null;
  open: boolean;
  /** Why a return can't be asked for, when it can't. */
  blocked: string | null;
  windowDays: number;
  changedMindAllowed: boolean;
  lines: ReturnableLine[];
}

/** When the order reached the shopper: the moment a person marked it
 * delivered, or else the moment the tracker started showing it so. */
async function deliveredAt(order: Order): Promise<string | null> {
  if (order.status !== "delivered") return null;
  const db = await getDB();
  const row = await db
    .prepare(
      `SELECT MIN(created_at) AS at FROM order_status_history
       WHERE order_id = ? AND status = 'delivered' AND suborder_id IS NULL`
    )
    .bind(order.id)
    .first<{ at: string | null }>();
  if (row?.at) return new Date(`${row.at.replace(" ", "T")}Z`).toISOString();
  return order.steps.find((step) => step.status === "delivered")?.at ?? null;
}

export async function returnEligibility(userId: string, orderId: string): Promise<ReturnEligibility | null> {
  const db = await getDB();
  const [order, settings, taken] = await Promise.all([
    getOrder(userId, orderId),
    getShopSettings(),
    db
      .prepare(
        `SELECT order_item_id, SUM(quantity) AS n FROM returns_refunds
         WHERE user_id = ? AND order_id = ? AND status != 'rejected'
         GROUP BY order_item_id`
      )
      .bind(userId, orderId)
      .all<{ order_item_id: string; n: number }>(),
  ]);
  if (!order) return null;

  const windowDays = settings.returnDays > 0 ? settings.returnDays : DEFAULT_WINDOW_DAYS;
  const delivered = await deliveredAt(order);
  const deadline = delivered ? new Date(new Date(delivered).getTime() + windowDays * DAY_MS).toISOString() : null;
  const used = new Map(taken.results.map((row) => [row.order_item_id, row.n]));
  const lines: ReturnableLine[] = order.items.map((item) => ({
    orderItemId: item.id,
    productId: item.productId,
    name: item.name,
    image: item.image,
    color: item.color,
    price: item.price,
    bought: item.quantity,
    remaining: Math.max(0, item.quantity - (used.get(item.id) ?? 0)),
  }));

  let blocked: string | null = null;
  if (order.status !== "delivered") blocked = "A return can be requested once the order is delivered.";
  else if (!deadline || Date.now() > new Date(deadline).getTime())
    blocked = `The ${windowDays}-day return window for this order has closed.`;
  else if (lines.every((line) => line.remaining === 0))
    blocked = "Every item in this order already has a return request.";

  return {
    order,
    deliveredAt: delivered,
    deadline,
    open: blocked === null,
    blocked,
    windowDays,
    changedMindAllowed: settings.returnDays > 0,
    lines,
  };
}

export interface ReturnRequestInput {
  orderId: string;
  items: { orderItemId: string; quantity: number }[];
  reason: string;
  detail: string;
  photos: string[];
  resolution: string;
  refundMethod: string | null;
  refundAccount: string | null;
}

export async function createReturnRequest(
  userId: string,
  input: ReturnRequestInput
): Promise<{ ok: true; ids: string[] } | { ok: false; error: string }> {
  const eligibility = await returnEligibility(userId, input.orderId);
  if (!eligibility) return { ok: false, error: "That order could not be found." };
  if (!eligibility.open) return { ok: false, error: eligibility.blocked ?? "This order can't be returned." };

  const reason = RETURN_REASONS.find((entry) => entry.id === input.reason);
  if (!reason) return { ok: false, error: "Choose why you're returning it." };
  if (reason.id === "changed_mind" && !eligibility.changedMindAllowed) {
    return { ok: false, error: "Returns are taken for damaged, wrong or not-as-described items." };
  }

  const resolution = RESOLUTIONS.find((entry) => entry.id === input.resolution)?.id;
  if (!resolution) return { ok: false, error: "Choose a refund, an exchange or store credit." };

  let refundMethod: RefundMethod | null = null;
  let refundAccount: string | null = null;
  if (resolution === "refund") {
    refundMethod = REFUND_METHODS.find((entry) => entry.id === input.refundMethod)?.id ?? null;
    refundAccount = (input.refundAccount ?? "").trim().slice(0, 200) || null;
    if (!refundMethod) return { ok: false, error: "Choose where the refund should go." };
    if (!refundAccount) return { ok: false, error: "Enter the account the refund should go to." };
    if (refundMethod !== "bank" && !/^01[3-9]\d{8}$/.test(refundAccount.replace(/[\s-]/g, "").replace(/^\+?88/, ""))) {
      return { ok: false, error: "Enter an 11-digit mobile number for the refund, like 01XXXXXXXXX." };
    }
  }

  // Only pictures this shopper uploaded for a return.
  const photos = [...new Set(input.photos)]
    .filter((url) => url.startsWith(`/api/media/returns/${userId}/`))
    .slice(0, MAX_RETURN_PHOTOS);
  if (reason.photoRequired && photos.length === 0) {
    return { ok: false, error: "Add a photo that shows the problem." };
  }

  const byId = new Map(eligibility.lines.map((line) => [line.orderItemId, line]));
  const chosen = input.items
    .map((item) => ({ line: byId.get(item.orderItemId), quantity: Math.floor(item.quantity) }))
    .filter((item): item is { line: ReturnableLine; quantity: number } => Boolean(item.line) && item.quantity > 0);
  if (chosen.length === 0) return { ok: false, error: "Choose at least one item to return." };
  for (const { line, quantity } of chosen) {
    if (quantity > line.remaining) {
      return { ok: false, error: `Only ${line.remaining} of ${line.name} can still be returned.` };
    }
  }

  const detail = input.detail.trim().slice(0, 1000) || null;
  const db = await getDB();
  const ids = chosen.map(() => crypto.randomUUID());
  const count = chosen.reduce((sum, item) => sum + item.quantity, 0);
  await db.batch([
    ...chosen.map(({ line, quantity }, index) =>
      db
        .prepare(
          `INSERT INTO returns_refunds (id, order_item_id, order_id, user_id, reason, detail, status, refund_amount,
                                        quantity, resolution, refund_method, refund_account, photos)
           VALUES (?, ?, ?, ?, ?, ?, 'requested', ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          ids[index],
          line.orderItemId,
          input.orderId,
          userId,
          reason.id,
          detail,
          line.price * quantity,
          quantity,
          resolution,
          refundMethod,
          refundAccount,
          photos.length > 0 ? JSON.stringify(photos) : null
        )
    ),
    db
      .prepare(
        `INSERT INTO notifications (id, user_id, title, body, type, order_id)
         VALUES (?, ?, ?, ?, 'order', ?)`
      )
      .bind(
        crypto.randomUUID(),
        userId,
        "Return requested",
        `We've got your return request for ${count} item${count === 1 ? "" : "s"} from order ${eligibility.order.orderNumber}. We'll reply within 2 working days.`,
        input.orderId
      ),
  ]);
  return { ok: true, ids };
}

export interface ReturnRequest {
  id: string;
  orderId: string;
  orderNumber: string;
  orderItemId: string;
  productId: string;
  variantId: string | null;
  name: string;
  image: string;
  color: string | null;
  price: number;
  quantity: number;
  reason: ReturnReason;
  detail: string | null;
  status: ReturnStatus;
  resolution: ReturnResolution;
  refundMethod: RefundMethod | null;
  refundAccount: string | null;
  refundAmount: number;
  photos: string[];
  note: string | null;
  createdAt: string;
  updatedAt: string;
  customer: { id: string; name: string; phone: string | null };
}

interface ReturnRow {
  id: string;
  order_id: string;
  order_number: string;
  order_item_id: string;
  product_id: string;
  variant_id: string | null;
  name: string;
  image: string;
  color: string | null;
  price: number;
  quantity: number;
  reason: ReturnReason;
  detail: string | null;
  status: ReturnStatus;
  resolution: ReturnResolution;
  refund_method: RefundMethod | null;
  refund_account: string | null;
  refund_amount: number;
  photos: string | null;
  resolution_note: string | null;
  created_at: string;
  updated_at: string;
  user_id: string;
  customer_name: string | null;
  customer_phone: string | null;
}

const SELECT = `SELECT r.id, oi.order_id, o.order_number, r.order_item_id, oi.product_id, oi.variant_id, oi.name,
                       oi.image, oi.color, oi.price, r.quantity, r.reason, r.detail, r.status, r.resolution,
                       r.refund_method, r.refund_account, r.refund_amount, r.photos, r.resolution_note,
                       r.created_at, r.updated_at, r.user_id, u.name AS customer_name, u.phone AS customer_phone
                FROM returns_refunds r
                JOIN order_items oi ON oi.id = r.order_item_id
                JOIN orders o ON o.id = oi.order_id
                LEFT JOIN users u ON u.id = r.user_id`;

function parsePhotos(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const value = JSON.parse(raw);
    return Array.isArray(value) ? value.filter((url): url is string => typeof url === "string") : [];
  } catch {
    return [];
  }
}

function toRequest(row: ReturnRow): ReturnRequest {
  return {
    id: row.id,
    orderId: row.order_id,
    orderNumber: row.order_number,
    orderItemId: row.order_item_id,
    productId: row.product_id,
    variantId: row.variant_id,
    name: row.name,
    image: row.image,
    color: row.color,
    price: row.price,
    quantity: row.quantity,
    reason: row.reason,
    detail: row.detail,
    status: row.status,
    resolution: row.resolution,
    refundMethod: row.refund_method,
    refundAccount: row.refund_account,
    refundAmount: row.refund_amount,
    photos: parsePhotos(row.photos),
    note: row.resolution_note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    customer: { id: row.user_id, name: row.customer_name ?? "Customer", phone: row.customer_phone },
  };
}

export async function myReturns(userId: string): Promise<ReturnRequest[]> {
  const db = await getDB();
  const { results } = await db
    .prepare(`${SELECT} WHERE r.user_id = ? ORDER BY r.created_at DESC LIMIT 100`)
    .bind(userId)
    .all<ReturnRow>();
  return results.map(toRequest);
}

export async function orderReturns(userId: string, orderId: string): Promise<ReturnRequest[]> {
  const db = await getDB();
  const { results } = await db
    .prepare(`${SELECT} WHERE r.user_id = ? AND oi.order_id = ? ORDER BY r.created_at DESC`)
    .bind(userId, orderId)
    .all<ReturnRow>();
  return results.map(toRequest);
}

/** The admin queue: open requests first, oldest first, so nobody waits
 * longest; then the settled ones, newest first. */
export async function listReturns(filter: "open" | "closed" | "all" = "open"): Promise<ReturnRequest[]> {
  const db = await getDB();
  const finished = [...FINISHED].map((status) => `'${status}'`).join(",");
  const where =
    filter === "open" ? `WHERE r.status NOT IN (${finished})` : filter === "closed" ? `WHERE r.status IN (${finished})` : "";
  const order = filter === "open" ? "r.created_at ASC" : "r.updated_at DESC";
  const { results } = await db.prepare(`${SELECT} ${where} ORDER BY ${order} LIMIT 200`).all<ReturnRow>();
  return results.map(toRequest);
}

export async function countOpenReturns(): Promise<number> {
  const db = await getDB();
  const finished = [...FINISHED].map((status) => `'${status}'`).join(",");
  const row = await db
    .prepare(`SELECT COUNT(*) AS n FROM returns_refunds WHERE status NOT IN (${finished})`)
    .first<{ n: number }>();
  return row?.n ?? 0;
}

/** Where a request can go from where it is. */
export const NEXT_STATUSES: Record<ReturnStatus, ReturnStatus[]> = {
  requested: ["approved", "rejected"],
  approved: ["pickup_scheduled", "received", "rejected"],
  pickup_scheduled: ["received", "rejected"],
  received: ["refunded", "exchanged", "store_credit"],
  refunded: [],
  exchanged: [],
  store_credit: [],
  rejected: [],
};

const CUSTOMER_MESSAGES: Record<ReturnStatus, (item: string, order: string) => string> = {
  requested: (item, order) => `Your return of ${item} from order ${order} has been requested.`,
  approved: (item, order) => `Your return of ${item} from order ${order} is approved. We'll arrange the pickup.`,
  rejected: (item, order) => `We couldn't approve the return of ${item} from order ${order}.`,
  pickup_scheduled: (item) => `A courier will collect ${item}. Keep it packed with its tags.`,
  received: (item) => `We've received ${item} and are checking it.`,
  refunded: (item) => `The refund for ${item} has been sent.`,
  exchanged: (item) => `Your exchange for ${item} is on its way.`,
  store_credit: (item) => `Store credit for ${item} is in My Coupons.`,
};

function storeCreditCode(): string {
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return `CREDIT${Array.from(bytes, (byte) => letters[byte % letters.length]).join("")}`;
}

/** Moves a request one step, with what that step sets off. */
export async function advanceReturn(params: {
  id: string;
  status: ReturnStatus;
  note: string | null;
  refundAmount?: number | null;
  restock?: boolean;
  actorId: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const db = await getDB();
  const row = await db.prepare(`${SELECT} WHERE r.id = ?`).bind(params.id).first<ReturnRow>();
  if (!row) return { ok: false, error: "That return request is gone." };
  const request = toRequest(row);
  if (!NEXT_STATUSES[request.status].includes(params.status)) {
    return {
      ok: false,
      error: `A request that is ${RETURN_STATUS_LABELS[request.status].toLowerCase()} can't be marked ${RETURN_STATUS_LABELS[params.status].toLowerCase()}.`,
    };
  }

  const most = request.price * request.quantity;
  const amount =
    params.refundAmount === undefined || params.refundAmount === null
      ? request.refundAmount
      : Math.max(0, Math.min(most, Math.round(params.refundAmount)));
  const note = params.note?.trim().slice(0, 500) || null;
  const item = request.quantity > 1 ? `${request.quantity} × ${request.name}` : request.name;

  // The status move is conditional on the status we read, so two admins
  // pressing at once cannot both settle it.
  const move = db
    .prepare(
      `UPDATE returns_refunds SET status = ?, refund_amount = ?, resolution_note = COALESCE(?, resolution_note),
              updated_at = datetime('now')
       WHERE id = ? AND status = ?`
    )
    .bind(params.status, amount, note, request.id, request.status);
  const moved = await move.run();
  if (!moved.meta.changes) return { ok: false, error: "Someone else just updated this request. Reload to see it." };

  const statements: D1PreparedStatement[] = [];
  let body = CUSTOMER_MESSAGES[params.status](item, request.orderNumber);

  if (params.status === "received" && params.restock && request.variantId) {
    statements.push(
      ...stockChangeStatements(db, request.variantId, request.quantity, "return", {
        referenceType: "return",
        referenceId: request.id,
        note: `Return of order ${request.orderNumber}`,
        userId: params.actorId,
      })
    );
  }

  if (params.status === "store_credit" && amount > 0) {
    const couponId = crypto.randomUUID();
    const code = storeCreditCode();
    const ends = new Date(Date.now() + 180 * DAY_MS).toISOString().slice(0, 19).replace("T", " ");
    statements.push(
      db
        .prepare(
          `INSERT INTO coupons (id, code, description, discount_type, discount_value, min_order_amount,
                                usage_limit, per_user_limit, scope, ends_at, audience, is_public)
           VALUES (?, ?, ?, 'fixed', ?, 0, 1, 1, 'all', ?, 'owner', 0)`
        )
        .bind(couponId, code, `Store credit for your return from order ${request.orderNumber}`, amount, ends),
      db
        .prepare("INSERT OR IGNORE INTO user_coupons (user_id, coupon_id) VALUES (?, ?)")
        .bind(request.customer.id, couponId)
    );
    body = `Store credit of ৳${amount.toLocaleString("en-US")} for ${item} is in My Coupons. Use code ${code} at checkout within 180 days.`;
  }

  if ((params.status === "refunded" || params.status === "store_credit") && amount > 0) {
    // Take back the points this share of the order earned, if they were credited.
    const order = await db
      .prepare(
        `SELECT o.subtotal, o.points_earned,
                (SELECT SUM(delta) FROM points_ledger WHERE user_id = o.user_id AND reason = 'order' AND ref_id = o.id) AS credited
         FROM orders o WHERE o.id = ?`
      )
      .bind(request.orderId)
      .first<{ subtotal: number; points_earned: number; credited: number | null }>();
    const credited = order?.credited ?? 0;
    if (order && credited > 0 && order.subtotal > 0) {
      const back = Math.min(credited, Math.floor((credited * amount) / order.subtotal));
      if (back > 0) {
        statements.push(
          ...pointsStatements(db, {
            userId: request.customer.id,
            delta: -back,
            reason: "reverse",
            refId: `${request.id}:return`,
            note: `Points from a returned item (order ${request.orderNumber})`,
          })
        );
      }
    }
    if (params.status === "refunded") {
      body = `The refund of ৳${amount.toLocaleString("en-US")} for ${item} has been sent${
        request.refundMethod ? ` to your ${REFUND_METHODS.find((m) => m.id === request.refundMethod)?.label}` : ""
      }.`;
    }
  }

  if (note && params.status === "rejected") body = `${body} ${note}`;

  statements.push(
    db
      .prepare(
        `INSERT INTO notifications (id, user_id, title, body, type, order_id)
         VALUES (?, ?, ?, ?, 'order', ?)`
      )
      .bind(
        crypto.randomUUID(),
        request.customer.id,
        `Return ${RETURN_STATUS_LABELS[params.status].toLowerCase()}`,
        body,
        request.orderId
      )
  );
  await db.batch(statements);
  return { ok: true };
}
