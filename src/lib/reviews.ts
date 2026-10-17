/** Product reviews and the rating aggregates on `products`.
 *
 * `products.rating_avg` / `rating_count` are denormalized so listing pages can
 * sort and display stars without joining reviews. They are recomputed from the
 * reviews table on every write here -- never set them by hand. */

import { getDB } from "@/lib/db";
import { DELIVERED_AFTER_HOURS } from "@/lib/orders";
import type { Review } from "@/types";
import { getShopSettings } from "@/lib/shopSettings";
import { pointsStatements } from "@/lib/points";
import { REVIEW_TAGS, type ReviewFit } from "@/lib/reviewTags";

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
  fit: string | null;
  tags: string | null;
  incentivized: number;
}

function parseTags(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((t): t is string => typeof t === "string") : [];
  } catch {
    return [];
  }
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
    fit: row.fit === "small" || row.fit === "true" || row.fit === "large" ? row.fit : null,
    tags: parseTags(row.tags),
    incentivized: row.incentivized === 1,
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
              r.title, r.body, r.seller_reply, r.helpful_count, r.created_at,
              r.fit, r.tags, r.incentivized
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
  /** How apparel fitted, from the reviews that said. */
  fit: { small: number; true: number; large: number };
  /** Tag id -> how many reviews picked it, most picked first. */
  tags: { id: string; count: number }[];
  /** Reviews with at least one photo. */
  withPhotos: number;
  /** The newest customer photos, for the strip above the reviews. */
  photos: string[];
}

/** Everything the summary above the reviews shows, from approved reviews. */
export async function getRatingBreakdown(productId: string): Promise<RatingBreakdown> {
  const db = await getDB();
  const [ratings, extras, photos] = await db.batch<Record<string, unknown>>([
    db
      .prepare(
        `SELECT rating, COUNT(*) AS n FROM reviews
         WHERE product_id = ? AND is_approved = 1 GROUP BY rating`
      )
      .bind(productId),
    db
      .prepare(
        `SELECT fit, tags FROM reviews
         WHERE product_id = ? AND is_approved = 1 AND (fit IS NOT NULL OR tags IS NOT NULL)`
      )
      .bind(productId),
    db
      .prepare(
        `SELECT i.url, i.review_id FROM review_images i
         JOIN reviews r ON r.id = i.review_id
         WHERE r.product_id = ? AND r.is_approved = 1
         ORDER BY r.created_at DESC LIMIT 40`
      )
      .bind(productId),
  ]);

  const counts: Record<1 | 2 | 3 | 4 | 5, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let total = 0;
  let sum = 0;
  for (const row of ratings.results as unknown as { rating: number; n: number }[]) {
    const star = Math.min(5, Math.max(1, row.rating)) as 1 | 2 | 3 | 4 | 5;
    counts[star] = row.n;
    total += row.n;
    sum += row.rating * row.n;
  }

  const fit = { small: 0, true: 0, large: 0 };
  const tagCounts = new Map<string, number>();
  for (const row of extras.results as unknown as { fit: string | null; tags: string | null }[]) {
    if (row.fit === "small" || row.fit === "true" || row.fit === "large") fit[row.fit]++;
    for (const tag of parseTags(row.tags)) tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
  }

  const photoRows = photos.results as unknown as { url: string; review_id: string }[];

  return {
    average: total === 0 ? 0 : Math.round((sum / total) * 10) / 10,
    total,
    counts,
    fit,
    tags: [...tagCounts.entries()]
      .filter(([id]) => REVIEW_TAGS.some((tag) => tag.id === id))
      .sort((a, b) => b[1] - a[1])
      .map(([id, count]) => ({ id, count })),
    withPhotos: new Set(photoRows.map((row) => row.review_id)).size,
    photos: photoRows.slice(0, 20).map((row) => row.url),
  };
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
  fit?: ReviewFit | null;
  tags?: string[];
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
        `INSERT INTO reviews (id, product_id, user_id, order_item_id, rating, title, body, status, is_approved, fit, tags)
         SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
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
        input.fit ?? null,
        input.tags && input.tags.length > 0 ? JSON.stringify(input.tags) : null,
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

/** One "Helpful" per shopper per review; the count is recounted from the
 * votes, so pressing again changes nothing. Returns the new count. */
export async function voteHelpful(reviewId: string, userId: string): Promise<number> {
  const db = await getDB();
  const [, , row] = await db.batch<{ helpful_count: number }>([
    db
      .prepare("INSERT OR IGNORE INTO review_votes (review_id, user_id) VALUES (?, ?)")
      .bind(reviewId, userId),
    db
      .prepare(
        "UPDATE reviews SET helpful_count = (SELECT COUNT(*) FROM review_votes WHERE review_id = ?) WHERE id = ?"
      )
      .bind(reviewId, reviewId),
    db.prepare("SELECT helpful_count FROM reviews WHERE id = ?").bind(reviewId),
  ]);
  return row.results[0]?.helpful_count ?? 0;
}

/** Points for a published review, once: `reviewPoints` when it has at least
 * 20 characters of text, plus `reviewPhotoPoints` with a photo -- never more
 * or less for the stars it gives. A review that earned points is marked so
 * the page can say so. Safe to call again: the ledger takes one review entry
 * per review. */
export async function rewardReview(reviewId: string): Promise<number> {
  const [settings, db] = await Promise.all([getShopSettings(), getDB()]);
  if (settings.reviewPoints <= 0 && settings.reviewPhotoPoints <= 0) return 0;

  const review = await db
    .prepare(
      `SELECT r.user_id, r.body, r.is_approved,
              EXISTS (SELECT 1 FROM review_images i WHERE i.review_id = r.id) AS has_photo
       FROM reviews r WHERE r.id = ?`
    )
    .bind(reviewId)
    .first<{ user_id: string; body: string | null; is_approved: number; has_photo: number }>();
  if (!review || review.is_approved !== 1) return 0;

  const written = (review.body ?? "").trim().length >= 20;
  const points =
    (written ? settings.reviewPoints : 0) + (written && review.has_photo ? settings.reviewPhotoPoints : 0);
  if (points <= 0) return 0;

  await db.batch([
    ...pointsStatements(db, { userId: review.user_id, delta: points, reason: "review", refId: reviewId }),
    db.prepare("UPDATE reviews SET incentivized = 1 WHERE id = ?").bind(reviewId),
  ]);
  return points;
}

export interface ReviewTask {
  orderItemId: string;
  orderNumber: string;
  productId: string;
  slug: string | null;
  name: string;
  image: string;
  label: string | null;
  deliveredAt: string;
}

/** For Account > My reviews: what the shopper can still review, and what they
 * already have. */
export async function getMyReviews(userId: string): Promise<{
  toReview: ReviewTask[];
  reviewed: (Review & { productName: string; productSlug: string | null; productImage: string })[];
}> {
  const db = await getDB();
  const [pending, done] = await db.batch<Record<string, unknown>>([
    db
      .prepare(
        `SELECT oi.id, o.order_number, oi.product_id, oi.name, oi.image, oi.color,
                o.placed_at AS delivered_at,
                CASE WHEN p.status = 'active' THEN p.slug END AS slug
         FROM order_items oi
         JOIN orders o ON o.id = oi.order_id
         LEFT JOIN products p ON p.id = oi.product_id
         WHERE o.user_id = ? AND ${DELIVERED_SQL}
           AND NOT EXISTS (SELECT 1 FROM reviews r WHERE r.order_item_id = oi.id)
         ORDER BY o.placed_at DESC LIMIT 50`
      )
      .bind(userId, DELIVERED_BIND),
    db
      .prepare(
        `SELECT r.id, r.product_id, r.user_id, u.name AS user_name, r.order_item_id,
                oi.color AS line_label, r.rating, r.title, r.body, r.seller_reply,
                r.helpful_count, r.created_at, r.fit, r.tags, r.incentivized,
                p.name AS product_name, CASE WHEN p.status = 'active' THEN p.slug END AS product_slug,
                COALESCE(oi.image, (SELECT url FROM product_images i WHERE i.product_id = p.id
                  ORDER BY i.is_primary DESC, i.sort_order ASC LIMIT 1), '') AS product_image
         FROM reviews r
         JOIN users u ON u.id = r.user_id
         LEFT JOIN order_items oi ON oi.id = r.order_item_id
         LEFT JOIN products p ON p.id = r.product_id
         WHERE r.user_id = ?
         ORDER BY r.created_at DESC LIMIT 100`
      )
      .bind(userId),
  ]);

  return {
    toReview: (pending.results as unknown as {
      id: string;
      order_number: string;
      product_id: string;
      name: string;
      image: string;
      color: string | null;
      delivered_at: string;
      slug: string | null;
    }[]).map((row) => ({
      orderItemId: row.id,
      orderNumber: row.order_number,
      productId: row.product_id,
      slug: row.slug,
      name: row.name,
      image: row.image,
      label: row.color,
      deliveredAt: row.delivered_at,
    })),
    reviewed: (done.results as unknown as (ReviewRow & {
      product_name: string | null;
      product_slug: string | null;
      product_image: string;
    })[]).map((row) => ({
      ...toReview(row, [], row.line_label),
      productName: row.product_name ?? "Product",
      productSlug: row.product_slug,
      productImage: row.product_image,
    })),
  };
}
