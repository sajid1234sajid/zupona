/** Stock control.
 *
 * `product_variants.stock_quantity` is the fast current value; every change to
 * it is also written to `inventory_movements`, which is the append-only audit
 * trail. Always go through these helpers so the two never disagree.
 *
 * Reservations exist so a pending (unpaid) order can hold stock without
 * deducting it: available = stock_quantity - reserved_quantity. */

import { getDB } from "@/lib/db";

export type StockReason = "restock" | "sale" | "return" | "adjustment" | "damaged";

export interface StockLevel {
  variantId: string;
  productId: string;
  productName: string;
  optionValue: string | null;
  stockQuantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  lowStockThreshold: number;
  isLow: boolean;
}

interface StockRow {
  variant_id: string;
  product_id: string;
  product_name: string;
  option1_value: string | null;
  stock_quantity: number;
  reserved_quantity: number;
  low_stock_threshold: number;
}

function toStockLevel(row: StockRow): StockLevel {
  const available = Math.max(0, row.stock_quantity - row.reserved_quantity);
  return {
    variantId: row.variant_id,
    productId: row.product_id,
    productName: row.product_name,
    optionValue: row.option1_value,
    stockQuantity: row.stock_quantity,
    reservedQuantity: row.reserved_quantity,
    availableQuantity: available,
    lowStockThreshold: row.low_stock_threshold,
    isLow: available <= row.low_stock_threshold,
  };
}

const STOCK_SELECT = `
  SELECT v.id AS variant_id, v.product_id, p.name AS product_name, v.option1_value,
         v.stock_quantity, v.reserved_quantity, v.low_stock_threshold
  FROM product_variants v
  JOIN products p ON p.id = v.product_id`;

export async function getStockLevel(variantId: string): Promise<StockLevel | null> {
  const db = await getDB();
  const row = await db.prepare(`${STOCK_SELECT} WHERE v.id = ?`).bind(variantId).first<StockRow>();
  return row ? toStockLevel(row) : null;
}

/** Variants at or below their low-stock threshold -- the seller dashboard's
 * "restock these" list. */
export async function getLowStock(sellerId?: string, limit = 50): Promise<StockLevel[]> {
  const db = await getDB();
  const sellerClause = sellerId ? "AND p.seller_id = ?" : "";
  const binds: unknown[] = sellerId ? [sellerId, limit] : [limit];

  const { results } = await db
    .prepare(
      `${STOCK_SELECT}
       WHERE v.is_active = 1
         AND (v.stock_quantity - v.reserved_quantity) <= v.low_stock_threshold
         ${sellerClause}
       ORDER BY (v.stock_quantity - v.reserved_quantity) ASC LIMIT ?`
    )
    .bind(...binds)
    .all<StockRow>();

  return results.map(toStockLevel);
}

/** Applies a stock delta and records it in the ledger. `changeQty` is signed:
 * positive for restocks and returns, negative for sales and write-offs.
 * Stock is clamped at zero so a double-applied sale cannot go negative. */
export async function adjustStock(
  variantId: string,
  changeQty: number,
  reason: StockReason,
  options: { referenceType?: string; referenceId?: string; note?: string; userId?: string } = {}
): Promise<void> {
  if (changeQty === 0) return;
  const db = await getDB();

  await db.batch([
    db
      .prepare(
        `UPDATE product_variants
         SET stock_quantity = MAX(0, stock_quantity + ?)
         WHERE id = ?`
      )
      .bind(changeQty, variantId),
    db
      .prepare(
        `INSERT INTO inventory_movements (id, variant_id, change_qty, reason, reference_type,
                                          reference_id, note, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        crypto.randomUUID(),
        variantId,
        changeQty,
        reason,
        options.referenceType ?? null,
        options.referenceId ?? null,
        options.note ?? null,
        options.userId ?? null
      ),
  ]);
}

/** Sets stock to an absolute figure (a stock count), recording the difference
 * as an adjustment so the ledger still reconciles. */
export async function setStock(
  variantId: string,
  newQuantity: number,
  options: { note?: string; userId?: string } = {}
): Promise<void> {
  const current = await getStockLevel(variantId);
  if (!current) throw new Error(`Unknown variant: ${variantId}`);

  const delta = newQuantity - current.stockQuantity;
  if (delta === 0) return;

  await adjustStock(variantId, delta, "adjustment", {
    referenceType: "manual",
    note: options.note ?? "Stock count",
    userId: options.userId,
  });
}

/** Holds stock for a checkout in flight. Returns false when there is not
 * enough available, so the caller can fail the order before taking payment.
 * The conditional UPDATE makes the check-and-hold a single atomic statement. */
export async function reserveStock(variantId: string, quantity: number): Promise<boolean> {
  const db = await getDB();
  const result = await db
    .prepare(
      `UPDATE product_variants
       SET reserved_quantity = reserved_quantity + ?
       WHERE id = ? AND (stock_quantity - reserved_quantity) >= ?`
    )
    .bind(quantity, variantId, quantity)
    .run();

  return (result.meta.changes ?? 0) > 0;
}

/** Releases a hold without selling (cart abandoned, payment failed). */
export async function releaseReservation(variantId: string, quantity: number): Promise<void> {
  const db = await getDB();
  await db
    .prepare(
      "UPDATE product_variants SET reserved_quantity = MAX(0, reserved_quantity - ?) WHERE id = ?"
    )
    .bind(quantity, variantId)
    .run();
}

/** Converts a reservation into a completed sale: drops the hold, deducts real
 * stock, bumps the product's sold counter and writes the ledger row. */
export async function commitSale(
  variantId: string,
  quantity: number,
  orderId: string
): Promise<void> {
  const db = await getDB();

  await db.batch([
    db
      .prepare(
        `UPDATE product_variants
         SET reserved_quantity = MAX(0, reserved_quantity - ?),
             stock_quantity = MAX(0, stock_quantity - ?)
         WHERE id = ?`
      )
      .bind(quantity, quantity, variantId),
    db
      .prepare(
        `UPDATE products SET sold_count = sold_count + ?
         WHERE id = (SELECT product_id FROM product_variants WHERE id = ?)`
      )
      .bind(quantity, variantId),
    db
      .prepare(
        `INSERT INTO inventory_movements (id, variant_id, change_qty, reason, reference_type, reference_id)
         VALUES (?, ?, ?, 'sale', 'order', ?)`
      )
      .bind(crypto.randomUUID(), variantId, -quantity, orderId),
  ]);
}

/** The ledger for one variant, newest first. */
export async function getMovements(variantId: string, limit = 50) {
  const db = await getDB();
  const { results } = await db
    .prepare(
      `SELECT id, change_qty, reason, reference_type, reference_id, note, created_at
       FROM inventory_movements WHERE variant_id = ?
       ORDER BY created_at DESC LIMIT ?`
    )
    .bind(variantId, limit)
    .all<{
      id: string;
      change_qty: number;
      reason: string;
      reference_type: string | null;
      reference_id: string | null;
      note: string | null;
      created_at: string;
    }>();

  return results.map((row) => ({
    id: row.id,
    changeQty: row.change_qty,
    reason: row.reason as StockReason,
    referenceType: row.reference_type,
    referenceId: row.reference_id,
    note: row.note,
    createdAt: row.created_at,
  }));
}
