/** Product reviews and the rating aggregates on `products`.
 *
 * `products.rating_avg` / `rating_count` are denormalized so listing pages can
 * sort and display stars without joining reviews. They are recomputed from the
 * reviews table on every write here -- never set them by hand. */

import { getDB } from "@/lib/db";
import { DELIVERED_AFTER_HOURS } from "@/lib/orders";
import type { Review } from "@/types";

interface ReviewRow {
  id: string;
  product_id: string;
  user_id: string;
  user_name: string;
  order_item_id: string | null;
  line_label: string | null;
  rating: number;
  title: string | null;
  body: string | null;
  seller_reply: string | null;
  helpful_count: number;
  created_at: string;
}

function toReview(row: ReviewRow, images: string[] = [], purchasedOption: string | null = null): Review {
  return {
    id: row.id,
    productId: row.product_id,
    userId: row.user_id,
    userName: row.user_name,
    rating: row.rating,
    title: row.title,
    body: row.body,
    sellerReply: row.seller_reply,
    isVerifiedPurchase: row.order_item_id !== null,
    helpfulCount: row.helpful_count,
    images,
    createdAt: row.created_at,
    purchasedOption,
  };
}

export async function listReviews(
  productId: string,
  options: { limit?: number; offset?: number } = {}
): Promise<Review[]> {
  const db = await getDB();
  const { results } = await db
    .prepare(
      `SELECT r.id, r.product_id, r.user_id, u.name AS user_name, r.order_item_id,
              oi.color AS line_label, r.rating,
              r.title, r.body, r.seller_reply, r.helpful_count, r.created_at
       FROM reviews r
       JOIN users u ON u.id = r.user_id
       LEFT JOIN order_items oi ON oi.id = r.order_item_id
       WHERE r.product_id = ? AND r.is_approved = 1
       ORDER BY r.created_at DESC LIMIT ? OFFSET ?`
    )
    .bind(productId, options.limit ?? 20, options.offset ?? 0)
    .all<ReviewRow>();

  if (results.length === 0) return [];

  const ids = results.map((r) => r.id);
  const placeholders = ids.map(() => "?").join(",");
  const [imageRows, optionRows] = await db.batch<Record<string, unknown>>([
    db
      .prepare(`SELECT review_id, url FROM review_images WHERE review_id IN (${placeholders})`)
      .bind(...ids),
    // What the reviewer bought, named by group ("Size: L") rather than the
    // bare "Olive / L" stored on the order line.
    db
      .prepare(
        `SELECT r.id AS review_id, g.name AS group_name, ov.label AS value_label
         FROM reviews r
         JOIN order_items oi ON oi.id = r.order_item_id
         JOIN product_variant_options pvo ON pvo.variant_id = oi.variant_id
         JOIN product_option_groups g ON g.id = pvo.group_id
         JOIN product_option_values ov ON ov.id = pvo.value_id
         WHERE r.id IN (${placeholders})
         ORDER BY g.sort_order ASC`
      )
      .bind(...ids),
  ]);

  const images = imageRows.results as unknown as { review_id: string; url: string }[];
  const options_ = optionRows.results as unknown as {
    review_id: string;
    group_name: string;
    value_label: string;
  }[];

  return results.map((row) => {
    const named = options_
      .filter((option) => option.review_id === row.id)
      .map((option) => `${option.group_name}: ${option.value_label}`)
      .join(" · ");

    return toReview(
      row,
      images.filter((image) => image.review_id === row.id).map((image) => image.url),
      // The order line's own label is the fallback for an option retired since.
      named || row.line_label || null
    );
  });
}

export interface RatingBreakdown {
  average: number;
  total: number;
  /** Count of reviews at each star level, indexed 1-5. */
  counts: Record<1 | 2 | 3 | 4 | 5, number>;
}

/** The star histogram shown on a product page. */
export async function getRatingBreakdown(productId: string): Promise<RatingBreakdown> {
  const db = await getDB();
  const { results } = await db
    .prepare(
      `SELECT rating, COUNT(*) AS n FROM reviews
       WHERE product_id = ? AND is_approved = 1 GROUP BY rating`
    )
    .bind(productId)
    .all<{ rating: number; n: number }>();

  const counts: Record<1 | 2 | 3 | 4 | 5, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let total = 0;
  let sum = 0;

  for (const row of results) {
    const star = Math.min(5, Math.max(1, row.rating)) as 1 | 2 | 3 | 4 | 5;
    counts[star] = row.n;
    total += row.n;
    sum += row.rating * row.n;
  }

  return { average: total === 0 ? 0 : Math.round((sum / total) * 10) / 10, total, counts };
}

/* -------------------------------------------------------------------------- */
/* Who may review                                                             */
/* -------------------------------------------------------------------------- */

/** "Delivered" as the shopper's own tracker shows it: marked delivered by
 * staff, or old enough that the simulated timeline has reached delivery.
 * Cancelled orders never qualify. Expects the orders table aliased `o`. */
const DELIVERED_SQL = `o.status != 'cancelled'
  AND (o.status = 'delivered' OR o.placed_at <= datetime('now', ?))`;
const DELIVERED_BIND = `-${DELIVERED_AFTER_HOURS} hours`;

export interface ReviewableLine {
  orderItemId: string;
  orderNumber: string;
  /** The option label stored on the order line, e.g. "Olive / M". */
  label: string | null;
}

/** Order lines of this product the shopper has received and not yet reviewed.
 *
 * One review per order line: buying the same shirt twice earns two reviews,
 * reviewing one purchase twice does not. */
export async function getReviewableLines(
  userId: string,
  productId: string
): Promise<ReviewableLine[]> {
  const db = await getDB();
  const { results } = await db
    .prepare(
      `SELECT oi.id, o.order_number, oi.color
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       WHERE o.user_id = ? AND oi.product_id = ? AND ${DELIVERED_SQL}
         AND NOT EXISTS (SELECT 1 FROM reviews r WHERE r.order_item_id = oi.id)
       ORDER BY o.placed_at DESC`
    )
    .bind(userId, productId, DELIVERED_BIND)
    .all<{ id: string; order_number: string; color: string | null }>();

  return results.map((row) => ({
    orderItemId: row.id,
    orderNumber: row.order_number,
    label: row.color,
  }));
}

export type OrderLineReviewState = "reviewable" | "reviewed" | "not_delivered";

/** Per line of one order: whether it can be reviewed, and where. `slug` is null
 * when the product is no longer on sale, since there is no page to review on. */
export async function getOrderReviewStates(
  userId: string,
  orderId: string
): Promise<Map<string, { state: OrderLineReviewState; slug: string | null }>> {
  const db = await getDB();
  const { results } = await db
    .prepare(
      `SELECT oi.id,
              CASE WHEN p.status = 'active' THEN p.slug END AS slug,
              EXISTS (SELECT 1 FROM reviews r WHERE r.order_item_id = oi.id) AS reviewed,
              (${DELIVERED_SQL}) AS delivered
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       LEFT JOIN products p ON p.id = oi.product_id
       WHERE o.id = ? AND o.user_id = ?`
    )
    .bind(DELIVERED_BIND, orderId, userId)
    .all<{ id: string; slug: string | null; reviewed: number; delivered: number }>();

  return new Map(
    results.map((row) => [
      row.id,
      {
        state: row.reviewed ? "reviewed" : row.delivered ? "reviewable" : "not_delivered",
        slug: row.slug,
      },
    ])
  );
}

/** True when the shopper actually bought this product, which marks the review
 * "verified purchase" and links it to the order line it came from. */
async function findPurchase(userId: string, productId: string): Promise<string | null> {
  const db = await getDB();
  const row = await db
    .prepare(
      `SELECT oi.id FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       WHERE o.user_id = ? AND oi.product_id = ?
       ORDER BY o.placed_at DESC LIMIT 1`
    )
    .bind(userId, productId)
    .first<{ id: string }>();
  return row?.id ?? null;
}

export interface ReviewInput {
  productId: string;
  userId: string;
  rating: number;
  title?: string | null;
  body?: string | null;
  imageUrls?: string[];
  /** The order line being reviewed. Looked up from the shopper's orders when omitted. */
  orderItemId?: string | null;
  /** "pending" holds the review for moderation. */
  status?: "approved" | "pending";
}

/** Writes a review and refreshes the product's rating aggregate in the same
 * batch, so the stars on listing pages can never lag the review list.
 *
 * Returns null when the order line already has a review. The check is part of
 * the insert itself, so a double-tapped submit cannot write two. */
export async function createReview(input: ReviewInput): Promise<string | null> {
  if (input.rating < 1 || input.rating > 5) {
    throw new Error("Rating must be between 1 and 5.");
  }

  const db = await getDB();
  const orderItemId = input.orderItemId ?? (await findPurchase(input.userId, input.productId));
  const status = input.status ?? "approved";
  const reviewId = crypto.randomUUID();

  const [inserted] = await db.batch([
    db
      .prepare(
        `INSERT INTO reviews (id, product_id, user_id, order_item_id, rating, title, body, status, is_approved)
         SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?
         WHERE ? IS NULL OR NOT EXISTS (SELECT 1 FROM reviews WHERE order_item_id = ?)`
      )
      .bind(
        reviewId,
        input.productId,
        input.userId,
        orderItemId,
        input.rating,
        input.title ?? null,
        input.body ?? null,
        status,
        status === "approved" ? 1 : 0,
        orderItemId,
        orderItemId
      ),
    // Tied to the review row existing, so a refused insert leaves no orphans.
    ...(input.imageUrls ?? []).map((url) =>
      db
        .prepare(
          "INSERT INTO review_images (id, review_id, url) SELECT ?, ?, ? WHERE EXISTS (SELECT 1 FROM reviews WHERE id = ?)"
        )
        .bind(crypto.randomUUID(), reviewId, url, reviewId)
    ),
    recalculateStatement(db, input.productId),
  ]);

  return inserted.meta.changes > 0 ? reviewId : null;
}

/** Recomputes `products.rating_avg` / `rating_count` from the reviews table. */
function recalculateStatement(db: D1Database, productId: string): D1PreparedStatement {
  return db
    .prepare(
      `UPDATE products SET
         rating_avg = COALESCE((SELECT ROUND(AVG(rating), 1) FROM reviews
                                 WHERE product_id = ? AND is_approved = 1), 0),
         rating_count = (SELECT COUNT(*) FROM reviews WHERE product_id = ? AND is_approved = 1),
         updated_at = datetime('now')
       WHERE id = ?`
    )
    .bind(productId, productId, productId);
}

/** Recomputes the aggregate on its own, e.g. after moderating a review. */
export async function recalculateRating(productId: string): Promise<void> {
  const db = await getDB();
  await recalculateStatement(db, productId).run();
}

export async function deleteReview(reviewId: string, productId: string): Promise<void> {
  const db = await getDB();
  await db.batch([
    db.prepare("DELETE FROM reviews WHERE id = ?").bind(reviewId),
    recalculateStatement(db, productId),
  ]);
}

/** Hides or restores a review without deleting it, then refreshes the average. */
export async function setReviewApproval(
  reviewId: string,
  productId: string,
  isApproved: boolean
): Promise<void> {
  const db = await getDB();
  await db.batch([
    db
      .prepare("UPDATE reviews SET is_approved = ?, status = ? WHERE id = ?")
      .bind(isApproved ? 1 : 0, isApproved ? "approved" : "pending", reviewId),
    recalculateStatement(db, productId),
  ]);
}

export async function replyToReview(reviewId: string, reply: string): Promise<void> {
  const db = await getDB();
  await db
    .prepare("UPDATE reviews SET seller_reply = ?, seller_replied_at = datetime('now') WHERE id = ?")
    .bind(reply, reviewId)
    .run();
}

export async function markHelpful(reviewId: string): Promise<void> {
  const db = await getDB();
  await db
    .prepare("UPDATE reviews SET helpful_count = helpful_count + 1 WHERE id = ?")
    .bind(reviewId)
    .run();
}
