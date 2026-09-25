/** What the Marketing OS is allowed to know about the shop.
 *
 * Every read an agent depends on lives here, for two reasons. The first is
 * ordinary: these are the queries, and queries belong together. The second is
 * the point -- this file is the boundary that decides what leaves the database
 * and reaches a model at all.
 *
 * So there is no `getCustomer()` here, and there will not be one. The
 * specification asks for customer data to be used only where it is
 * operationally appropriate and never exposed unnecessarily, and an advertising
 * planner does not need anyone's name, number or address to do its job. What it
 * needs is aggregate: how many people bought, how often, in which districts.
 * Those are the shapes below, and a personal detail cannot leak through a
 * column that was never selected.
 *
 * Reads run together wherever they do not depend on each other. D1 is in
 * Singapore and each wave of queries is a round trip from Dhaka. */

import { getDB } from "@/lib/db";

/* -------------------------------------------------------------------------- */
/* Products                                                                   */
/* -------------------------------------------------------------------------- */

/** The shortlist the command parser matches an instruction against.
 *
 * Kept small and cheap: an operator typing "promote the classic shirt" needs
 * the model to recognise a name, not to read the catalogue. Stock comes from
 * the variants, because that is where stock lives. */
export interface MarketableProduct {
  id: string;
  name: string;
  slug: string;
  price: number;
  stock: number;
  categoryName: string | null;
  unitsSold90d: number;
}

export async function listMarketableProducts(limit = 60): Promise<MarketableProduct[]> {
  const db = await getDB();
  const { results } = await db
    .prepare(
      `SELECT p.id, p.name, p.slug, p.price,
              COALESCE((SELECT SUM(stock_quantity) FROM product_variants
                        WHERE product_id = p.id), 0) AS stock,
              c.name AS category_name,
              COALESCE((
                SELECT SUM(oi.quantity) FROM order_items oi
                JOIN orders o ON o.id = oi.order_id
                WHERE oi.product_id = p.id
                  AND o.status != 'cancelled'
                  AND o.placed_at >= datetime('now', '-90 days')
              ), 0) AS units_sold
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       WHERE p.status = 'active'
       ORDER BY units_sold DESC, p.name ASC
       LIMIT ?`
    )
    .bind(limit)
    .all<{
      id: string;
      name: string;
      slug: string;
      price: number;
      stock: number;
      category_name: string | null;
      units_sold: number;
    }>();

  return results.map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    price: row.price,
    stock: row.stock,
    categoryName: row.category_name,
    unitsSold90d: row.units_sold,
  }));
}

/** Everything the Research Agent reads about one product.
 *
 * `description`, `attributes` and the review excerpts are seller- and
 * shopper-written, so every one of them is fenced before it reaches a prompt.
 * They are marked here rather than at the call site so the obligation travels
 * with the data. */
export interface ProductBrief {
  id: string;
  name: string;
  slug: string;
  price: number;
  oldPrice: number | null;
  stock: number;
  categoryName: string | null;
  brandName: string | null;
  freeDelivery: boolean;
  /** Untrusted: written by the seller. */
  description: string | null;
  /** Untrusted: written by the seller. */
  attributes: string[];
  /** Untrusted: written by shoppers. */
  reviewExcerpts: string[];
  reviewCount: number;
  averageRating: number | null;
  unitsSold90d: number;
  revenue90d: number;
}

export async function getProductBrief(productId: string): Promise<ProductBrief | null> {
  const db = await getDB();

  const [product, attributes, reviews, sales] = await db.batch<Record<string, unknown>>([
    db
      .prepare(
        `SELECT p.id, p.name, p.slug, p.price, p.old_price, p.description,
                p.free_delivery, c.name AS category_name, b.name AS brand_name,
                COALESCE((SELECT SUM(stock_quantity) FROM product_variants
                          WHERE product_id = p.id), 0) AS stock
         FROM products p
         LEFT JOIN categories c ON c.id = p.category_id
         LEFT JOIN brands b ON b.id = p.brand_id
         WHERE p.id = ?`
      )
      .bind(productId),
    db
      .prepare(
        `SELECT attr_name, attr_value FROM product_attributes
         WHERE product_id = ? ORDER BY sort_order LIMIT 20`
      )
      .bind(productId),
    db
      .prepare(
        `SELECT body, rating FROM reviews
         WHERE product_id = ? AND status = 'approved'
           AND body IS NOT NULL AND TRIM(body) != ''
         ORDER BY created_at DESC LIMIT 12`
      )
      .bind(productId),
    db
      .prepare(
        `SELECT COALESCE(SUM(oi.quantity), 0) AS units,
                COALESCE(SUM(oi.price * oi.quantity), 0) AS revenue
         FROM order_items oi
         JOIN orders o ON o.id = oi.order_id
         WHERE oi.product_id = ? AND o.status != 'cancelled'
           AND o.placed_at >= datetime('now', '-90 days')`
      )
      .bind(productId),
  ]);

  const row = (product.results as unknown as {
        id: string;
        name: string;
        slug: string;
        price: number;
        old_price: number | null;
        description: string | null;
        free_delivery: number;
        category_name: string | null;
        brand_name: string | null;
        stock: number;
      }[])[0];

  if (!row) return null;

  const reviewRows = reviews.results as unknown as { body: string; rating: number }[];
  const salesRow = (sales.results as unknown as { units: number; revenue: number }[])[0];

  const rated = reviewRows.filter((entry) => typeof entry.rating === "number");

  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    price: row.price,
    oldPrice: row.old_price,
    stock: row.stock,
    categoryName: row.category_name,
    brandName: row.brand_name,
    freeDelivery: row.free_delivery === 1,
    description: row.description,
    attributes: (
      attributes.results as unknown as { attr_name: string; attr_value: string }[]
    ).map((entry) => `${entry.attr_name}: ${entry.attr_value}`),
    reviewExcerpts: reviewRows.map((entry) => entry.body).slice(0, 12),
    reviewCount: reviewRows.length,
    averageRating: rated.length
      ? Math.round((rated.reduce((sum, e) => sum + e.rating, 0) / rated.length) * 10) / 10
      : null,
    unitsSold90d: salesRow?.units ?? 0,
    revenue90d: salesRow?.revenue ?? 0,
  };
}

/* -------------------------------------------------------------------------- */
/* What this shop has already learned                                         */
/* -------------------------------------------------------------------------- */

/** Past conclusions, so a new plan can build on them instead of rediscovering
 * the same thing at the same price. Empty on a shop that has not run a
 * campaign yet, which is the honest answer rather than a reason to invent
 * history. */
export interface PriorLesson {
  productName: string | null;
  angle: string | null;
  spend: number;
  purchases: number;
  revenue: number;
  conclusion: string;
  confidence: string;
}

export async function listPriorLessons(
  productId: string | null,
  limit = 12
): Promise<PriorLesson[]> {
  const db = await getDB();
  const { results } = await db
    .prepare(
      `SELECT p.name AS product_name, k.angle, k.spend, k.purchases, k.revenue,
              k.conclusion, k.confidence
       FROM marketing_knowledge k
       LEFT JOIN products p ON p.id = k.product_id
       WHERE k.is_demo = 0 AND (? IS NULL OR k.product_id = ?)
       ORDER BY k.created_at DESC LIMIT ?`
    )
    .bind(productId, productId, limit)
    .all<{
      product_name: string | null;
      angle: string | null;
      spend: number;
      purchases: number;
      revenue: number;
      conclusion: string;
      confidence: string;
    }>();

  return results.map((row) => ({
    productName: row.product_name,
    angle: row.angle,
    spend: row.spend,
    purchases: row.purchases,
    revenue: row.revenue,
    conclusion: row.conclusion,
    confidence: row.confidence,
  }));
}

/* -------------------------------------------------------------------------- */
/* Aggregate shape of the customer base                                       */
/* -------------------------------------------------------------------------- */

/** Who buys, in numbers rather than names.
 *
 * This is the closest the Marketing OS comes to customer data, and it stops
 * here deliberately: counts by district and a repeat-purchase rate are what a
 * targeting hypothesis actually needs, and no row below identifies anybody. */
export interface AudienceShape {
  orders90d: number;
  buyers90d: number;
  repeatRate: number;
  averageOrderValue: number;
  topDistricts: { district: string; orders: number }[];
}

export async function getAudienceShape(): Promise<AudienceShape> {
  const db = await getDB();

  const [totals, districts] = await db.batch<Record<string, unknown>>([
    db.prepare(
      `SELECT COUNT(*) AS orders,
              COUNT(DISTINCT user_id) AS buyers,
              COALESCE(AVG(total), 0) AS aov
       FROM orders
       WHERE status != 'cancelled' AND placed_at >= datetime('now', '-90 days')`
    ),
    db.prepare(
      `SELECT COALESCE(address_district, address_city) AS district, COUNT(*) AS orders
       FROM orders
       WHERE status != 'cancelled' AND placed_at >= datetime('now', '-90 days')
         AND COALESCE(address_district, address_city) != ''
       GROUP BY district ORDER BY orders DESC LIMIT 6`
    ),
  ]);

  const totalRow = (totals.results as unknown as { orders: number; buyers: number; aov: number }[])[0];
  const orders = totalRow?.orders ?? 0;
  const buyers = totalRow?.buyers ?? 0;

  return {
    orders90d: orders,
    buyers90d: buyers,
    // Orders per buyer above one is repeat business. Reported as a rate so a
    // shop with ten orders and a shop with ten thousand read the same way.
    repeatRate: buyers > 0 ? Math.round((orders / buyers - 1) * 100) / 100 : 0,
    averageOrderValue: Math.round(totalRow?.aov ?? 0),
    topDistricts: (districts.results as unknown as { district: string; orders: number }[]).map(
      (row) => ({ district: row.district, orders: row.orders })
    ),
  };
}
