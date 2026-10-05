/** What sellers are owed, and the record of paying them.
 *
 * A seller earns on a suborder: its `subtotal` less the platform's
 * `commission_amount`, both snapshotted when the order was placed, so a later
 * change to the commission rate never rewrites money already earned. The
 * delivery charge is not part of it -- the shopper paid it to the platform,
 * which arranges the delivery.
 *
 * Earnings become payable once the share is delivered. Paying them writes a
 * `seller_payouts` row and one `payout_line_items` row per suborder it covers,
 * so a suborder is settled exactly when a non-failed payout line points at it
 * and can never be paid twice. */

import { getDB } from "@/lib/db";

/** A suborder that no live payout covers yet. Shared by every query below so
 * "unsettled" means the same thing on the seller's screen and the admin's. */
const UNSETTLED = `NOT EXISTS (
  SELECT 1 FROM payout_line_items pli
  JOIN seller_payouts sp ON sp.id = pli.payout_id
  WHERE pli.suborder_id = so.id AND sp.status != 'failed'
)`;

/** Shares still on their way to the customer. Earned, but not yet payable. */
const IN_PROGRESS = `so.status IN ('placed', 'confirmed', 'shipped', 'out_for_delivery')`;

/* -------------------------------------------------------------------------- */
/* Payout account                                                             */
/* -------------------------------------------------------------------------- */

export const PAYOUT_METHODS = [
  { value: "bkash", label: "bKash" },
  { value: "nagad", label: "Nagad" },
  { value: "bank", label: "Bank account" },
] as const;

export interface PayoutAccount {
  method: string | null;
  accountName: string;
  accountNumber: string;
  bankName: string;
  branch: string;
}

export async function getPayoutAccount(sellerId: string): Promise<PayoutAccount> {
  const db = await getDB();
  const row = await db
    .prepare("SELECT payout_method, payout_details FROM sellers WHERE id = ?")
    .bind(sellerId)
    .first<{ payout_method: string | null; payout_details: string | null }>();

  let details: Record<string, string> = {};
  try {
    details = row?.payout_details ? (JSON.parse(row.payout_details) as Record<string, string>) : {};
  } catch {
    details = {};
  }

  return {
    method: row?.payout_method ?? null,
    accountName: details.accountName ?? "",
    accountNumber: details.accountNumber ?? "",
    bankName: details.bankName ?? "",
    branch: details.branch ?? "",
  };
}

export async function setPayoutAccount(sellerId: string, account: PayoutAccount): Promise<void> {
  const db = await getDB();
  const details: Record<string, string> = {
    accountName: account.accountName,
    accountNumber: account.accountNumber,
  };
  if (account.method === "bank") {
    details.bankName = account.bankName;
    details.branch = account.branch;
  }

  await db
    .prepare(
      "UPDATE sellers SET payout_method = ?, payout_details = ?, updated_at = datetime('now') WHERE id = ?"
    )
    .bind(account.method, JSON.stringify(details), sellerId)
    .run();
}

/** "bKash · 01712•••789" -- enough for the admin paying it to recognise the
 * account, written out in full only on the screen where it is paid. */
export function describePayoutAccount(account: PayoutAccount): string {
  const method = PAYOUT_METHODS.find((entry) => entry.value === account.method)?.label;
  if (!method) return "Not set";
  return [method, account.bankName, account.accountNumber].filter(Boolean).join(" · ");
}

/* -------------------------------------------------------------------------- */
/* Balances                                                                   */
/* -------------------------------------------------------------------------- */

export interface SellerBalance {
  /** Net earned on everything not cancelled, all time. */
  lifetimeNet: number;
  /** Paid out to the seller, all time. */
  paidOut: number;
  /** Delivered, not yet in any payout: what the next payout would send. */
  payable: number;
  payableCount: number;
  /** Still with the courier or waiting to be confirmed. */
  inProgress: number;
  /** Payouts recorded but not yet marked paid. */
  pendingPayouts: number;
}

export async function getSellerBalance(sellerId: string): Promise<SellerBalance> {
  const db = await getDB();
  const [earned, payable, progress, payouts] = await db.batch<Record<string, number>>([
    db
      .prepare(
        `SELECT COALESCE(SUM(subtotal - commission_amount), 0) AS net
         FROM suborders WHERE seller_id = ? AND status NOT IN ('cancelled', 'returned')`
      )
      .bind(sellerId),
    db
      .prepare(
        `SELECT COALESCE(SUM(so.subtotal - so.commission_amount), 0) AS net, COUNT(*) AS n
         FROM suborders so
         WHERE so.seller_id = ? AND so.status = 'delivered' AND ${UNSETTLED}`
      )
      .bind(sellerId),
    db
      .prepare(
        `SELECT COALESCE(SUM(so.subtotal - so.commission_amount), 0) AS net
         FROM suborders so WHERE so.seller_id = ? AND ${IN_PROGRESS}`
      )
      .bind(sellerId),
    db
      .prepare(
        `SELECT COALESCE(SUM(CASE WHEN status = 'paid' THEN net_payout END), 0) AS paid,
                COALESCE(SUM(CASE WHEN status IN ('pending', 'processing') THEN net_payout END), 0) AS pending
         FROM seller_payouts WHERE seller_id = ?`
      )
      .bind(sellerId),
  ]);

  const first = <T>(result: D1Result<Record<string, number>>): T =>
    (result.results as unknown as T[])[0];

  const payableRow = first<{ net: number; n: number }>(payable);
  const payoutRow = first<{ paid: number; pending: number }>(payouts);

  return {
    lifetimeNet: first<{ net: number }>(earned)?.net ?? 0,
    paidOut: payoutRow?.paid ?? 0,
    payable: payableRow?.net ?? 0,
    payableCount: payableRow?.n ?? 0,
    inProgress: first<{ net: number }>(progress)?.net ?? 0,
    pendingPayouts: payoutRow?.pending ?? 0,
  };
}

/** What each of these stores could be paid right now, for the admin's list. */
export async function getPayableBySeller(sellerIds: string[]): Promise<Map<string, number>> {
  if (sellerIds.length === 0) return new Map();
  const db = await getDB();
  const { results } = await db
    .prepare(
      `SELECT so.seller_id, COALESCE(SUM(so.subtotal - so.commission_amount), 0) AS net
       FROM suborders so
       WHERE so.seller_id IN (${sellerIds.map(() => "?").join(",")})
         AND so.status = 'delivered' AND ${UNSETTLED}
       GROUP BY so.seller_id`
    )
    .bind(...sellerIds)
    .all<{ seller_id: string; net: number }>();

  return new Map(results.map((row) => [row.seller_id, row.net]));
}

/* -------------------------------------------------------------------------- */
/* History                                                                    */
/* -------------------------------------------------------------------------- */

export interface PayoutRow {
  id: string;
  periodStart: string;
  periodEnd: string;
  grossSales: number;
  commission: number;
  netPayout: number;
  status: string;
  orderCount: number;
  paidAt: string | null;
  /** The transfer's own id -- what the seller matches on their statement. */
  reference: string | null;
  createdAt: string;
}

export async function listSellerPayouts(sellerId: string, limit = 50): Promise<PayoutRow[]> {
  const db = await getDB();
  const { results } = await db
    .prepare(
      `SELECT sp.id, sp.period_start, sp.period_end, sp.gross_sales, sp.commission_amount,
              sp.net_payout, sp.status, sp.paid_at, sp.created_at, sp.reference,
              (SELECT COUNT(*) FROM payout_line_items pli WHERE pli.payout_id = sp.id) AS order_count
       FROM seller_payouts sp WHERE sp.seller_id = ?
       ORDER BY sp.created_at DESC LIMIT ?`
    )
    .bind(sellerId, limit)
    .all<{
      id: string;
      period_start: string;
      period_end: string;
      gross_sales: number;
      commission_amount: number;
      net_payout: number;
      status: string;
      paid_at: string | null;
      created_at: string;
      reference: string | null;
      order_count: number;
    }>();

  return results.map((row) => ({
    id: row.id,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    grossSales: row.gross_sales,
    commission: row.commission_amount,
    netPayout: row.net_payout,
    status: row.status,
    orderCount: row.order_count,
    paidAt: row.paid_at,
    reference: row.reference,
    createdAt: row.created_at,
  }));
}

export interface EarningRow {
  suborderId: string;
  orderNumber: string;
  placedAt: string;
  status: string;
  subtotal: number;
  commission: number;
  net: number;
  /** "paid", "pending"... from the payout covering it; null while unsettled. */
  payoutStatus: string | null;
}

/** One line per order share: the seller's statement. */
export async function listSellerEarnings(
  sellerId: string,
  options: { page?: number; pageSize?: number } = {}
): Promise<{ rows: EarningRow[]; total: number }> {
  const db = await getDB();
  const pageSize = options.pageSize ?? 15;
  const offset = Math.max(0, (options.page ?? 1) - 1) * pageSize;

  const [rows, count] = await db.batch<Record<string, unknown>>([
    db
      .prepare(
        `SELECT so.id, so.status, so.subtotal, so.commission_amount, o.order_number, o.placed_at,
                (SELECT sp.status FROM payout_line_items pli
                  JOIN seller_payouts sp ON sp.id = pli.payout_id
                  WHERE pli.suborder_id = so.id AND sp.status != 'failed' LIMIT 1) AS payout_status
         FROM suborders so JOIN orders o ON o.id = so.order_id
         WHERE so.seller_id = ?
         ORDER BY o.placed_at DESC LIMIT ? OFFSET ?`
      )
      .bind(sellerId, pageSize, offset),
    db.prepare("SELECT COUNT(*) AS n FROM suborders WHERE seller_id = ?").bind(sellerId),
  ]);

  return {
    rows: (rows.results as unknown as {
      id: string;
      status: string;
      subtotal: number;
      commission_amount: number;
      order_number: string;
      placed_at: string;
      payout_status: string | null;
    }[]).map((row) => {
      const void_ = row.status === "cancelled" || row.status === "returned";
      return {
        suborderId: row.id,
        orderNumber: row.order_number,
        placedAt: row.placed_at,
        status: row.status,
        subtotal: row.subtotal,
        commission: row.commission_amount,
        net: void_ ? 0 : row.subtotal - row.commission_amount,
        payoutStatus: row.payout_status,
      };
    }),
    total: (count.results as unknown as { n: number }[])[0]?.n ?? 0,
  };
}

/* -------------------------------------------------------------------------- */
/* Paying out (admin)                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Records that a store has been paid everything currently payable.
 *
 * The money itself moves outside this system -- a bKash send or a bank
 * transfer the admin makes -- so this is the receipt, written once the admin
 * says it has been sent. The covered suborders are read and claimed in one
 * batch: each line item insert re-checks that no live payout covers its
 * suborder, so two admins pressing the button together cannot pay one order
 * twice -- the second batch writes lines for nothing and its payout is removed.
 *
 * Resolves with the payout id and amount, or null when nothing was payable.
 */
export async function recordSellerPayout(
  sellerId: string,
  reference: string | null
): Promise<{ id: string; amount: number; count: number } | null> {
  const db = await getDB();
  const { results } = await db
    .prepare(
      `SELECT so.id, so.subtotal, so.commission_amount,
              COALESCE(so.delivered_at, so.created_at) AS settled_on
       FROM suborders so
       WHERE so.seller_id = ? AND so.status = 'delivered' AND ${UNSETTLED}
       ORDER BY settled_on ASC`
    )
    .bind(sellerId)
    .all<{ id: string; subtotal: number; commission_amount: number; settled_on: string }>();

  if (results.length === 0) return null;

  const gross = results.reduce((sum, row) => sum + row.subtotal, 0);
  const commission = results.reduce((sum, row) => sum + row.commission_amount, 0);
  const net = gross - commission;
  const payoutId = crypto.randomUUID();

  const statements = [
    db
      .prepare(
        `INSERT INTO seller_payouts (id, seller_id, period_start, period_end, gross_sales,
                                     commission_amount, net_payout, status, paid_at, reference)
         VALUES (?, ?, ?, datetime('now'), ?, ?, ?, 'paid', datetime('now'), ?)`
      )
      .bind(payoutId, sellerId, results[0].settled_on, gross, commission, net, reference),
    ...results.map((row) =>
      db
        .prepare(
          `INSERT INTO payout_line_items (id, payout_id, suborder_id, amount)
           SELECT ?, ?, ?, ?
           WHERE NOT EXISTS (
             SELECT 1 FROM payout_line_items pli
             JOIN seller_payouts sp ON sp.id = pli.payout_id
             WHERE pli.suborder_id = ? AND sp.status != 'failed' AND sp.id != ?
           )`
        )
        .bind(
          crypto.randomUUID(),
          payoutId,
          row.id,
          row.subtotal - row.commission_amount,
          row.id,
          payoutId
        )
    ),
  ];

  await db.batch(statements);

  // If another payout claimed some of these first, this one's totals must
  // describe only what it actually covers.
  const covered = await db
    .prepare(
      `SELECT COUNT(*) AS n, COALESCE(SUM(pli.amount), 0) AS net,
              COALESCE(SUM(so.subtotal), 0) AS gross
       FROM payout_line_items pli JOIN suborders so ON so.id = pli.suborder_id
       WHERE pli.payout_id = ?`
    )
    .bind(payoutId)
    .first<{ n: number; net: number; gross: number }>();

  if (!covered || covered.n === 0) {
    await db.prepare("DELETE FROM seller_payouts WHERE id = ?").bind(payoutId).run();
    return null;
  }

  if (covered.n !== results.length) {
    await db
      .prepare(
        `UPDATE seller_payouts SET gross_sales = ?, commission_amount = ?, net_payout = ? WHERE id = ?`
      )
      .bind(covered.gross, covered.gross - covered.net, covered.net, payoutId)
      .run();
  }

  return { id: payoutId, amount: covered.net, count: covered.n };
}
