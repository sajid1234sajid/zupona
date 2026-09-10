/** Splitting an order between the people who have to fulfil it.
 *
 * An order is one payment and one delivery address, but it can be several
 * shipments from several sellers. A suborder is one seller's share: their
 * lines, their money, their courier and tracking, their shipped and delivered
 * timestamps.
 *
 * Every order gets at least one, including an order that is entirely the
 * platform's own goods -- one shape rather than two means one fulfilment path,
 * and no reshaping of old orders the day a real seller appears.
 *
 * The suborder mirrors the order's status. `orders.status` stays the single
 * authority: it drives the customer's timeline, the audit trail and the stock
 * state machine. Nothing here touches stock. */

import { getDB } from "@/lib/db";
import { calcCommission } from "@/lib/sellers";

export interface SplittableLine {
  /** Who sold it, snapshotted at the moment of sale. NULL is the platform. */
  sellerId: string | null;
  price: number;
  quantity: number;
}

export interface SuborderShare {
  sellerId: string | null;
  subtotal: number;
  shippingFee: number;
  commissionAmount: number;
}

/**
 * Divides an order's lines and its delivery charge between sellers.
 *
 * Delivery is shared in proportion to what each seller is owed. Prices are
 * whole Taka, so the proportional shares are floored and the rounding
 * remainder goes to the largest share -- which means the parts always add back
 * up to exactly what the customer was charged, never a taka more or less.
 *
 * An order that somehow totals zero cannot be divided proportionally; the whole
 * delivery charge goes to the platform's share, or to the first share if there
 * is no platform one.
 *
 * Pure, so the arithmetic can be tested without a database.
 */
export function planSuborders(
  lines: SplittableLine[],
  orderShippingFee: number,
  commissionRateOf: (sellerId: string | null) => number = () => 0
): SuborderShare[] {
  const bySeller = new Map<string | null, number>();
  for (const line of lines) {
    const key = line.sellerId ?? null;
    bySeller.set(key, (bySeller.get(key) ?? 0) + line.price * line.quantity);
  }

  const shares: SuborderShare[] = [...bySeller.entries()].map(([sellerId, subtotal]) => ({
    sellerId,
    subtotal,
    shippingFee: 0,
    commissionAmount: sellerId === null ? 0 : calcCommission(subtotal, commissionRateOf(sellerId)),
  }));

  if (shares.length === 0) return shares;

  const total = shares.reduce((sum, share) => sum + share.subtotal, 0);

  if (total <= 0) {
    const fallback = shares.find((share) => share.sellerId === null) ?? shares[0];
    fallback.shippingFee = orderShippingFee;
    return shares;
  }

  let allocated = 0;
  for (const share of shares) {
    share.shippingFee = Math.floor((orderShippingFee * share.subtotal) / total);
    allocated += share.shippingFee;
  }

  // Whatever flooring left over goes to the largest share, so the parts sum to
  // the charge exactly.
  const remainder = orderShippingFee - allocated;
  if (remainder !== 0) {
    const largest = shares.reduce((a, b) => (b.subtotal > a.subtotal ? b : a));
    largest.shippingFee += remainder;
  }

  return shares;
}

/** Commission rates for the sellers named, keyed by id. */
export async function commissionRates(
  sellerIds: (string | null)[]
): Promise<Map<string, number>> {
  const ids = [...new Set(sellerIds.filter((id): id is string => Boolean(id)))];
  if (ids.length === 0) return new Map();

  const db = await getDB();
  const { results } = await db
    .prepare(
      `SELECT id, commission_rate FROM sellers WHERE id IN (${ids.map(() => "?").join(",")})`
    )
    .bind(...ids)
    .all<{ id: string; commission_rate: number }>();

  return new Map(results.map((row) => [row.id, row.commission_rate]));
}

/** The suborder an order line belongs to, once the rows exist. */
export interface CreatedSuborder extends SuborderShare {
  id: string;
}

/** Writes the suborders for an order and hands back their ids by seller. */
export async function createSuborders(
  orderId: string,
  status: string,
  shares: SuborderShare[]
): Promise<Map<string | null, string>> {
  const db = await getDB();
  const ids = new Map<string | null, string>();

  for (const share of shares) {
    const id = crypto.randomUUID();
    ids.set(share.sellerId, id);
    await db
      .prepare(
        `INSERT INTO suborders (id, order_id, seller_id, status, subtotal, shipping_fee, commission_amount)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(id, orderId, share.sellerId, status, share.subtotal, share.shippingFee, share.commissionAmount)
      .run();
  }

  return ids;
}

/**
 * The suborder for an order, creating one if the order predates suborders.
 *
 * Older orders were written before this existed, and an admin saving tracking
 * on one of them should not silently write to nothing. Creating is guarded by a
 * re-read, so two admins saving at once cannot produce two suborders.
 */
export async function ensureSuborder(orderId: string): Promise<string | null> {
  const db = await getDB();
  const existing = await db
    .prepare("SELECT id FROM suborders WHERE order_id = ? ORDER BY rowid ASC LIMIT 1")
    .bind(orderId)
    .first<{ id: string }>();
  if (existing) return existing.id;

  const order = await db
    .prepare("SELECT status, shipping_fee FROM orders WHERE id = ?")
    .bind(orderId)
    .first<{ status: string; shipping_fee: number }>();
  if (!order) return null;

  const subtotalRow = await db
    .prepare("SELECT COALESCE(SUM(price * quantity), 0) AS subtotal FROM order_items WHERE order_id = ?")
    .bind(orderId)
    .first<{ subtotal: number }>();

  const id = crypto.randomUUID();
  await db
    .prepare(
      `INSERT INTO suborders (id, order_id, seller_id, status, subtotal, shipping_fee, commission_amount)
       VALUES (?, ?, NULL, ?, ?, ?, 0)`
    )
    .bind(id, orderId, order.status, subtotalRow?.subtotal ?? 0, order.shipping_fee)
    .run();

  await db
    .prepare("UPDATE order_items SET suborder_id = ? WHERE order_id = ? AND suborder_id IS NULL")
    .bind(id, orderId)
    .run();

  // Another request may have created one first; keep whichever is oldest.
  const settled = await db
    .prepare("SELECT id FROM suborders WHERE order_id = ? ORDER BY rowid ASC LIMIT 1")
    .bind(orderId)
    .first<{ id: string }>();
  return settled?.id ?? id;
}
