/** Best sellers, counted from real orders.
 *
 * "#2 best seller in Shirts" on a card and the `/best-sellers` page both come
 * from here, and both count the same way: units on orders placed in the
 * window, leaving out cancelled and returned ones. A rank is a claim to a
 * shopper, so it is only made when it is backed by sales -- a category's
 * leaders need `MIN_UNITS_FOR_RANK` units in the last 30 days before any of
 * them is called a best seller, and only the top three are. */

import { getDB } from "@/lib/db";
import { cached } from "@/lib/cache";

/** The windows the best-sellers page offers. */
export const BEST_SELLER_WINDOWS = [30, 14, 7] as const;
export type BestSellerWindow = (typeof BEST_SELLER_WINDOWS)[number];

const MIN_UNITS_FOR_RANK = 3;
const RANKED_PER_CATEGORY = 3;

/** Orders that count as a sale. */
const SOLD = "o.status NOT IN ('cancelled', 'returned', 'refunded')";

export interface ProductRank {
  position: number;
  /** The leaf category the product leads, by name. */
  category: string;
}

/** product id -> units sold in the last `days` days, for active products. */
export async function unitsSold(days: BestSellerWindow): Promise<Record<string, number>> {
  return cached(
    `catalog:units:${days}`,
    async () => {
      const db = await getDB();
      const { results } = await db
        .prepare(
          `SELECT oi.product_id AS id, SUM(oi.quantity) AS units
           FROM order_items oi
           JOIN orders o ON o.id = oi.order_id
           JOIN products p ON p.id = oi.product_id
           WHERE p.status = 'active' AND ${SOLD} AND o.placed_at >= datetime('now', ?)
           GROUP BY oi.product_id`
        )
        .bind(`-${days} days`)
        .all<{ id: string; units: number }>();
      return Object.fromEntries(results.map((row) => [row.id, row.units]));
    },
    600
  );
}

/** product id -> its place among its leaf category's best sellers of the last
 * 30 days, for the top three of each category that sold enough to say so. */
export async function bestSellerRanks(): Promise<Record<string, ProductRank>> {
  return cached(
    "catalog:ranks",
    async () => {
      const db = await getDB();
      const { results } = await db
        .prepare(
          `SELECT p.id, p.category_id AS categoryId, c.name AS categoryName,
                  SUM(oi.quantity) AS units
           FROM order_items oi
           JOIN orders o ON o.id = oi.order_id
           JOIN products p ON p.id = oi.product_id
           LEFT JOIN categories c ON c.id = p.category_id
           WHERE p.status = 'active' AND ${SOLD} AND o.placed_at >= datetime('now', '-30 days')
           GROUP BY p.id`
        )
        .all<{ id: string; categoryId: string | null; categoryName: string | null; units: number }>();

      const byCategory = new Map<string, typeof results>();
      for (const row of results) {
        if (!row.categoryId || !row.categoryName) continue;
        const list = byCategory.get(row.categoryId) ?? [];
        list.push(row);
        byCategory.set(row.categoryId, list);
      }

      const ranks: Record<string, ProductRank> = {};
      for (const rows of byCategory.values()) {
        rows
          .filter((row) => row.units >= MIN_UNITS_FOR_RANK)
          .sort((a, b) => b.units - a.units)
          .slice(0, RANKED_PER_CATEGORY)
          .forEach((row, i) => {
            ranks[row.id] = { position: i + 1, category: row.categoryName as string };
          });
      }
      return ranks;
    },
    600
  );
}
