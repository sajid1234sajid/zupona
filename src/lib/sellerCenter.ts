/** The Seller Center's reads: one store's orders, sales, products and reviews.
 *
 * Every function takes the store's id as its first argument and every query
 * filters on it. Callers get that id from `getCurrentSeller()` or
 * `requireApprovedSeller()` -- the session, never a form -- so nothing here
 * can be pointed at another shop's data from the browser.
 *
 * Money comes from suborders, not orders: an order can hold several sellers'
 * goods, and a seller's sales are their share of it. Dates come from the
 * parent order's `placed_at`, which is what the shopper and the admin panel
 * both call the order date. */

import { getDB } from "@/lib/db";
import { RANGES, type RangeKey } from "@/lib/adminData";
import { FULFILMENT_RANK } from "@/lib/orderStock";

export const SELLER_PAGE_SIZE = 15;

/** Percent change between two periods. Null when the earlier period was empty,
 * because "up 100%" measured from zero says nothing useful. */
function delta(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return Math.round(((current - previous) / previous) * 100);
}

function daysIn(range: RangeKey): number {
  const parsed = Math.abs(Number(RANGES[range].split(" ")[0]));
  return Number.isFinite(parsed) ? Math.min(parsed, 365) : 7;
}

function first<T>(result: D1Result<Record<string, unknown>>): T | undefined {
  return (result.results as unknown as T[])[0];
}

/* -------------------------------------------------------------------------- */
/* Dashboard                                                                  */
/* -------------------------------------------------------------------------- */

export interface SellerAttention {
  toConfirm: number;
  toShip: number;
  lowStock: number;
  outOfStock: number;
  pendingReview: number;
  rejected: number;
  unrepliedReviews: number;
}

/** The "needs you" list: everything waiting on the seller, in one round trip. */
export async function getSellerAttention(sellerId: string): Promise<SellerAttention> {
  const db = await getDB();
  const [orders, products, reviews] = await db.batch<Record<string, unknown>>([
    db
      .prepare(
        `SELECT COUNT(CASE WHEN status = 'placed' THEN 1 END) AS to_confirm,
                COUNT(CASE WHEN status = 'confirmed' THEN 1 END) AS to_ship
         FROM suborders WHERE seller_id = ? AND status IN ('placed', 'confirmed')`
      )
      .bind(sellerId),
    db
      .prepare(
        `SELECT COUNT(CASE WHEN status = 'pending_review' THEN 1 END) AS pending_review,
                COUNT(CASE WHEN status = 'rejected' THEN 1 END) AS rejected,
                -- Only products that count their units can run out.
                COUNT(CASE WHEN status = 'active' AND tracked = 1 AND qty <= 0 THEN 1 END) AS out_of_stock,
                COUNT(CASE WHEN status = 'active' AND tracked = 1 AND qty > 0 AND qty <= threshold
                           THEN 1 END) AS low_stock
         FROM (
           SELECT p.status, p.track_inventory AS tracked,
                  (SELECT COALESCE(SUM(v.stock_quantity), 0) FROM product_variants v
                    WHERE v.product_id = p.id AND v.is_active = 1) AS qty,
                  (SELECT COALESCE(MIN(v.low_stock_threshold), 5) FROM product_variants v
                    WHERE v.product_id = p.id AND v.is_active = 1) AS threshold
           FROM products p WHERE p.seller_id = ? AND p.status != 'archived'
         )`
      )
      .bind(sellerId),
    db
      .prepare(
        `SELECT COUNT(*) AS n FROM reviews r JOIN products p ON p.id = r.product_id
         WHERE p.seller_id = ? AND r.is_approved = 1 AND r.seller_reply IS NULL`
      )
      .bind(sellerId),
  ]);

  const o = first<{ to_confirm: number; to_ship: number }>(orders);
  const p = first<{ pending_review: number; rejected: number; out_of_stock: number; low_stock: number }>(
    products
  );

  return {
    toConfirm: o?.to_confirm ?? 0,
    toShip: o?.to_ship ?? 0,
    lowStock: p?.low_stock ?? 0,
    outOfStock: p?.out_of_stock ?? 0,
    pendingReview: p?.pending_review ?? 0,
    rejected: p?.rejected ?? 0,
    unrepliedReviews: first<{ n: number }>(reviews)?.n ?? 0,
  };
}

/* -------------------------------------------------------------------------- */
/* Sales                                                                      */
/* -------------------------------------------------------------------------- */

export interface TrendStat {
  value: number;
  change: number | null;
}

export interface SellerSummary {
  revenue: TrendStat;
  net: TrendStat;
  orders: TrendStat;
  units: TrendStat;
  averageOrder: TrendStat;
  /** Share of this window's orders that were cancelled, 0-100. */
  cancelRate: number;
}

/** Headline figures for a window, each against the window just before it. */
export async function getSellerSummary(sellerId: string, range: RangeKey): Promise<SellerSummary> {
  const db = await getDB();
  const window = RANGES[range];
  // "All time" has no window before it to compare with; using its own bound
  // makes every prior-period figure zero, which reads as "no comparison".
  const prior = range === "all" ? window : `-${daysIn(range) * 2} days`;

  const [shares, units] = await db.batch<Record<string, unknown>>([
    db
      .prepare(
        `SELECT
           COUNT(CASE WHEN o.placed_at >= datetime('now', ?) AND so.status != 'cancelled' THEN 1 END) AS cur_orders,
           COUNT(CASE WHEN o.placed_at >= datetime('now', ?) AND o.placed_at < datetime('now', ?)
                       AND so.status != 'cancelled' THEN 1 END) AS pri_orders,
           COUNT(CASE WHEN o.placed_at >= datetime('now', ?) AND so.status = 'cancelled' THEN 1 END) AS cur_cancelled,
           COALESCE(SUM(CASE WHEN o.placed_at >= datetime('now', ?) AND so.status != 'cancelled'
                             THEN so.subtotal END), 0) AS cur_revenue,
           COALESCE(SUM(CASE WHEN o.placed_at >= datetime('now', ?) AND o.placed_at < datetime('now', ?)
                              AND so.status != 'cancelled' THEN so.subtotal END), 0) AS pri_revenue,
           COALESCE(SUM(CASE WHEN o.placed_at >= datetime('now', ?) AND so.status != 'cancelled'
                             THEN so.subtotal - so.commission_amount END), 0) AS cur_net,
           COALESCE(SUM(CASE WHEN o.placed_at >= datetime('now', ?) AND o.placed_at < datetime('now', ?)
                              AND so.status != 'cancelled'
                             THEN so.subtotal - so.commission_amount END), 0) AS pri_net
         FROM suborders so JOIN orders o ON o.id = so.order_id
         WHERE so.seller_id = ? AND o.placed_at >= datetime('now', ?)`
      )
      .bind(window, prior, window, window, window, prior, window, window, prior, window, sellerId, prior),
    db
      .prepare(
        `SELECT
           COALESCE(SUM(CASE WHEN o.placed_at >= datetime('now', ?) THEN oi.quantity END), 0) AS cur_units,
           COALESCE(SUM(CASE WHEN o.placed_at < datetime('now', ?) THEN oi.quantity END), 0) AS pri_units
         FROM order_items oi
         JOIN suborders so ON so.id = oi.suborder_id
         JOIN orders o ON o.id = so.order_id
         WHERE so.seller_id = ? AND so.status != 'cancelled' AND o.placed_at >= datetime('now', ?)`
      )
      .bind(window, window, sellerId, prior),
  ]);

  const s = first<{
    cur_orders: number;
    pri_orders: number;
    cur_cancelled: number;
    cur_revenue: number;
    pri_revenue: number;
    cur_net: number;
    pri_net: number;
  }>(shares);
  const u = first<{ cur_units: number; pri_units: number }>(units);

  const curOrders = s?.cur_orders ?? 0;
  const priOrders = s?.pri_orders ?? 0;
  const curRevenue = s?.cur_revenue ?? 0;
  const priRevenue = s?.pri_revenue ?? 0;
  const curAov = curOrders ? Math.round(curRevenue / curOrders) : 0;
  const priAov = priOrders ? Math.round(priRevenue / priOrders) : 0;
  const placed = curOrders + (s?.cur_cancelled ?? 0);

  return {
    revenue: { value: curRevenue, change: delta(curRevenue, priRevenue) },
    net: { value: s?.cur_net ?? 0, change: delta(s?.cur_net ?? 0, s?.pri_net ?? 0) },
    orders: { value: curOrders, change: delta(curOrders, priOrders) },
    units: { value: u?.cur_units ?? 0, change: delta(u?.cur_units ?? 0, u?.pri_units ?? 0) },
    averageOrder: { value: curAov, change: delta(curAov, priAov) },
    cancelRate: placed ? Math.round(((s?.cur_cancelled ?? 0) / placed) * 100) : 0,
  };
}

export interface SalesPoint {
  day: string;
  orders: number;
  revenue: number;
}

/** Daily sales with empty days filled in, so the chart's x-axis stays evenly
 * spaced instead of silently skipping days without orders. */
export async function getSellerSalesSeries(sellerId: string, range: RangeKey): Promise<SalesPoint[]> {
  const db = await getDB();
  const days = Math.min(daysIn(range), 90);

  const { results } = await db
    .prepare(
      `SELECT DATE(o.placed_at) AS day, COUNT(*) AS orders, COALESCE(SUM(so.subtotal), 0) AS revenue
       FROM suborders so JOIN orders o ON o.id = so.order_id
       WHERE so.seller_id = ? AND so.status != 'cancelled' AND o.placed_at >= datetime('now', ?)
       GROUP BY day ORDER BY day ASC`
    )
    .bind(sellerId, `-${days} days`)
    .all<{ day: string; orders: number; revenue: number }>();

  const found = new Map(results.map((row) => [row.day, row]));
  const series: SalesPoint[] = [];
  const today = new Date();

  for (let i = days - 1; i >= 0; i -= 1) {
    const date = new Date(today);
    date.setUTCDate(date.getUTCDate() - i);
    const day = date.toISOString().slice(0, 10);
    const hit = found.get(day);
    series.push({ day, orders: hit?.orders ?? 0, revenue: hit?.revenue ?? 0 });
  }

  return series;
}

export interface TopProduct {
  productId: string;
  name: string;
  image: string | null;
  units: number;
  revenue: number;
}

export async function getSellerTopProducts(
  sellerId: string,
  range: RangeKey,
  limit = 5
): Promise<TopProduct[]> {
  const db = await getDB();
  const { results } = await db
    .prepare(
      `SELECT oi.product_id, MAX(oi.name) AS name, MAX(oi.image) AS image,
              SUM(oi.quantity) AS units, SUM(oi.price * oi.quantity) AS revenue
       FROM order_items oi
       JOIN suborders so ON so.id = oi.suborder_id
       JOIN orders o ON o.id = so.order_id
       WHERE so.seller_id = ? AND so.status != 'cancelled' AND o.placed_at >= datetime('now', ?)
       GROUP BY oi.product_id
       ORDER BY revenue DESC LIMIT ?`
    )
    .bind(sellerId, RANGES[range], limit)
    .all<{ product_id: string; name: string; image: string | null; units: number; revenue: number }>();

  return results.map((row) => ({
    productId: row.product_id,
    name: row.name,
    image: row.image,
    units: row.units,
    revenue: row.revenue,
  }));
}

/** Where this store's customers are, by district (division for older orders
 * that predate the district column). */
export async function getSellerSalesByArea(
  sellerId: string,
  range: RangeKey,
  limit = 8
): Promise<{ area: string; orders: number; revenue: number }[]> {
  const db = await getDB();
  const { results } = await db
    .prepare(
      `SELECT COALESCE(NULLIF(o.address_district, ''), NULLIF(o.address_city, ''), 'Unknown') AS area,
              COUNT(*) AS orders, COALESCE(SUM(so.subtotal), 0) AS revenue
       FROM suborders so JOIN orders o ON o.id = so.order_id
       WHERE so.seller_id = ? AND so.status != 'cancelled' AND o.placed_at >= datetime('now', ?)
       GROUP BY area ORDER BY revenue DESC LIMIT ?`
    )
    .bind(sellerId, RANGES[range], limit)
    .all<{ area: string; orders: number; revenue: number }>();
  return results;
}

export async function getSellerStatusMix(
  sellerId: string,
  range: RangeKey
): Promise<{ status: string; count: number }[]> {
  const db = await getDB();
  const { results } = await db
    .prepare(
      `SELECT so.status, COUNT(*) AS n
       FROM suborders so JOIN orders o ON o.id = so.order_id
       WHERE so.seller_id = ? AND o.placed_at >= datetime('now', ?)
       GROUP BY so.status`
    )
    .bind(sellerId, RANGES[range])
    .all<{ status: string; n: number }>();
  return results.map((row) => ({ status: row.status, count: row.n }));
}

export interface ProductPerformance {
  id: string;
  name: string;
  image: string | null;
  status: string;
  price: number;
  views: number;
  unitsSold: number;
  revenue: number;
  rating: number;
  ratingCount: number;
  /** Units sold per hundred product-page views, 0 when never viewed. */
  conversion: number;
}

/** Every live-ish product with what shoppers did with it, all time. Views come
 * from the product page's own counter, so they are lifetime figures; the
 * revenue beside them is counted the same way to keep the ratio honest. */
export async function getSellerProductPerformance(
  sellerId: string,
  limit = 50
): Promise<ProductPerformance[]> {
  const db = await getDB();
  const { results } = await db
    .prepare(
      `SELECT p.id, p.name, p.status, p.price, p.view_count, p.rating_avg, p.rating_count,
              (SELECT url FROM product_images i WHERE i.product_id = p.id
                ORDER BY i.is_primary DESC, i.sort_order ASC LIMIT 1) AS image,
              COALESCE(sales.units, 0) AS units, COALESCE(sales.revenue, 0) AS revenue
       FROM products p
       LEFT JOIN (
         SELECT oi.product_id, SUM(oi.quantity) AS units, SUM(oi.price * oi.quantity) AS revenue
         FROM order_items oi JOIN suborders so ON so.id = oi.suborder_id
         WHERE so.seller_id = ? AND so.status != 'cancelled'
         GROUP BY oi.product_id
       ) sales ON sales.product_id = p.id
       WHERE p.seller_id = ? AND p.status != 'archived'
       ORDER BY revenue DESC, p.view_count DESC LIMIT ?`
    )
    .bind(sellerId, sellerId, limit)
    .all<{
      id: string;
      name: string;
      status: string;
      price: number;
      view_count: number;
      rating_avg: number;
      rating_count: number;
      image: string | null;
      units: number;
      revenue: number;
    }>();

  return results.map((row) => ({
    id: row.id,
    name: row.name,
    image: row.image,
    status: row.status,
    price: row.price,
    views: row.view_count,
    unitsSold: row.units,
    revenue: row.revenue,
    rating: row.rating_avg,
    ratingCount: row.rating_count,
    conversion: row.view_count > 0 ? Math.round((row.units / row.view_count) * 1000) / 10 : 0,
  }));
}

/* -------------------------------------------------------------------------- */
/* Orders                                                                     */
/* -------------------------------------------------------------------------- */

export const SELLER_ORDER_TABS = {
  all: { label: "All", statuses: null },
  to_process: { label: "To process", statuses: ["placed", "confirmed"] },
  shipping: { label: "Shipping", statuses: ["shipped", "out_for_delivery"] },
  delivered: { label: "Delivered", statuses: ["delivered"] },
  cancelled: { label: "Cancelled", statuses: ["cancelled", "returned"] },
} as const;

export type SellerOrderTab = keyof typeof SELLER_ORDER_TABS;

export function asOrderTab(value: string | undefined): SellerOrderTab {
  return value && value in SELLER_ORDER_TABS ? (value as SellerOrderTab) : "all";
}

export interface SellerOrderRow {
  suborderId: string;
  orderId: string;
  orderNumber: string;
  placedAt: string;
  status: string;
  customerName: string;
  area: string | null;
  paymentLabel: string;
  paymentStatus: string;
  subtotal: number;
  net: number;
  units: number;
  lineCount: number;
  firstItem: string | null;
  image: string | null;
}

function orderFilter(
  sellerId: string,
  options: { tab?: SellerOrderTab; search?: string }
): { where: string; binds: unknown[] } {
  const clauses = ["so.seller_id = ?"];
  const binds: unknown[] = [sellerId];

  const statuses = SELLER_ORDER_TABS[options.tab ?? "all"].statuses;
  if (statuses) {
    clauses.push(`so.status IN (${statuses.map(() => "?").join(",")})`);
    binds.push(...statuses);
  }
  if (options.search?.trim()) {
    clauses.push("(o.order_number LIKE ? OR o.address_full_name LIKE ? OR o.address_phone LIKE ?)");
    const term = `%${options.search.trim()}%`;
    binds.push(term, term, term);
  }
  return { where: `WHERE ${clauses.join(" AND ")}`, binds };
}

export async function listSellerOrders(
  sellerId: string,
  options: { tab?: SellerOrderTab; search?: string; page?: number; pageSize?: number } = {}
): Promise<{ rows: SellerOrderRow[]; total: number }> {
  const db = await getDB();
  const { where, binds } = orderFilter(sellerId, options);
  const pageSize = options.pageSize ?? SELLER_PAGE_SIZE;
  const offset = Math.max(0, (options.page ?? 1) - 1) * pageSize;

  const [rows, count] = await db.batch<Record<string, unknown>>([
    db
      .prepare(
        `SELECT so.id, so.order_id, so.status, so.subtotal, so.commission_amount,
                o.order_number, o.placed_at, o.address_full_name, o.address_district, o.address_city,
                o.payment_label, o.payment_status,
                (SELECT COUNT(*) FROM order_items oi WHERE oi.suborder_id = so.id) AS line_count,
                (SELECT COALESCE(SUM(oi.quantity), 0) FROM order_items oi WHERE oi.suborder_id = so.id) AS units,
                (SELECT oi.name FROM order_items oi WHERE oi.suborder_id = so.id LIMIT 1) AS first_item,
                (SELECT oi.image FROM order_items oi WHERE oi.suborder_id = so.id LIMIT 1) AS image
         FROM suborders so JOIN orders o ON o.id = so.order_id
         ${where}
         ORDER BY o.placed_at DESC LIMIT ? OFFSET ?`
      )
      .bind(...binds, pageSize, offset),
    db
      .prepare(`SELECT COUNT(*) AS n FROM suborders so JOIN orders o ON o.id = so.order_id ${where}`)
      .bind(...binds),
  ]);

  return {
    rows: (rows.results as unknown as {
      id: string;
      order_id: string;
      status: string;
      subtotal: number;
      commission_amount: number;
      order_number: string;
      placed_at: string;
      address_full_name: string;
      address_district: string | null;
      address_city: string | null;
      payment_label: string;
      payment_status: string;
      line_count: number;
      units: number;
      first_item: string | null;
      image: string | null;
    }[]).map((row) => ({
      suborderId: row.id,
      orderId: row.order_id,
      orderNumber: row.order_number,
      placedAt: row.placed_at,
      status: row.status,
      customerName: row.address_full_name,
      area: row.address_district || row.address_city || null,
      paymentLabel: row.payment_label,
      paymentStatus: row.payment_status,
      subtotal: row.subtotal,
      net: row.subtotal - row.commission_amount,
      units: row.units,
      lineCount: row.line_count,
      firstItem: row.first_item,
      image: row.image,
    })),
    total: first<{ n: number }>(count)?.n ?? 0,
  };
}

export async function getSellerOrderCounts(sellerId: string): Promise<Record<SellerOrderTab, number>> {
  const db = await getDB();
  const { results } = await db
    .prepare("SELECT status, COUNT(*) AS n FROM suborders WHERE seller_id = ? GROUP BY status")
    .bind(sellerId)
    .all<{ status: string; n: number }>();

  const counts = { all: 0, to_process: 0, shipping: 0, delivered: 0, cancelled: 0 };
  for (const row of results) {
    counts.all += row.n;
    for (const [tab, def] of Object.entries(SELLER_ORDER_TABS)) {
      if (def.statuses && (def.statuses as readonly string[]).includes(row.status)) {
        counts[tab as SellerOrderTab] += row.n;
      }
    }
  }
  return counts;
}

export interface SellerOrderLine {
  id: string;
  productId: string;
  name: string;
  image: string;
  option: string | null;
  price: number;
  oldPrice: number;
  quantity: number;
}

export interface SellerOrderDetail {
  suborderId: string;
  orderId: string;
  orderNumber: string;
  placedAt: string;
  status: string;
  orderStatus: string;
  subtotal: number;
  commission: number;
  net: number;
  courier: string | null;
  tracking: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  /** True when this store is the only seller in the order, which is what
   * lets the seller move the whole order rather than only their share. */
  soleSeller: boolean;
  customer: {
    name: string;
    phone: string;
    line: string;
    area: string | null;
    district: string | null;
    city: string;
  };
  paymentLabel: string;
  paymentStatus: string;
  deliveryMethod: string;
  lines: SellerOrderLine[];
  history: { status: string; note: string | null; createdAt: string }[];
}

/** One of this store's order shares, by order number or order id. */
export async function getSellerOrder(
  sellerId: string,
  key: string
): Promise<SellerOrderDetail | null> {
  const db = await getDB();
  const row = await db
    .prepare(
      `SELECT so.id, so.order_id, so.status, so.subtotal, so.commission_amount, so.courier_name,
              so.tracking_number, so.shipped_at, so.delivered_at,
              o.order_number, o.placed_at, o.status AS order_status, o.address_full_name,
              o.address_phone, o.address_line, o.address_area, o.address_district, o.address_city,
              o.payment_label, o.payment_status, o.delivery_method,
              (SELECT COUNT(*) FROM suborders x WHERE x.order_id = so.order_id) AS share_count
       FROM suborders so JOIN orders o ON o.id = so.order_id
       WHERE so.seller_id = ? AND (o.order_number = ? OR o.id = ?)
       LIMIT 1`
    )
    .bind(sellerId, key, key)
    .first<{
      id: string;
      order_id: string;
      status: string;
      subtotal: number;
      commission_amount: number;
      courier_name: string | null;
      tracking_number: string | null;
      shipped_at: string | null;
      delivered_at: string | null;
      order_number: string;
      placed_at: string;
      order_status: string;
      address_full_name: string;
      address_phone: string;
      address_line: string;
      address_area: string | null;
      address_district: string | null;
      address_city: string;
      payment_label: string;
      payment_status: string;
      delivery_method: string;
      share_count: number;
    }>();

  if (!row) return null;

  const [lines, history] = await db.batch<Record<string, unknown>>([
    db
      .prepare(
        `SELECT id, product_id, name, image, color, price, old_price, quantity
         FROM order_items WHERE suborder_id = ? ORDER BY rowid ASC`
      )
      .bind(row.id),
    // The order-wide trail plus anything written against this share. Another
    // seller's share-level entries are theirs and stay out of this screen.
    db
      .prepare(
        `SELECT status, note, created_at FROM order_status_history
         WHERE order_id = ? AND (suborder_id IS NULL OR suborder_id = ?)
         ORDER BY created_at ASC`
      )
      .bind(row.order_id, row.id),
  ]);

  return {
    suborderId: row.id,
    orderId: row.order_id,
    orderNumber: row.order_number,
    placedAt: row.placed_at,
    status: row.status,
    orderStatus: row.order_status,
    subtotal: row.subtotal,
    commission: row.commission_amount,
    net: row.subtotal - row.commission_amount,
    courier: row.courier_name,
    tracking: row.tracking_number,
    shippedAt: row.shipped_at,
    deliveredAt: row.delivered_at,
    soleSeller: row.share_count <= 1,
    customer: {
      name: row.address_full_name,
      phone: row.address_phone,
      line: row.address_line,
      area: row.address_area,
      district: row.address_district,
      city: row.address_city,
    },
    paymentLabel: row.payment_label,
    paymentStatus: row.payment_status,
    deliveryMethod: row.delivery_method,
    lines: (lines.results as unknown as {
      id: string;
      product_id: string;
      name: string;
      image: string;
      color: string | null;
      price: number;
      old_price: number;
      quantity: number;
    }[]).map((line) => ({
      id: line.id,
      productId: line.product_id,
      name: line.name,
      image: line.image,
      option: line.color,
      price: line.price,
      oldPrice: line.old_price,
      quantity: line.quantity,
    })),
    history: (history.results as unknown as { status: string; note: string | null; created_at: string }[]).map(
      (entry) => ({ status: entry.status, note: entry.note, createdAt: entry.created_at })
    ),
  };
}

/** The next steps a seller may take on a share in `status`, in order.
 *
 * Forward only: an order that has shipped cannot be un-shipped from here, the
 * same way a courier cannot un-collect a parcel. Cancelling is offered only
 * before dispatch and only when this store is the order's sole seller --
 * cancelling one seller's half of a joint order changes what the customer
 * pays, and that is a conversation for Zupona's support, not a button. */
export function nextSellerSteps(status: string, soleSeller: boolean): string[] {
  const rank = FULFILMENT_RANK[status];
  if (rank === undefined) return [];

  const forward = ["confirmed", "shipped", "out_for_delivery", "delivered"].filter(
    (step) => FULFILMENT_RANK[step] > rank
  );
  const canCancel = soleSeller && rank <= FULFILMENT_RANK.confirmed;
  return canCancel ? [...forward, "cancelled"] : forward;
}

/* -------------------------------------------------------------------------- */
/* Reviews                                                                    */
/* -------------------------------------------------------------------------- */

export type ReviewFilter = "all" | "unreplied" | "low";

export interface SellerReviewRow {
  id: string;
  productId: string;
  productName: string;
  productImage: string | null;
  customerName: string;
  rating: number;
  title: string | null;
  body: string | null;
  reply: string | null;
  repliedAt: string | null;
  verified: boolean;
  createdAt: string;
}

export async function listSellerReviews(
  sellerId: string,
  options: { filter?: ReviewFilter; page?: number } = {}
): Promise<{ rows: SellerReviewRow[]; total: number }> {
  const db = await getDB();
  const clauses = ["p.seller_id = ?", "r.is_approved = 1"];
  if (options.filter === "unreplied") clauses.push("r.seller_reply IS NULL");
  if (options.filter === "low") clauses.push("r.rating <= 3");
  const where = `WHERE ${clauses.join(" AND ")}`;
  const offset = Math.max(0, (options.page ?? 1) - 1) * SELLER_PAGE_SIZE;

  const [rows, count] = await db.batch<Record<string, unknown>>([
    db
      .prepare(
        `SELECT r.id, r.product_id, r.rating, r.title, r.body, r.seller_reply, r.seller_replied_at,
                r.order_item_id, r.created_at, p.name AS product_name, u.name AS customer_name,
                (SELECT url FROM product_images i WHERE i.product_id = p.id
                  ORDER BY i.is_primary DESC, i.sort_order ASC LIMIT 1) AS product_image
         FROM reviews r
         JOIN products p ON p.id = r.product_id
         JOIN users u ON u.id = r.user_id
         ${where}
         ORDER BY r.created_at DESC LIMIT ? OFFSET ?`
      )
      .bind(sellerId, SELLER_PAGE_SIZE, offset),
    db
      .prepare(`SELECT COUNT(*) AS n FROM reviews r JOIN products p ON p.id = r.product_id ${where}`)
      .bind(sellerId),
  ]);

  return {
    rows: (rows.results as unknown as {
      id: string;
      product_id: string;
      rating: number;
      title: string | null;
      body: string | null;
      seller_reply: string | null;
      seller_replied_at: string | null;
      order_item_id: string | null;
      created_at: string;
      product_name: string;
      customer_name: string;
      product_image: string | null;
    }[]).map((row) => ({
      id: row.id,
      productId: row.product_id,
      productName: row.product_name,
      productImage: row.product_image,
      // First name only. The seller is answering a review, not building a
      // customer list, and the storefront shows no more than this either.
      customerName: row.customer_name.split(" ")[0] || "Customer",
      rating: row.rating,
      title: row.title,
      body: row.body,
      reply: row.seller_reply,
      repliedAt: row.seller_replied_at,
      verified: row.order_item_id !== null,
      createdAt: row.created_at,
    })),
    total: first<{ n: number }>(count)?.n ?? 0,
  };
}

export interface SellerReviewStats {
  total: number;
  average: number;
  unreplied: number;
  counts: Record<1 | 2 | 3 | 4 | 5, number>;
}

export async function getSellerReviewStats(sellerId: string): Promise<SellerReviewStats> {
  const db = await getDB();
  const { results } = await db
    .prepare(
      `SELECT r.rating, COUNT(*) AS n,
              COUNT(CASE WHEN r.seller_reply IS NULL THEN 1 END) AS unreplied
       FROM reviews r JOIN products p ON p.id = r.product_id
       WHERE p.seller_id = ? AND r.is_approved = 1
       GROUP BY r.rating`
    )
    .bind(sellerId)
    .all<{ rating: number; n: number; unreplied: number }>();

  const counts: Record<1 | 2 | 3 | 4 | 5, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let total = 0;
  let sum = 0;
  let unreplied = 0;
  for (const row of results) {
    const star = Math.min(5, Math.max(1, Math.round(row.rating))) as 1 | 2 | 3 | 4 | 5;
    counts[star] += row.n;
    total += row.n;
    sum += row.rating * row.n;
    unreplied += row.unreplied;
  }

  return { total, average: total ? Math.round((sum / total) * 10) / 10 : 0, unreplied, counts };
}

/* -------------------------------------------------------------------------- */
/* Products                                                                   */
/* -------------------------------------------------------------------------- */

export interface SellerProductCounts {
  all: number;
  active: number;
  pending_review: number;
  draft: number;
  rejected: number;
  archived: number;
  low: number;
  out: number;
}

/** The numbers on the product list's tabs, in one round trip. */
export async function getSellerProductCounts(sellerId: string): Promise<SellerProductCounts> {
  const db = await getDB();
  const row = await db
    .prepare(
      `SELECT
         COUNT(CASE WHEN status != 'archived' THEN 1 END) AS all_live,
         COUNT(CASE WHEN status = 'active' THEN 1 END) AS active,
         COUNT(CASE WHEN status = 'pending_review' THEN 1 END) AS pending_review,
         COUNT(CASE WHEN status = 'draft' THEN 1 END) AS draft,
         COUNT(CASE WHEN status = 'rejected' THEN 1 END) AS rejected,
         COUNT(CASE WHEN status = 'archived' THEN 1 END) AS archived,
         COUNT(CASE WHEN status != 'archived' AND tracked = 1 AND qty <= 0 THEN 1 END) AS out_of_stock,
         COUNT(CASE WHEN status != 'archived' AND tracked = 1 AND qty > 0 AND qty <= threshold
                    THEN 1 END) AS low_stock
       FROM (
         SELECT p.status, p.track_inventory AS tracked,
                (SELECT COALESCE(SUM(v.stock_quantity), 0) FROM product_variants v
                  WHERE v.product_id = p.id AND v.is_active = 1) AS qty,
                (SELECT COALESCE(MIN(v.low_stock_threshold), 5) FROM product_variants v
                  WHERE v.product_id = p.id AND v.is_active = 1) AS threshold
         FROM products p WHERE p.seller_id = ?
       )`
    )
    .bind(sellerId)
    .first<{
      all_live: number;
      active: number;
      pending_review: number;
      draft: number;
      rejected: number;
      archived: number;
      out_of_stock: number;
      low_stock: number;
    }>();

  return {
    all: row?.all_live ?? 0,
    active: row?.active ?? 0,
    pending_review: row?.pending_review ?? 0,
    draft: row?.draft ?? 0,
    rejected: row?.rejected ?? 0,
    archived: row?.archived ?? 0,
    low: row?.low_stock ?? 0,
    out: row?.out_of_stock ?? 0,
  };
}
