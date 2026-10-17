/** Points: what a shopper earns, spends and has, kept as a ledger.
 *
 * Every change is a row in `points_ledger` with its reason and what it
 * belongs to (an order, a review, a redemption). `users.points` is the cached
 * balance, moved by the same amount in the same batch -- but only when the
 * ledger row was actually written. The ledger's unique (user, reason, ref)
 * index refuses a duplicate, `changes()` then reads 0, and the balance stays
 * put, so writing the same entry twice changes nothing. Incrementing rather
 * than re-summing also keeps any balance credited outside the ledger (by an
 * older deploy) intact. */

import { getDB } from "@/lib/db";

export type PointsReason = "order" | "review" | "signup" | "redeem" | "reverse" | "expire" | "adjust";

/** The two statements that record one change: the ledger row, then the
 * balance recomputed from the ledger. Run them in one batch, alongside
 * whatever else the change belongs to. */
export function pointsStatements(
  db: D1Database,
  entry: { userId: string; delta: number; reason: PointsReason; refId: string; note?: string | null }
): D1PreparedStatement[] {
  return [
    db
      .prepare(
        `INSERT OR IGNORE INTO points_ledger (id, user_id, delta, reason, ref_id, note)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .bind(crypto.randomUUID(), entry.userId, entry.delta, entry.reason, entry.refId, entry.note ?? null),
    // `changes()` is the row count of the INSERT just above: 1 when the entry
    // is new, 0 when the ledger already had it.
    db
      .prepare("UPDATE users SET points = MAX(0, points + ?) WHERE id = ? AND changes() > 0")
      .bind(entry.delta, entry.userId),
  ];
}

export async function recordPoints(entry: Parameters<typeof pointsStatements>[1]): Promise<void> {
  const db = await getDB();
  await db.batch(pointsStatements(db, entry));
}

export interface PointsEntry {
  id: string;
  delta: number;
  reason: PointsReason;
  refId: string | null;
  note: string | null;
  createdAt: string;
  /** For an order row: its number, for display. */
  orderNumber: string | null;
}

export async function pointsHistory(userId: string, limit = 100): Promise<PointsEntry[]> {
  const db = await getDB();
  const { results } = await db
    .prepare(
      `SELECT l.id, l.delta, l.reason, l.ref_id, l.note, l.created_at, o.order_number
       FROM points_ledger l
       LEFT JOIN orders o ON o.id = l.ref_id AND l.reason IN ('order', 'redeem', 'reverse')
       WHERE l.user_id = ?
       ORDER BY l.created_at DESC LIMIT ?`
    )
    .bind(userId, limit)
    .all<{
      id: string;
      delta: number;
      reason: PointsReason;
      ref_id: string | null;
      note: string | null;
      created_at: string;
      order_number: string | null;
    }>();
  return results.map((row) => ({
    id: row.id,
    delta: row.delta,
    reason: row.reason,
    refId: row.ref_id,
    note: row.note,
    createdAt: row.created_at,
    orderNumber: row.order_number,
  }));
}

/** Points to Taka, rounded down to whole Taka: prices here have no paisa. */
export function pointsToTaka(points: number, pointValue: number): number {
  return Math.floor(points * pointValue);
}
