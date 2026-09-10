/** What an order's stock should do when the order moves.
 *
 * Two independent guarantees, because one is not enough:
 *
 *  1. `orders.stock_state` is claimed by a conditional UPDATE. Only the request
 *     that actually changes the row goes on to touch stock, so two clicks on
 *     "Confirm" cannot both commit.
 *  2. The ledger's unique index refuses a second sale or return for the same
 *     order and variant even if something slipped past the first guard.
 *
 * The status ladder decides only *whether the threshold has been crossed*. It
 * does not make the status system monotonic: an order can still go back, be
 * cancelled, refunded or anything else its own rules allow. All the ladder says
 * is that reaching confirmed, or anything past it, is the point at which held
 * stock becomes sold stock. */

import { getDB } from "@/lib/db";
import { commitSaleOnce, releaseReservation, returnSaleOnce } from "@/lib/inventory";

/** How far along fulfilment a status is. Statuses outside this -- cancelled,
 * and whatever is added later -- have no rank and are handled by name. */
export const FULFILMENT_RANK: Record<string, number> = {
  placed: 0,
  confirmed: 1,
  shipped: 2,
  out_for_delivery: 3,
  delivered: 4,
};

/** Reaching this rank is what turns a hold into a sale. */
const COMMIT_AT = FULFILMENT_RANK.confirmed;

export type StockOutcome = "committed" | "released" | "returned" | "none";

interface OrderLine {
  variant_id: string | null;
  quantity: number;
}

async function linesOf(orderId: string): Promise<OrderLine[]> {
  const db = await getDB();
  const { results } = await db
    .prepare("SELECT variant_id, quantity FROM order_items WHERE order_id = ?")
    .bind(orderId)
    .all<OrderLine>();
  return results;
}

/** Claims a stock_state transition. Returns true only for the caller that
 * actually moved the row -- everyone else is a repeat and does nothing. */
async function claim(orderId: string, from: string, to: string): Promise<boolean> {
  const db = await getDB();
  const result = await db
    .prepare("UPDATE orders SET stock_state = ?, updated_at = datetime('now') WHERE id = ? AND stock_state = ?")
    .bind(to, orderId, from)
    .run();
  return (result.meta.changes ?? 0) > 0;
}

/**
 * Moves the order's stock to match a new status, at most once.
 *
 * Safe to call for every status change, including one that changes nothing:
 * confirmed to placed and back to confirmed commits exactly once, because the
 * second confirm finds the order already committed rather than reserved.
 */
export async function applyStockForStatus(
  orderId: string,
  nextStatus: string
): Promise<StockOutcome> {
  if (nextStatus === "cancelled") {
    // Cancelled before the sale was committed: hand the hold straight back.
    if (await claim(orderId, "reserved", "released")) {
      for (const line of await linesOf(orderId)) {
        if (line.variant_id) await releaseReservation(line.variant_id, line.quantity);
      }
      return "released";
    }

    // Cancelled after it was committed: put the goods back on the shelf.
    if (await claim(orderId, "committed", "returned")) {
      for (const line of await linesOf(orderId)) {
        if (line.variant_id) await returnSaleOnce(line.variant_id, line.quantity, orderId);
      }
      return "returned";
    }

    return "none";
  }

  const rank = FULFILMENT_RANK[nextStatus];
  if (rank === undefined || rank < COMMIT_AT) return "none";

  if (await claim(orderId, "reserved", "committed")) {
    for (const line of await linesOf(orderId)) {
      if (line.variant_id) await commitSaleOnce(line.variant_id, line.quantity, orderId);
    }
    return "committed";
  }

  return "none";
}
