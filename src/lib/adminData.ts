/** Read queries behind the admin panel's list, detail and dashboard screens.
 *
 * `src/lib/admin.ts` stays what it was -- guards, the audit trail, settings and
 * the headline figures. This module is the reporting layer on top: the joined,
 * filtered, paginated reads that only the back office needs, kept out of the
 * storefront's hot paths.
 *
 * Every list here follows the same shape: a `*Filter` describing the screen's
 * toolbar, and a `Page<T>` result carrying both the rows and the unpaginated
 * total, so a table and its pager can never disagree about how many pages
 * exist. */

import { getDB } from "@/lib/db";

/* -------------------------------------------------------------------------- */
/* Shared                                                                     */
/* -------------------------------------------------------------------------- */

export interface Page<T> {
  rows: T[];
  total: number;
}

export const PAGE_SIZE = 10;

/** Windows offered by the toolbars, as the SQLite date modifier each maps to. */
export const RANGES = {
  "7d": "-7 days",
  "30d": "-30 days",
  "90d": "-90 days",
  all: "-100 years",
} as const;

export type RangeKey = keyof typeof RANGES;

export function asRange(value: string | undefined, fallback: RangeKey = "7d"): RangeKey {
  return value && value in RANGES ? (value as RangeKey) : fallback;
}

/** Percent change between two periods. Null when the earlier period was empty,
 * because "up 100%" measured from zero says nothing useful. */
function delta(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return Math.round(((current - previous) / previous) * 100);
}

/** Number of days a range covers, used to size chart axes and to derive the
 * preceding comparison window. */
function daysIn(range: RangeKey): number {
  const parsed = Math.abs(Number(RANGES[range].split(" ")[0]));
  return Number.isFinite(parsed) ? Math.min(parsed, 365) : 7;
}

/* -------------------------------------------------------------------------- */
/* Dashboard                                                                  */
/* -------------------------------------------------------------------------- */

export interface TrendStat {
  value: number;
  /** Percent change against the immediately preceding window of equal length. */
  change: number | null;
}

export interface DashboardSummary {
  orders: TrendStat;
  revenue: TrendStat;
  products: TrendStat;
  customers: TrendStat;
}

/** The four headline tiles. Each is measured over the selected window and
 * against the window immediately before it, which is what the "vs last 7 days"
 * caption underneath refers to. */
export async function getDashboardSummary(range: RangeKey = "7d"): Promise<DashboardSummary> {
  const db = await getDB();
  const window = RANGES[range];
  // Doubling the window gives the preceding period of equal length, so one
  // scan produces both halves of every comparison.
  const prior = `-${daysIn(range) * 2} days`;

  const [orders, products, customers] = await db.batch<Record<string, number>>([
    db
      .prepare(
        `SELECT
           COUNT(CASE WHEN placed_at >= datetime('now', ?) THEN 1 END) AS current_orders,
           COUNT(CASE WHEN placed_at >= datetime('now', ?)
                       AND placed_at < datetime('now', ?) THEN 1 END) AS prior_orders,
           COALESCE(SUM(CASE WHEN placed_at >= datetime('now', ?) THEN total END), 0)
             AS current_revenue,
           COALESCE(SUM(CASE WHEN placed_at >= datetime('now', ?)
                              AND placed_at < datetime('now', ?) THEN total END), 0)
             AS prior_revenue
         FROM orders WHERE status != 'cancelled'`
      )
      .bind(window, prior, window, window, prior, window),
    db
      .prepare(
        `SELECT COUNT(*) AS total,
                COUNT(CASE WHEN created_at >= datetime('now', ?) THEN 1 END) AS current,
                COUNT(CASE WHEN created_at >= datetime('now', ?)
                            AND created_at < datetime('now', ?) THEN 1 END) AS prior
         FROM products WHERE status != 'archived'`
      )
      .bind(window, prior, window),
    db
      .prepare(
        `SELECT COUNT(*) AS total,
                COUNT(CASE WHEN created_at >= datetime('now', ?) THEN 1 END) AS current,
                COUNT(CASE WHEN created_at >= datetime('now', ?)
                            AND created_at < datetime('now', ?) THEN 1 END) AS prior
         FROM users WHERE role = 'customer'`
      )
      .bind(window, prior, window),
  ]);

  const o = (orders.results as unknown as {
    current_orders: number;
    prior_orders: number;
    current_revenue: number;
    prior_revenue: number;
  }[])[0];
  const p = (products.results as unknown as { total: number; current: number; prior: number }[])[0];
  const c = (customers.results as unknown as { total: number; current: number; prior: number }[])[0];

  return {
    orders: {
      value: o?.current_orders ?? 0,
      change: delta(o?.current_orders ?? 0, o?.prior_orders ?? 0),
    },
    revenue: {
      value: o?.current_revenue ?? 0,
      change: delta(o?.current_revenue ?? 0, o?.prior_revenue ?? 0),
    },
    products: { value: p?.total ?? 0, change: delta(p?.current ?? 0, p?.prior ?? 0) },
    customers: { value: c?.total ?? 0, change: delta(c?.current ?? 0, c?.prior ?? 0) },
  };
}

export interface StatusSlice {
  status: string;
  count: number;
}

/** Order status mix for the dashboard donut. */
export async function getOrderStatusBreakdown(range: RangeKey = "7d"): Promise<StatusSlice[]> {
  const db = await getDB();
  const { results } = await db
    .prepare(
      `SELECT status, COUNT(*) AS n FROM orders
       WHERE placed_at >= datetime('now', ?)
       GROUP BY status`
    )
    .bind(RANGES[range])
    .all<{ status: string; n: number }>();
  return results.map((row) => ({ status: row.status, count: row.n }));
}

export interface SalesPoint {
  day: string;
  orders: number;
  revenue: number;
}

/** Daily revenue with empty days filled in, so the chart's x-axis stays evenly
 * spaced instead of silently skipping days that had no orders. */
export async function getSalesSeries(range: RangeKey = "7d"): Promise<SalesPoint[]> {
  const db = await getDB();
  const days = daysIn(range) > 90 ? 90 : daysIn(range);

  const { results } = await db
    .prepare(
      `SELECT DATE(placed_at) AS day, COUNT(*) AS orders, COALESCE(SUM(total), 0) AS revenue
       FROM orders
       WHERE status != 'cancelled' AND placed_at >= datetime('now', ?)
       GROUP BY day ORDER BY day ASC`
    )
    .bind(`-${days} days`)
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

export interface ActivityEntry {
  id: string;
  kind: "order" | "product" | "customer" | "review";
  title: string;
  detail: string;
  at: string;
}

/** The "Recent Activity" rail: the newest rows across the tables that matter,
 * merged into one time-ordered feed. Each source is capped before the merge so
 * one busy table cannot crowd the others out. */
export async function getRecentActivity(limit = 8): Promise<ActivityEntry[]> {
  const db = await getDB();
  const per = Math.max(3, Math.ceil(limit / 2));

  const [orders, products, customers, reviews] = await db.batch<Record<string, unknown>>([
    db
      .prepare(
        `SELECT o.id, o.order_number, o.placed_at, u.name AS user_name
         FROM orders o JOIN users u ON u.id = o.user_id
         ORDER BY o.placed_at DESC LIMIT ?`
      )
      .bind(per),
    db
      .prepare(
        `SELECT id, name, status, created_at FROM products
         WHERE status != 'archived' ORDER BY created_at DESC LIMIT ?`
      )
      .bind(per),
    db
      .prepare(
        `SELECT id, name, email, created_at FROM users
         WHERE role = 'customer' ORDER BY created_at DESC LIMIT ?`
      )
      .bind(per),
    db
      .prepare(
        `SELECT r.id, r.rating, r.created_at, p.name AS product_name, u.name AS user_name
         FROM reviews r
         JOIN products p ON p.id = r.product_id
         JOIN users u ON u.id = r.user_id
         ORDER BY r.created_at DESC LIMIT ?`
      )
      .bind(per),
  ]);

  const entries: ActivityEntry[] = [];

  for (const row of orders.results as unknown as {
    id: string;
    order_number: string;
    placed_at: string;
    user_name: string;
  }[]) {
    entries.push({
      id: `order-${row.id}`,
      kind: "order",
      title: "New order received",
      detail: `#${row.order_number} · ${row.user_name}`,
      at: row.placed_at,
    });
  }

  for (const row of products.results as unknown as {
    id: string;
    name: string;
    status: string;
    created_at: string;
  }[]) {
    entries.push({
      id: `product-${row.id}`,
      kind: "product",
      title: row.status === "active" ? "Product published" : "Product added",
      detail: row.name,
      at: row.created_at,
    });
  }

  for (const row of customers.results as unknown as {
    id: string;
    name: string;
    email: string | null;
    created_at: string;
  }[]) {
    entries.push({
      id: `customer-${row.id}`,
      kind: "customer",
      title: "Customer registered",
      detail: row.email ?? row.name,
      at: row.created_at,
    });
  }

  for (const row of reviews.results as unknown as {
    id: string;
    rating: number;
    created_at: string;
    product_name: string;
    user_name: string;
  }[]) {
    entries.push({
      id: `review-${row.id}`,
      kind: "review",
      title: `${row.rating}-star review`,
      detail: `${row.product_name} · ${row.user_name}`,
      at: row.created_at,
    });
  }

  return entries.sort((a, b) => (a.at < b.at ? 1 : -1)).slice(0, limit);
}

/* -------------------------------------------------------------------------- */
/* Orders                                                                     */
/* -------------------------------------------------------------------------- */

export interface AdminOrderRow {
  id: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string | null;
  customerAvatar: string | null;
  itemCount: number;
  total: number;
  status: string;
  paymentStatus: string;
  paymentLabel: string;
  placedAt: string;
}

export interface OrderFilter {
  search?: string;
  status?: string;
  paymentStatus?: string;
  range?: RangeKey;
  page?: number;
}

function orderWhere(filter: OrderFilter): { where: string; binds: unknown[] } {
  const clauses: string[] = [];
  const binds: unknown[] = [];

  if (filter.status && filter.status !== "all") {
    clauses.push("o.status = ?");
    binds.push(filter.status);
  }
  if (filter.paymentStatus && filter.paymentStatus !== "all") {
    clauses.push("o.payment_status = ?");
    binds.push(filter.paymentStatus);
  }
  if (filter.range && filter.range !== "all") {
    clauses.push("o.placed_at >= datetime('now', ?)");
    binds.push(RANGES[filter.range]);
  }
  if (filter.search?.trim()) {
    clauses.push(
      "(o.order_number LIKE ? OR u.name LIKE ? OR u.email LIKE ? OR o.address_phone LIKE ?)"
    );
    const term = `%${filter.search.trim()}%`;
    binds.push(term, term, term, term);
  }

  return { where: clauses.length ? `WHERE ${clauses.join(" AND ")}` : "", binds };
}

export async function listOrders(filter: OrderFilter = {}): Promise<Page<AdminOrderRow>> {
  const db = await getDB();
  const { where, binds } = orderWhere(filter);
  const offset = Math.max(0, (filter.page ?? 1) - 1) * PAGE_SIZE;

  const [rows, count] = await db.batch<Record<string, unknown>>([
    db
      .prepare(
        `SELECT o.id, o.order_number, o.total, o.status, o.payment_status, o.payment_label,
                o.placed_at, u.name AS customer_name, u.email AS customer_email,
                u.avatar_url AS customer_avatar,
                (SELECT COALESCE(SUM(quantity), 0) FROM order_items WHERE order_id = o.id)
                  AS item_count
         FROM orders o JOIN users u ON u.id = o.user_id
         ${where}
         ORDER BY o.placed_at DESC LIMIT ? OFFSET ?`
      )
      .bind(...binds, PAGE_SIZE, offset),
    db
      .prepare(`SELECT COUNT(*) AS n FROM orders o JOIN users u ON u.id = o.user_id ${where}`)
      .bind(...binds),
  ]);

  return {
    rows: (rows.results as unknown as {
      id: string;
      order_number: string;
      total: number;
      status: string;
      payment_status: string;
      payment_label: string;
      placed_at: string;
      customer_name: string;
      customer_email: string | null;
      customer_avatar: string | null;
      item_count: number;
    }[]).map((row) => ({
      id: row.id,
      orderNumber: row.order_number,
      customerName: row.customer_name,
      customerEmail: row.customer_email,
      customerAvatar: row.customer_avatar,
      itemCount: row.item_count,
      total: row.total,
      status: row.status,
      paymentStatus: row.payment_status,
      paymentLabel: row.payment_label,
      placedAt: row.placed_at,
    })),
    total: (count.results as unknown as { n: number }[])[0]?.n ?? 0,
  };
}

/** Counts per status for the tab strip above the orders table. Always returns
 * every status, including empty ones, so tabs don't appear and vanish as the
 * data changes underneath. */
export async function getOrderCounts(filter: OrderFilter = {}): Promise<Record<string, number>> {
  const db = await getDB();
  const { where, binds } = orderWhere({ ...filter, status: "all" });

  const { results } = await db
    .prepare(
      `SELECT o.status, COUNT(*) AS n FROM orders o JOIN users u ON u.id = o.user_id
       ${where} GROUP BY o.status`
    )
    .bind(...binds)
    .all<{ status: string; n: number }>();

  const counts: Record<string, number> = {
    all: 0,
    placed: 0,
    confirmed: 0,
    shipped: 0,
    out_for_delivery: 0,
    delivered: 0,
    cancelled: 0,
  };
  for (const row of results) {
    counts[row.status] = row.n;
    counts.all += row.n;
  }
  return counts;
}

export interface AdminOrderDetail {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  paymentLabel: string;
  subtotal: number;
  shippingFee: number;
  discountTotal: number;
  couponCode: string | null;
  total: number;
  deliveryMethod: string;
  placedAt: string;
  customerId: string;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string | null;
  addressLabel: string;
  addressFullName: string;
  addressPhone: string;
  addressLine: string;
  addressArea: string | null;
  /** District. Null on orders placed before the district level existed. */
  addressDistrict: string | null;
  addressCity: string;
  items: {
    id: string;
    productId: string;
    name: string;
    image: string;
    color: string | null;
    price: number;
    quantity: number;
  }[];
  history: { status: string; note: string | null; at: string; by: string | null }[];
  /** One entry per seller in the order -- and one for an order that is
   * entirely the platform's. This is where courier and tracking live. */
  fulfilment: {
    id: string;
    sellerId: string | null;
    sellerName: string | null;
    status: string;
    subtotal: number;
    shippingFee: number;
    commissionAmount: number;
    courierName: string | null;
    trackingNumber: string | null;
    shippedAt: string | null;
    deliveredAt: string | null;
    itemCount: number;
  }[];
}

/** Accepts either the internal id or the human order number, so a support
 * agent can paste "ZUP1234567" straight from a customer email. */
export async function getOrderDetail(idOrNumber: string): Promise<AdminOrderDetail | null> {
  const db = await getDB();
  const row = await db
    .prepare(
      `SELECT o.*, u.name AS customer_name, u.email AS customer_email, u.phone AS customer_phone
       FROM orders o JOIN users u ON u.id = o.user_id WHERE o.id = ? OR o.order_number = ?`
    )
    .bind(idOrNumber, idOrNumber)
    .first<Record<string, string | number | null>>();

  if (!row) return null;

  const [items, history, fulfilment] = await db.batch<Record<string, unknown>>([
    db
      .prepare(
        `SELECT id, product_id, name, image, color, price, quantity
         FROM order_items WHERE order_id = ?`
      )
      .bind(row.id),
    db
      .prepare(
        `SELECT h.status, h.note, h.created_at, u.name AS by_name
         FROM order_status_history h
         LEFT JOIN users u ON u.id = h.changed_by
         WHERE h.order_id = ? ORDER BY h.created_at ASC`
      )
      .bind(row.id),
    // Fulfilment: one row per seller, carrying the courier and tracking that
    // the admin form writes and, until now, could never read back.
    db
      .prepare(
        `SELECT s.id, s.seller_id, sel.store_name AS seller_name, s.status, s.subtotal,
                s.shipping_fee, s.commission_amount, s.courier_name, s.tracking_number,
                s.shipped_at, s.delivered_at,
                (SELECT COUNT(*) FROM order_items oi WHERE oi.suborder_id = s.id) AS item_count
         FROM suborders s
         LEFT JOIN sellers sel ON sel.id = s.seller_id
         WHERE s.order_id = ? ORDER BY s.rowid ASC`
      )
      .bind(row.id),
  ]);

  return {
    id: String(row.id),
    orderNumber: String(row.order_number),
    status: String(row.status),
    paymentStatus: String(row.payment_status),
    paymentLabel: String(row.payment_label),
    subtotal: Number(row.subtotal),
    shippingFee: Number(row.shipping_fee),
    discountTotal: Number(row.discount_total ?? 0),
    couponCode: (row.coupon_code as string | null) ?? null,
    total: Number(row.total),
    deliveryMethod: String(row.delivery_method),
    placedAt: String(row.placed_at),
    customerId: String(row.user_id),
    customerName: String(row.customer_name),
    customerEmail: (row.customer_email as string | null) ?? null,
    customerPhone: (row.customer_phone as string | null) ?? null,
    addressLabel: String(row.address_label),
    addressFullName: String(row.address_full_name),
    addressPhone: String(row.address_phone),
    addressLine: String(row.address_line),
    addressArea: (row.address_area as string | null) ?? null,
    addressDistrict: (row.address_district as string | null) ?? null,
    addressCity: String(row.address_city),
    items: (items.results as unknown as {
      id: string;
      product_id: string;
      name: string;
      image: string;
      color: string | null;
      price: number;
      quantity: number;
    }[]).map((item) => ({
      id: item.id,
      productId: item.product_id,
      name: item.name,
      image: item.image,
      color: item.color,
      price: item.price,
      quantity: item.quantity,
    })),
    history: (history.results as unknown as {
      status: string;
      note: string | null;
      created_at: string;
      by_name: string | null;
    }[]).map((entry) => ({
      status: entry.status,
      note: entry.note,
      at: entry.created_at,
      by: entry.by_name,
    })),
    fulfilment: (fulfilment.results as unknown as {
      id: string;
      seller_id: string | null;
      seller_name: string | null;
      status: string;
      subtotal: number;
      shipping_fee: number;
      commission_amount: number;
      courier_name: string | null;
      tracking_number: string | null;
      shipped_at: string | null;
      delivered_at: string | null;
      item_count: number;
    }[]).map((entry) => ({
      id: entry.id,
      sellerId: entry.seller_id,
      sellerName: entry.seller_name,
      status: entry.status,
      subtotal: entry.subtotal,
      shippingFee: entry.shipping_fee,
      commissionAmount: entry.commission_amount,
      courierName: entry.courier_name,
      trackingNumber: entry.tracking_number,
      shippedAt: entry.shipped_at,
      deliveredAt: entry.delivered_at,
      itemCount: entry.item_count,
    })),
  };
}

/** Today's figures for the orders page's insight rail. */
export async function getOrderInsights() {
  const db = await getDB();
  const row = await db
    .prepare(
      `SELECT
         COUNT(CASE WHEN DATE(placed_at) = DATE('now') THEN 1 END) AS today_orders,
         COUNT(CASE WHEN payment_label LIKE '%Cash%' OR payment_label LIKE '%COD%' THEN 1 END)
           AS cod_orders,
         COALESCE(AVG(total), 0) AS avg_value
       FROM orders WHERE status != 'cancelled'`
    )
    .first<{ today_orders: number; cod_orders: number; avg_value: number }>();

  return {
    todayOrders: row?.today_orders ?? 0,
    codOrders: row?.cod_orders ?? 0,
    averageOrderValue: Math.round(row?.avg_value ?? 0),
  };
}

/* -------------------------------------------------------------------------- */
/* Products                                                                   */
/* -------------------------------------------------------------------------- */

export interface AdminProductRow {
  id: string;
  name: string;
  image: string | null;
  categoryName: string | null;
  brandName: string | null;
  price: number;
  stock: number;
  status: string;
  isLowStock: boolean;
  createdAt: string;
}

export interface ProductFilter {
  search?: string;
  categoryId?: string;
  brandId?: string;
  status?: string;
  range?: RangeKey;
  page?: number;
}

function productWhere(filter: ProductFilter): { where: string; binds: unknown[] } {
  const clauses: string[] = [];
  const binds: unknown[] = [];

  if (filter.status && filter.status !== "all") {
    clauses.push("p.status = ?");
    binds.push(filter.status);
  } else {
    // Archived products are soft-deleted; they only appear when asked for.
    clauses.push("p.status != 'archived'");
  }
  if (filter.categoryId && filter.categoryId !== "all") {
    // Matching the parent too means picking "Men's Fashion" also returns
    // everything filed under its subcategories.
    clauses.push("(p.category_id = ? OR c.parent_id = ?)");
    binds.push(filter.categoryId, filter.categoryId);
  }
  if (filter.brandId && filter.brandId !== "all") {
    clauses.push("p.brand_id = ?");
    binds.push(filter.brandId);
  }
  if (filter.range && filter.range !== "all") {
    clauses.push("p.created_at >= datetime('now', ?)");
    binds.push(RANGES[filter.range]);
  }
  if (filter.search?.trim()) {
    clauses.push("(p.name LIKE ? OR p.sku LIKE ? OR b.name LIKE ? OR c.name LIKE ?)");
    const term = `%${filter.search.trim()}%`;
    binds.push(term, term, term, term);
  }

  return { where: clauses.length ? `WHERE ${clauses.join(" AND ")}` : "", binds };
}

const ADMIN_PRODUCT_FROM = `
  FROM products p
  LEFT JOIN brands b ON b.id = p.brand_id
  LEFT JOIN categories c ON c.id = p.category_id`;

export async function listAdminProducts(filter: ProductFilter = {}): Promise<Page<AdminProductRow>> {
  const db = await getDB();
  const { where, binds } = productWhere(filter);
  const offset = Math.max(0, (filter.page ?? 1) - 1) * PAGE_SIZE;

  const [rows, count] = await db.batch<Record<string, unknown>>([
    db
      .prepare(
        `SELECT p.id, p.name, p.price, p.status, p.created_at,
                b.name AS brand_name, c.name AS category_name,
                (SELECT url FROM product_images i WHERE i.product_id = p.id
                  ORDER BY i.is_primary DESC, i.sort_order ASC LIMIT 1) AS image,
                (SELECT COALESCE(SUM(v.stock_quantity), 0) FROM product_variants v
                  WHERE v.product_id = p.id AND v.is_active = 1) AS stock,
                (SELECT COALESCE(MIN(v.low_stock_threshold), 5) FROM product_variants v
                  WHERE v.product_id = p.id AND v.is_active = 1) AS threshold
         ${ADMIN_PRODUCT_FROM} ${where}
         ORDER BY p.created_at DESC LIMIT ? OFFSET ?`
      )
      .bind(...binds, PAGE_SIZE, offset),
    db.prepare(`SELECT COUNT(*) AS n ${ADMIN_PRODUCT_FROM} ${where}`).bind(...binds),
  ]);

  return {
    rows: (rows.results as unknown as {
      id: string;
      name: string;
      price: number;
      status: string;
      created_at: string;
      brand_name: string | null;
      category_name: string | null;
      image: string | null;
      stock: number;
      threshold: number;
    }[]).map((row) => ({
      id: row.id,
      name: row.name,
      image: row.image,
      categoryName: row.category_name,
      brandName: row.brand_name,
      price: row.price,
      stock: row.stock,
      status: row.status,
      isLowStock: row.stock > 0 && row.stock <= row.threshold,
      createdAt: row.created_at,
    })),
    total: (count.results as unknown as { n: number }[])[0]?.n ?? 0,
  };
}

export interface ProductStats {
  total: number;
  published: number;
  draft: number;
  lowStock: number;
  outOfStock: number;
}

export async function getProductStats(): Promise<ProductStats> {
  const db = await getDB();
  const row = await db
    .prepare(
      `SELECT
         COUNT(*) AS total,
         COUNT(CASE WHEN status = 'active' THEN 1 END) AS published,
         COUNT(CASE WHEN status IN ('draft', 'pending_review') THEN 1 END) AS draft,
         COUNT(CASE WHEN qty = 0 THEN 1 END) AS out_of_stock,
         COUNT(CASE WHEN qty > 0 AND qty <= threshold THEN 1 END) AS low_stock
       FROM (
         SELECT p.status,
                (SELECT COALESCE(SUM(v.stock_quantity), 0) FROM product_variants v
                  WHERE v.product_id = p.id AND v.is_active = 1) AS qty,
                (SELECT COALESCE(MIN(v.low_stock_threshold), 5) FROM product_variants v
                  WHERE v.product_id = p.id AND v.is_active = 1) AS threshold
         FROM products p WHERE p.status != 'archived'
       )`
    )
    .first<{
      total: number;
      published: number;
      draft: number;
      out_of_stock: number;
      low_stock: number;
    }>();

  return {
    total: row?.total ?? 0,
    published: row?.published ?? 0,
    draft: row?.draft ?? 0,
    lowStock: row?.low_stock ?? 0,
    outOfStock: row?.out_of_stock ?? 0,
  };
}

/** Categories ranked by revenue, for the products page's side rail. */
export async function getTopCategories(limit = 5, range: RangeKey = "7d") {
  const db = await getDB();
  const { results } = await db
    .prepare(
      `SELECT c.id, c.name, COALESCE(SUM(oi.price * oi.quantity), 0) AS revenue,
              COALESCE(SUM(oi.quantity), 0) AS units
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       JOIN products p ON p.id = oi.product_id
       JOIN categories c ON c.id = p.category_id
       WHERE o.status != 'cancelled' AND o.placed_at >= datetime('now', ?)
       GROUP BY c.id, c.name
       ORDER BY revenue DESC LIMIT ?`
    )
    .bind(RANGES[range], limit)
    .all<{ id: string; name: string; revenue: number; units: number }>();
  return results;
}

/* -------------------------------------------------------------------------- */
/* Categories                                                                 */
/* -------------------------------------------------------------------------- */

export interface AdminCategory {
  id: string;
  parentId: string | null;
  name: string;
  slug: string;
  subtitle: string | null;
  imageUrl: string | null;
  icon: string | null;
  sortOrder: number;
  isActive: boolean;
  productCount: number;
  children: AdminCategory[];
}

/** The full category tree with per-category product counts. Admin tooling
 * needs inactive categories too, which `listCategories()` filters out. */
export async function listCategoryTree(): Promise<AdminCategory[]> {
  const db = await getDB();
  const { results } = await db
    .prepare(
      `SELECT c.id, c.parent_id, c.name, c.slug, c.subtitle, c.image_url, c.icon,
              c.sort_order, c.is_active,
              (SELECT COUNT(*) FROM products p
                WHERE p.category_id = c.id AND p.status != 'archived') AS product_count
       FROM categories c
       ORDER BY c.sort_order ASC, c.name ASC`
    )
    .all<{
      id: string;
      parent_id: string | null;
      name: string;
      slug: string;
      subtitle: string | null;
      image_url: string | null;
      icon: string | null;
      sort_order: number;
      is_active: number;
      product_count: number;
    }>();

  const byId = new Map<string, AdminCategory>();
  for (const row of results) {
    byId.set(row.id, {
      id: row.id,
      parentId: row.parent_id,
      name: row.name,
      slug: row.slug,
      subtitle: row.subtitle,
      imageUrl: row.image_url,
      icon: row.icon,
      sortOrder: row.sort_order,
      isActive: row.is_active === 1,
      productCount: row.product_count,
      children: [],
    });
  }

  const roots: AdminCategory[] = [];
  for (const category of byId.values()) {
    const parent = category.parentId ? byId.get(category.parentId) : undefined;
    if (parent) parent.children.push(category);
    else roots.push(category);
  }

  return roots;
}

/** Flat list of every category, indented by depth, for <select> menus. */
export async function listCategoryOptions(): Promise<{ id: string; label: string; parentId: string | null }[]> {
  const tree = await listCategoryTree();
  const options: { id: string; label: string; parentId: string | null }[] = [];

  const walk = (nodes: AdminCategory[], depth: number) => {
    for (const node of nodes) {
      options.push({
        id: node.id,
        label: `${"— ".repeat(depth)}${node.name}`,
        parentId: node.parentId,
      });
      walk(node.children, depth + 1);
    }
  };

  walk(tree, 0);
  return options;
}

/* -------------------------------------------------------------------------- */
/* Customers                                                                  */
/* -------------------------------------------------------------------------- */

export interface AdminCustomerRow {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  avatarUrl: string | null;
  role: string;
  status: string;
  points: number;
  orderCount: number;
  totalSpent: number;
  lastOrderAt: string | null;
  createdAt: string;
}

export interface CustomerFilter {
  search?: string;
  status?: string;
  role?: string;
  page?: number;
}

function customerWhere(filter: CustomerFilter): { where: string; binds: unknown[] } {
  const clauses: string[] = [];
  const binds: unknown[] = [];

  if (filter.status && filter.status !== "all") {
    clauses.push("u.status = ?");
    binds.push(filter.status);
  }
  if (filter.role && filter.role !== "all") {
    clauses.push("u.role = ?");
    binds.push(filter.role);
  }
  if (filter.search?.trim()) {
    clauses.push("(u.name LIKE ? OR u.email LIKE ? OR u.phone LIKE ?)");
    const term = `%${filter.search.trim()}%`;
    binds.push(term, term, term);
  }

  return { where: clauses.length ? `WHERE ${clauses.join(" AND ")}` : "", binds };
}

export async function listCustomers(filter: CustomerFilter = {}): Promise<Page<AdminCustomerRow>> {
  const db = await getDB();
  const { where, binds } = customerWhere(filter);
  const offset = Math.max(0, (filter.page ?? 1) - 1) * PAGE_SIZE;

  const [rows, count] = await db.batch<Record<string, unknown>>([
    db
      .prepare(
        `SELECT u.id, u.name, u.email, u.phone, u.avatar_url, u.role, u.status, u.points,
                u.created_at,
                (SELECT COUNT(*) FROM orders o WHERE o.user_id = u.id) AS order_count,
                (SELECT COALESCE(SUM(o.total), 0) FROM orders o
                  WHERE o.user_id = u.id AND o.status != 'cancelled') AS total_spent,
                (SELECT MAX(o.placed_at) FROM orders o WHERE o.user_id = u.id) AS last_order_at
         FROM users u ${where}
         ORDER BY u.created_at DESC LIMIT ? OFFSET ?`
      )
      .bind(...binds, PAGE_SIZE, offset),
    db.prepare(`SELECT COUNT(*) AS n FROM users u ${where}`).bind(...binds),
  ]);

  return {
    rows: (rows.results as unknown as {
      id: string;
      name: string;
      email: string | null;
      phone: string | null;
      avatar_url: string | null;
      role: string;
      status: string;
      points: number;
      created_at: string;
      order_count: number;
      total_spent: number;
      last_order_at: string | null;
    }[]).map((row) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      phone: row.phone,
      avatarUrl: row.avatar_url,
      role: row.role,
      status: row.status,
      points: row.points,
      orderCount: row.order_count,
      totalSpent: row.total_spent,
      lastOrderAt: row.last_order_at,
      createdAt: row.created_at,
    })),
    total: (count.results as unknown as { n: number }[])[0]?.n ?? 0,
  };
}

export async function getCustomerStats() {
  const db = await getDB();
  const row = await db
    .prepare(
      `SELECT
         COUNT(*) AS total,
         COUNT(CASE WHEN status = 'active' THEN 1 END) AS active,
         COUNT(CASE WHEN status IN ('suspended', 'banned') THEN 1 END) AS blocked,
         COUNT(CASE WHEN created_at >= datetime('now', '-30 days') THEN 1 END) AS new_this_month
       FROM users`
    )
    .first<{ total: number; active: number; blocked: number; new_this_month: number }>();

  return {
    total: row?.total ?? 0,
    active: row?.active ?? 0,
    blocked: row?.blocked ?? 0,
    newThisMonth: row?.new_this_month ?? 0,
  };
}

/** One customer with their order history, for the customer detail drawer. */
export async function getCustomerDetail(userId: string) {
  const db = await getDB();
  const user = await db
    .prepare(
      `SELECT id, name, email, phone, avatar_url, role, status, points, email_verified,
              phone_verified, last_login_at, created_at
       FROM users WHERE id = ?`
    )
    .bind(userId)
    .first<{
      id: string;
      name: string;
      email: string | null;
      phone: string | null;
      avatar_url: string | null;
      role: string;
      status: string;
      points: number;
      email_verified: number;
      phone_verified: number;
      last_login_at: string | null;
      created_at: string;
    }>();

  if (!user) return null;

  const [orders, addresses] = await db.batch<Record<string, unknown>>([
    db
      .prepare(
        `SELECT id, order_number, status, total, placed_at FROM orders
         WHERE user_id = ? ORDER BY placed_at DESC LIMIT 20`
      )
      .bind(userId),
    db
      .prepare(
        `SELECT label, full_name, phone, line1, area, city, postal_code, is_default
         FROM addresses WHERE user_id = ? ORDER BY is_default DESC`
      )
      .bind(userId),
  ]);

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    avatarUrl: user.avatar_url,
    role: user.role,
    status: user.status,
    points: user.points,
    emailVerified: user.email_verified === 1,
    phoneVerified: user.phone_verified === 1,
    lastLoginAt: user.last_login_at,
    createdAt: user.created_at,
    orders: orders.results as unknown as {
      id: string;
      order_number: string;
      status: string;
      total: number;
      placed_at: string;
    }[],
    addresses: addresses.results as unknown as {
      label: string;
      full_name: string;
      phone: string;
      line1: string;
      area: string | null;
      city: string;
      postal_code: string | null;
      is_default: number;
    }[],
  };
}

/* -------------------------------------------------------------------------- */
/* Reviews                                                                    */
/* -------------------------------------------------------------------------- */

export interface AdminReviewRow {
  id: string;
  productId: string;
  productName: string;
  productImage: string | null;
  customerName: string;
  customerAvatar: string | null;
  rating: number;
  title: string | null;
  body: string | null;
  status: string;
  isVerifiedPurchase: boolean;
  helpfulCount: number;
  images: string[];
  createdAt: string;
}

export interface ReviewFilter {
  search?: string;
  status?: string;
  rating?: number;
  media?: "all" | "with" | "without";
  range?: RangeKey;
  page?: number;
}

function reviewWhere(filter: ReviewFilter): { where: string; binds: unknown[] } {
  const clauses: string[] = [];
  const binds: unknown[] = [];

  if (filter.status && filter.status !== "all") {
    clauses.push("r.status = ?");
    binds.push(filter.status);
  }
  if (filter.rating) {
    clauses.push("r.rating = ?");
    binds.push(filter.rating);
  }
  if (filter.media === "with") {
    clauses.push("EXISTS (SELECT 1 FROM review_images ri WHERE ri.review_id = r.id)");
  } else if (filter.media === "without") {
    clauses.push("NOT EXISTS (SELECT 1 FROM review_images ri WHERE ri.review_id = r.id)");
  }
  if (filter.range && filter.range !== "all") {
    clauses.push("r.created_at >= datetime('now', ?)");
    binds.push(RANGES[filter.range]);
  }
  if (filter.search?.trim()) {
    clauses.push("(p.name LIKE ? OR u.name LIKE ? OR r.body LIKE ? OR r.title LIKE ?)");
    const term = `%${filter.search.trim()}%`;
    binds.push(term, term, term, term);
  }

  return { where: clauses.length ? `WHERE ${clauses.join(" AND ")}` : "", binds };
}

const REVIEW_FROM = `
  FROM reviews r
  JOIN products p ON p.id = r.product_id
  JOIN users u ON u.id = r.user_id`;

export async function listAdminReviews(filter: ReviewFilter = {}): Promise<Page<AdminReviewRow>> {
  const db = await getDB();
  const { where, binds } = reviewWhere(filter);
  const offset = Math.max(0, (filter.page ?? 1) - 1) * PAGE_SIZE;

  const [rows, count] = await db.batch<Record<string, unknown>>([
    db
      .prepare(
        `SELECT r.id, r.product_id, r.rating, r.title, r.body, r.status, r.order_item_id,
                r.helpful_count, r.created_at,
                p.name AS product_name, u.name AS customer_name, u.avatar_url AS customer_avatar,
                (SELECT url FROM product_images i WHERE i.product_id = p.id
                  ORDER BY i.is_primary DESC, i.sort_order ASC LIMIT 1) AS product_image
         ${REVIEW_FROM} ${where}
         ORDER BY r.created_at DESC LIMIT ? OFFSET ?`
      )
      .bind(...binds, PAGE_SIZE, offset),
    db.prepare(`SELECT COUNT(*) AS n ${REVIEW_FROM} ${where}`).bind(...binds),
  ]);

  const reviewRows = rows.results as unknown as {
    id: string;
    product_id: string;
    rating: number;
    title: string | null;
    body: string | null;
    status: string;
    order_item_id: string | null;
    helpful_count: number;
    created_at: string;
    product_name: string;
    customer_name: string;
    customer_avatar: string | null;
    product_image: string | null;
  }[];

  // One extra round trip for the whole page's attachments, rather than a
  // correlated subquery per row.
  let imagesByReview = new Map<string, string[]>();
  if (reviewRows.length > 0) {
    const placeholders = reviewRows.map(() => "?").join(",");
    const { results: imageRows } = await db
      .prepare(`SELECT review_id, url FROM review_images WHERE review_id IN (${placeholders})`)
      .bind(...reviewRows.map((row) => row.id))
      .all<{ review_id: string; url: string }>();

    imagesByReview = imageRows.reduce((map, row) => {
      const list = map.get(row.review_id) ?? [];
      list.push(row.url);
      map.set(row.review_id, list);
      return map;
    }, new Map<string, string[]>());
  }

  return {
    rows: reviewRows.map((row) => ({
      id: row.id,
      productId: row.product_id,
      productName: row.product_name,
      productImage: row.product_image,
      customerName: row.customer_name,
      customerAvatar: row.customer_avatar,
      rating: row.rating,
      title: row.title,
      body: row.body,
      status: row.status,
      isVerifiedPurchase: row.order_item_id !== null,
      helpfulCount: row.helpful_count,
      images: imagesByReview.get(row.id) ?? [],
      createdAt: row.created_at,
    })),
    total: (count.results as unknown as { n: number }[])[0]?.n ?? 0,
  };
}

export interface ReviewStats {
  average: number;
  total: number;
  verified: number;
  withMedia: number;
  counts: Record<1 | 2 | 3 | 4 | 5, number>;
  byStatus: Record<string, number>;
}

export async function getReviewStats(): Promise<ReviewStats> {
  const db = await getDB();

  const [totals, byRating, byStatus] = await db.batch<Record<string, unknown>>([
    db.prepare(
      `SELECT COUNT(*) AS total,
              COALESCE(AVG(rating), 0) AS average,
              COUNT(CASE WHEN order_item_id IS NOT NULL THEN 1 END) AS verified,
              (SELECT COUNT(DISTINCT review_id) FROM review_images) AS with_media
       FROM reviews`
    ),
    db.prepare("SELECT rating, COUNT(*) AS n FROM reviews GROUP BY rating"),
    db.prepare("SELECT status, COUNT(*) AS n FROM reviews GROUP BY status"),
  ]);

  const t = (totals.results as unknown as {
    total: number;
    average: number;
    verified: number;
    with_media: number;
  }[])[0];

  const counts: Record<1 | 2 | 3 | 4 | 5, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const row of byRating.results as unknown as { rating: number; n: number }[]) {
    const star = Math.min(5, Math.max(1, row.rating)) as 1 | 2 | 3 | 4 | 5;
    counts[star] = row.n;
  }

  const statusCounts: Record<string, number> = {
    all: t?.total ?? 0,
    approved: 0,
    pending: 0,
    rejected: 0,
    spam: 0,
  };
  for (const row of byStatus.results as unknown as { status: string; n: number }[]) {
    statusCounts[row.status] = row.n;
  }

  return {
    average: Math.round((t?.average ?? 0) * 10) / 10,
    total: t?.total ?? 0,
    verified: t?.verified ?? 0,
    withMedia: t?.with_media ?? 0,
    counts,
    byStatus: statusCounts,
  };
}

/* -------------------------------------------------------------------------- */
/* Distributors (sellers)                                                     */
/* -------------------------------------------------------------------------- */

export interface AdminSellerRow {
  id: string;
  storeName: string;
  slug: string;
  logoUrl: string | null;
  ownerName: string;
  ownerEmail: string | null;
  status: string;
  commissionRate: number;
  rating: number;
  productCount: number;
  orderCount: number;
  grossSales: number;
  createdAt: string;
}

export async function listAdminSellers(
  filter: { search?: string; status?: string; page?: number } = {}
): Promise<Page<AdminSellerRow>> {
  const db = await getDB();
  const clauses: string[] = [];
  const binds: unknown[] = [];

  if (filter.status && filter.status !== "all") {
    clauses.push("s.status = ?");
    binds.push(filter.status);
  }
  if (filter.search?.trim()) {
    clauses.push("(s.store_name LIKE ? OR u.name LIKE ? OR u.email LIKE ?)");
    const term = `%${filter.search.trim()}%`;
    binds.push(term, term, term);
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const offset = Math.max(0, (filter.page ?? 1) - 1) * PAGE_SIZE;

  const [rows, count] = await db.batch<Record<string, unknown>>([
    db
      .prepare(
        `SELECT s.id, s.store_name, s.slug, s.logo_url, s.status, s.commission_rate,
                s.rating_avg, s.created_at,
                u.name AS owner_name, u.email AS owner_email,
                (SELECT COUNT(*) FROM products p
                  WHERE p.seller_id = s.id AND p.status != 'archived') AS product_count,
                (SELECT COUNT(*) FROM suborders so WHERE so.seller_id = s.id) AS order_count,
                (SELECT COALESCE(SUM(so.subtotal), 0) FROM suborders so
                  WHERE so.seller_id = s.id AND so.status != 'cancelled') AS gross_sales
         FROM sellers s JOIN users u ON u.id = s.user_id
         ${where} ORDER BY s.created_at DESC LIMIT ? OFFSET ?`
      )
      .bind(...binds, PAGE_SIZE, offset),
    db
      .prepare(`SELECT COUNT(*) AS n FROM sellers s JOIN users u ON u.id = s.user_id ${where}`)
      .bind(...binds),
  ]);

  return {
    rows: (rows.results as unknown as {
      id: string;
      store_name: string;
      slug: string;
      logo_url: string | null;
      status: string;
      commission_rate: number;
      rating_avg: number;
      created_at: string;
      owner_name: string;
      owner_email: string | null;
      product_count: number;
      order_count: number;
      gross_sales: number;
    }[]).map((row) => ({
      id: row.id,
      storeName: row.store_name,
      slug: row.slug,
      logoUrl: row.logo_url,
      ownerName: row.owner_name,
      ownerEmail: row.owner_email,
      status: row.status,
      commissionRate: row.commission_rate,
      rating: row.rating_avg,
      productCount: row.product_count,
      orderCount: row.order_count,
      grossSales: row.gross_sales,
      createdAt: row.created_at,
    })),
    total: (count.results as unknown as { n: number }[])[0]?.n ?? 0,
  };
}

/* -------------------------------------------------------------------------- */
/* Banners                                                                    */
/* -------------------------------------------------------------------------- */

export interface Banner {
  id: string;
  title: string;
  subtitle: string | null;
  imageUrl: string | null;
  linkUrl: string | null;
  placement: string;
  sortOrder: number;
  isActive: boolean;
  startsAt: string | null;
  endsAt: string | null;
}

export async function listBanners(placement?: string): Promise<Banner[]> {
  const db = await getDB();
  const where = placement ? "WHERE placement = ?" : "";
  const binds = placement ? [placement] : [];

  const { results } = await db
    .prepare(
      `SELECT id, title, subtitle, image_url, link_url, placement, sort_order,
              is_active, starts_at, ends_at
       FROM banners ${where} ORDER BY placement ASC, sort_order ASC`
    )
    .bind(...binds)
    .all<{
      id: string;
      title: string;
      subtitle: string | null;
      image_url: string | null;
      link_url: string | null;
      placement: string;
      sort_order: number;
      is_active: number;
      starts_at: string | null;
      ends_at: string | null;
    }>();

  return results.map((row) => ({
    id: row.id,
    title: row.title,
    subtitle: row.subtitle,
    imageUrl: row.image_url,
    linkUrl: row.link_url,
    placement: row.placement,
    sortOrder: row.sort_order,
    isActive: row.is_active === 1,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
  }));
}

/* -------------------------------------------------------------------------- */
/* Reports                                                                    */
/* -------------------------------------------------------------------------- */

/** Revenue split by payment method. */
export async function getRevenueByPayment(range: RangeKey = "30d") {
  const db = await getDB();
  const { results } = await db
    .prepare(
      `SELECT payment_label AS label, COUNT(*) AS orders, COALESCE(SUM(total), 0) AS revenue
       FROM orders WHERE status != 'cancelled' AND placed_at >= datetime('now', ?)
       GROUP BY payment_label ORDER BY revenue DESC`
    )
    .bind(RANGES[range])
    .all<{ label: string; orders: number; revenue: number }>();
  return results;
}

/** Where orders are going, by city. */
export async function getOrdersByCity(range: RangeKey = "30d", limit = 8) {
  const db = await getDB();
  const { results } = await db
    .prepare(
      `SELECT address_city AS city, COUNT(*) AS orders, COALESCE(SUM(total), 0) AS revenue
       FROM orders
       WHERE status != 'cancelled' AND placed_at >= datetime('now', ?) AND address_city != ''
       GROUP BY address_city ORDER BY orders DESC LIMIT ?`
    )
    .bind(RANGES[range], limit)
    .all<{ city: string; orders: number; revenue: number }>();
  return results;
}

/** Highest-spending customers over a window. */
export async function getTopCustomers(range: RangeKey = "30d", limit = 8) {
  const db = await getDB();
  const { results } = await db
    .prepare(
      `SELECT u.id, u.name, u.email, u.avatar_url, COUNT(o.id) AS orders,
              COALESCE(SUM(o.total), 0) AS spent
       FROM orders o JOIN users u ON u.id = o.user_id
       WHERE o.status != 'cancelled' AND o.placed_at >= datetime('now', ?)
       GROUP BY u.id, u.name, u.email, u.avatar_url
       ORDER BY spent DESC LIMIT ?`
    )
    .bind(RANGES[range], limit)
    .all<{
      id: string;
      name: string;
      email: string | null;
      avatar_url: string | null;
      orders: number;
      spent: number;
    }>();
  return results;
}

/* -------------------------------------------------------------------------- */
/* Staff alerts                                                               */
/* -------------------------------------------------------------------------- */

export interface StaffAlert {
  label: string;
  detail: string;
  href: string;
}

/** What the bell in the top bar counts: the queues a person has to act on.
 * Empty entries are dropped, so the badge only ever shows real work. */
export async function getStaffAlerts(): Promise<StaffAlert[]> {
  const db = await getDB();

  const [orders, reviews, sellers, stock] = await db.batch<Record<string, number>>([
    db.prepare("SELECT COUNT(*) AS n FROM orders WHERE status = 'placed'"),
    db.prepare("SELECT COUNT(*) AS n FROM reviews WHERE status = 'pending'"),
    db.prepare("SELECT COUNT(*) AS n FROM sellers WHERE status = 'pending'"),
    db.prepare(
      `SELECT COUNT(*) AS n FROM product_variants v
       JOIN products p ON p.id = v.product_id
       WHERE v.is_active = 1 AND p.status = 'active'
         AND (v.stock_quantity - v.reserved_quantity) <= v.low_stock_threshold`
    ),
  ]);

  const count = (result: D1Result<Record<string, number>>) =>
    (result.results as unknown as { n: number }[])[0]?.n ?? 0;

  const alerts: StaffAlert[] = [];
  const pendingOrders = count(orders);
  const pendingReviews = count(reviews);
  const pendingSellers = count(sellers);
  const lowStock = count(stock);

  if (pendingOrders > 0) {
    alerts.push({
      label: `${pendingOrders} order${pendingOrders === 1 ? "" : "s"} awaiting confirmation`,
      detail: "Confirm them to start fulfillment",
      href: "/admin/orders?status=placed",
    });
  }
  if (pendingReviews > 0) {
    alerts.push({
      label: `${pendingReviews} review${pendingReviews === 1 ? "" : "s"} to moderate`,
      detail: "Approve, reject or mark as spam",
      href: "/admin/products/reviews?status=pending",
    });
  }
  if (pendingSellers > 0) {
    alerts.push({
      label: `${pendingSellers} distributor application${pendingSellers === 1 ? "" : "s"}`,
      detail: "Review and approve new stores",
      href: "/admin/distributors?status=pending",
    });
  }
  if (lowStock > 0) {
    alerts.push({
      label: `${lowStock} variant${lowStock === 1 ? "" : "s"} low on stock`,
      detail: "Restock before they sell out",
      href: "/admin/products?status=active",
    });
  }

  return alerts;
}

/** Best sellers over a window, with the thumbnail the dashboard row shows.
 *
 * `getTopProducts()` in src/lib/admin.ts answers the same question for plain
 * reporting; this one joins back to the catalog because the dashboard renders
 * a product row, not a bare name. Products deleted since the sale still appear
 * -- the name is snapshotted on the order line -- they simply have no image. */
export async function getTopProductsDetailed(limit = 5, range: RangeKey = "7d") {
  const db = await getDB();
  const { results } = await db
    .prepare(
      `SELECT oi.product_id, oi.name,
              SUM(oi.quantity) AS units,
              SUM(oi.price * oi.quantity) AS revenue,
              MAX(oi.image) AS image,
              MAX(CASE WHEN p.id IS NULL THEN 0 ELSE 1 END) AS still_listed
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       LEFT JOIN products p ON p.id = oi.product_id
       WHERE o.status != 'cancelled' AND o.placed_at >= datetime('now', ?)
       GROUP BY oi.product_id, oi.name
       ORDER BY units DESC LIMIT ?`
    )
    .bind(RANGES[range], limit)
    .all<{
      product_id: string;
      name: string;
      units: number;
      revenue: number;
      image: string | null;
      still_listed: number;
    }>();

  // Order lines snapshot the name, so a product deleted since the sale still
  // belongs in the ranking -- it just must not be rendered as a link to an
  // edit page that would 404.
  return results.map((row) => ({ ...row, stillListed: row.still_listed === 1 }));
}

/* -------------------------------------------------------------------------- */
/* Global search                                                              */
/* -------------------------------------------------------------------------- */

export interface SearchHit {
  kind: "product" | "order" | "customer";
  id: string;
  title: string;
  detail: string;
  href: string;
  image: string | null;
}

/** One box, three tables. The top bar's search covers the things a person
 * actually pastes in: a product name, an order number, a customer's email or
 * phone. Each source is capped so no one section can bury the others. */
export async function searchEverything(term: string, perSection = 5): Promise<SearchHit[]> {
  const trimmed = term.trim();
  if (!trimmed) return [];

  const db = await getDB();
  const like = `%${trimmed}%`;

  const [products, orders, customers] = await db.batch<Record<string, unknown>>([
    db
      .prepare(
        `SELECT p.id, p.name, p.price, p.status,
                (SELECT url FROM product_images i WHERE i.product_id = p.id
                  ORDER BY i.is_primary DESC, i.sort_order ASC LIMIT 1) AS image
         FROM products p
         WHERE p.status != 'archived' AND (p.name LIKE ? OR p.sku LIKE ?)
         ORDER BY p.created_at DESC LIMIT ?`
      )
      .bind(like, like, perSection),
    db
      .prepare(
        `SELECT o.id, o.order_number, o.total, o.status, u.name AS customer_name
         FROM orders o JOIN users u ON u.id = o.user_id
         WHERE o.order_number LIKE ? OR u.name LIKE ? OR o.address_phone LIKE ?
         ORDER BY o.placed_at DESC LIMIT ?`
      )
      .bind(like, like, like, perSection),
    db
      .prepare(
        `SELECT id, name, email, phone, avatar_url FROM users
         WHERE name LIKE ? OR email LIKE ? OR phone LIKE ?
         ORDER BY created_at DESC LIMIT ?`
      )
      .bind(like, like, like, perSection),
  ]);

  const hits: SearchHit[] = [];

  for (const row of products.results as unknown as {
    id: string;
    name: string;
    price: number;
    status: string;
    image: string | null;
  }[]) {
    hits.push({
      kind: "product",
      id: row.id,
      title: row.name,
      detail: `৳ ${row.price.toLocaleString("en-US")} · ${row.status}`,
      href: `/admin/products/${row.id}`,
      image: row.image,
    });
  }

  for (const row of orders.results as unknown as {
    id: string;
    order_number: string;
    total: number;
    status: string;
    customer_name: string;
  }[]) {
    hits.push({
      kind: "order",
      id: row.id,
      title: `#${row.order_number}`,
      detail: `${row.customer_name} · ৳ ${row.total.toLocaleString("en-US")} · ${row.status}`,
      href: `/admin/orders/${row.id}`,
      image: null,
    });
  }

  for (const row of customers.results as unknown as {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    avatar_url: string | null;
  }[]) {
    hits.push({
      kind: "customer",
      id: row.id,
      title: row.name,
      detail: row.email ?? row.phone ?? "No contact details",
      href: `/admin/customers/${row.id}`,
      image: row.avatar_url,
    });
  }

  return hits;
}

/* -------------------------------------------------------------------------- */
/* Product editing                                                            */
/* -------------------------------------------------------------------------- */

export interface EditableVariant {
  id: string;
  sku: string | null;
  optionValue: string | null;
  option2Value: string | null;
  price: number | null;
  oldPrice: number | null;
  stockQuantity: number;
  reservedQuantity: number;
  lowStockThreshold: number;
  /** Retired combinations are loaded too, so the matrix can show one being
   * brought back with the stock, SKU and price it kept while it was off. */
  isActive: boolean;
  /** The gallery image this combination switches to, by URL rather than id --
   * the form posts URLs and the server resolves them against the gallery it
   * has just written. */
  imageUrl: string | null;
  /** Option group id -> option value id, which is how the matrix knows which
   * row of itself this variant is. */
  selections: Record<string, string>;
}

export interface EditableOptionValue {
  id: string;
  value: string;
  label: string;
  colorHex: string | null;
  imageUrl: string | null;
  isActive: boolean;
}

export interface EditableOptionGroup {
  id: string;
  key: string;
  name: string;
  display: "swatch" | "image" | "pill" | "dropdown";
  showLabels: boolean;
  isActive: boolean;
  values: EditableOptionValue[];
}

export interface EditableProduct {
  id: string;
  name: string;
  slug: string;
  sku: string | null;
  description: string | null;
  categoryId: string | null;
  brandId: string | null;
  status: string;
  /** The pre-discount figure the form shows in its Price box: `old_price`
   * when a discount is set, otherwise the selling price itself. */
  basePrice: number;
  sellingPrice: number;
  discountType: "none" | "percent" | "fixed";
  discountValue: number;
  isFeatured: boolean;
  isBestSeller: boolean;
  weightKg: string;
  length: number;
  width: number;
  height: number;
  metaTitle: string;
  metaDescription: string;
  images: string[];
  videos: string[];
  /** Poster still per clip, aligned by position with `videos` and empty where
   * a clip has none. */
  videoPosters: string[];
  tags: string[];
  colors: string[];
  sizes: string[];
  /** Every option the product offers, retired ones included. */
  optionGroups: EditableOptionGroup[];
  variants: EditableVariant[];
  soldCount: number;
  viewCount: number;
  ratingAvg: number;
  ratingCount: number;
  createdAt: string;
  updatedAt: string | null;
}

/** Loads a product in the shape the edit form posts back.
 *
 * The catalog stores a selling price and an optional struck-through original;
 * the form works in "price + discount". This reverses that: a fixed discount
 * is preferred when it divides evenly into a whole percentage, because
 * "৳200 off" is what was almost certainly typed. */
export async function getProductForEdit(productId: string): Promise<EditableProduct | null> {
  const db = await getDB();
  const row = await db
    .prepare(
      `SELECT id, name, slug, sku, description, category_id, brand_id, status, price, old_price,
              is_featured, is_best_seller, weight_grams, dimensions_json, meta_title,
              meta_description, sold_count, view_count, rating_avg, rating_count,
              created_at, updated_at
       FROM products WHERE id = ?`
    )
    .bind(productId)
    .first<{
      id: string;
      name: string;
      slug: string;
      sku: string | null;
      description: string | null;
      category_id: string | null;
      brand_id: string | null;
      status: string;
      price: number;
      old_price: number;
      is_featured: number;
      is_best_seller: number;
      weight_grams: number | null;
      dimensions_json: string | null;
      meta_title: string | null;
      meta_description: string | null;
      sold_count: number;
      view_count: number;
      rating_avg: number;
      rating_count: number;
      created_at: string;
      updated_at: string | null;
    }>();

  if (!row) return null;

  const [images, videos, attributes, variants, optionRows, links] = await db.batch<
    Record<string, unknown>
  >([
    db
      .prepare(
        "SELECT id, url FROM product_images WHERE product_id = ? ORDER BY is_primary DESC, sort_order ASC"
      )
      .bind(productId),
    db
      .prepare(
        "SELECT url, poster_url FROM product_videos WHERE product_id = ? ORDER BY sort_order ASC"
      )
      .bind(productId),
    db
      .prepare(
        "SELECT attr_name, attr_value FROM product_attributes WHERE product_id = ? ORDER BY sort_order ASC"
      )
      .bind(productId),
    // Retired variants are included: the editor has to be able to show a
    // combination coming back with everything it kept while it was off.
    db
      .prepare(
        `SELECT id, sku, option1_value, option2_value, price, old_price, stock_quantity,
                reserved_quantity, low_stock_threshold, is_active, image_id
         FROM product_variants WHERE product_id = ? ORDER BY rowid ASC`
      )
      .bind(productId),
    db
      .prepare(
        `SELECT g.id AS group_id, g.key, g.name, g.display, g.show_labels, g.is_active AS group_active,
                g.sort_order AS group_sort,
                ov.id AS value_id, ov.value, ov.label, ov.color_hex, ov.image_url,
                ov.is_active AS value_active, ov.sort_order AS value_sort
         FROM product_option_groups g
         LEFT JOIN product_option_values ov ON ov.group_id = g.id
         WHERE g.product_id = ?
         ORDER BY g.sort_order ASC, ov.sort_order ASC`
      )
      .bind(productId),
    db
      .prepare(
        `SELECT pvo.variant_id, pvo.group_id, pvo.value_id
         FROM product_variant_options pvo
         JOIN product_option_groups g ON g.id = pvo.group_id
         WHERE g.product_id = ?`
      )
      .bind(productId),
  ]);

  const videoRows = videos.results as unknown as { url: string; poster_url: string | null }[];

  const attributeRows = attributes.results as unknown as {
    attr_name: string;
    attr_value: string;
  }[];

  const variantRows = variants.results as unknown as {
    id: string;
    sku: string | null;
    option1_value: string | null;
    option2_value: string | null;
    price: number | null;
    old_price: number | null;
    stock_quantity: number;
    reserved_quantity: number;
    low_stock_threshold: number;
    is_active: number;
    image_id: string | null;
  }[];

  const imageRows = images.results as unknown as { id: string; url: string }[];
  const imageUrlById = new Map(imageRows.map((image) => [image.id, image.url]));

  // One row per value, flattened back into groups. The join is a LEFT one so a
  // group whose values were all removed still reaches the editor and can be
  // repaired rather than vanishing from the form.
  const groupsById = new Map<string, EditableOptionGroup>();
  for (const row of optionRows.results as unknown as {
    group_id: string;
    key: string;
    name: string;
    display: string;
    show_labels: number;
    group_active: number;
    value_id: string | null;
    value: string | null;
    label: string | null;
    color_hex: string | null;
    image_url: string | null;
    value_active: number | null;
  }[]) {
    let group = groupsById.get(row.group_id);
    if (!group) {
      group = {
        id: row.group_id,
        key: row.key,
        name: row.name,
        display: row.display as EditableOptionGroup["display"],
        showLabels: row.show_labels === 1,
        isActive: row.group_active === 1,
        values: [],
      };
      groupsById.set(row.group_id, group);
    }
    if (row.value_id) {
      group.values.push({
        id: row.value_id,
        value: row.value ?? "",
        label: row.label ?? "",
        colorHex: row.color_hex,
        imageUrl: row.image_url,
        isActive: row.value_active === 1,
      });
    }
  }

  const selectionsByVariant = new Map<string, Record<string, string>>();
  for (const link of links.results as unknown as {
    variant_id: string;
    group_id: string;
    value_id: string;
  }[]) {
    const selections = selectionsByVariant.get(link.variant_id) ?? {};
    selections[link.group_id] = link.value_id;
    selectionsByVariant.set(link.variant_id, selections);
  }

  const discounted = row.old_price > row.price && row.old_price > 0;
  const off = discounted ? row.old_price - row.price : 0;
  const percent = discounted ? Math.round((off / row.old_price) * 100) : 0;
  // Prefer the percentage reading only when it round-trips exactly; otherwise
  // a "13%" that actually came from "৳199 off" would drift on every save.
  const percentIsExact = discounted && Math.round(row.old_price * (1 - percent / 100)) === row.price;

  const dimensions = (() => {
    try {
      return row.dimensions_json
        ? (JSON.parse(row.dimensions_json) as { l?: number; w?: number; h?: number })
        : {};
    } catch {
      return {};
    }
  })();

  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    sku: row.sku,
    description: row.description,
    categoryId: row.category_id,
    brandId: row.brand_id,
    status: row.status,
    basePrice: discounted ? row.old_price : row.price,
    sellingPrice: row.price,
    discountType: !discounted ? "none" : percentIsExact ? "percent" : "fixed",
    discountValue: !discounted ? 0 : percentIsExact ? percent : off,
    isFeatured: row.is_featured === 1,
    isBestSeller: row.is_best_seller === 1,
    weightKg: row.weight_grams ? String(row.weight_grams / 1000) : "",
    length: dimensions.l ?? 0,
    width: dimensions.w ?? 0,
    height: dimensions.h ?? 0,
    metaTitle: row.meta_title ?? "",
    metaDescription: row.meta_description ?? "",
    images: imageRows.map((image) => image.url),
    videos: videoRows.map((video) => video.url),
    // Posted back positionally alongside the URLs, so an empty string has to
    // hold the slot of a clip that never got a poster.
    videoPosters: videoRows.map((video) => video.poster_url ?? ""),
    tags: attributeRows.filter((a) => a.attr_name === "tag").map((a) => a.attr_value),
    colors: [
      ...new Set(
        variantRows.filter((v) => v.is_active === 1).map((v) => v.option1_value).filter(Boolean)
      ),
    ] as string[],
    sizes: [
      ...new Set(
        variantRows.filter((v) => v.is_active === 1).map((v) => v.option2_value).filter(Boolean)
      ),
    ] as string[],
    optionGroups: [...groupsById.values()],
    variants: variantRows.map((variant) => ({
      id: variant.id,
      sku: variant.sku,
      optionValue: variant.option1_value,
      option2Value: variant.option2_value,
      price: variant.price,
      oldPrice: variant.old_price,
      stockQuantity: variant.stock_quantity,
      reservedQuantity: variant.reserved_quantity,
      lowStockThreshold: variant.low_stock_threshold,
      isActive: variant.is_active === 1,
      imageUrl: variant.image_id ? (imageUrlById.get(variant.image_id) ?? null) : null,
      selections: selectionsByVariant.get(variant.id) ?? {},
    })),
    soldCount: row.sold_count,
    viewCount: row.view_count,
    ratingAvg: row.rating_avg,
    ratingCount: row.rating_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/* -------------------------------------------------------------------------- */
/* Coupons                                                                    */
/* -------------------------------------------------------------------------- */

export interface AdminCouponRow {
  id: string;
  code: string;
  description: string | null;
  discountType: string;
  discountValue: number;
  minOrderAmount: number;
  maxDiscountAmount: number | null;
  usageLimit: number | null;
  usageCount: number;
  perUserLimit: number;
  redeemedTotal: number;
  isActive: boolean;
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string;
}

/** Coupons with what they have actually cost.
 *
 * `listCoupons()` in src/lib/coupons.ts returns the shopper-facing shape; the
 * admin table also needs the limits and the money given away, which is summed
 * from redemptions rather than trusted to a counter. */
export async function listAdminCoupons(): Promise<AdminCouponRow[]> {
  const db = await getDB();
  const { results } = await db
    .prepare(
      `SELECT c.id, c.code, c.description, c.discount_type, c.discount_value,
              c.min_order_amount, c.max_discount_amount, c.usage_limit, c.usage_count,
              c.per_user_limit, c.is_active, c.starts_at, c.ends_at, c.created_at,
              (SELECT COALESCE(SUM(r.discount_amount), 0) FROM coupon_redemptions r
                WHERE r.coupon_id = c.id) AS redeemed_total
       FROM coupons c ORDER BY c.created_at DESC`
    )
    .all<{
      id: string;
      code: string;
      description: string | null;
      discount_type: string;
      discount_value: number;
      min_order_amount: number;
      max_discount_amount: number | null;
      usage_limit: number | null;
      usage_count: number;
      per_user_limit: number;
      is_active: number;
      starts_at: string | null;
      ends_at: string | null;
      created_at: string;
      redeemed_total: number;
    }>();

  return results.map((row) => ({
    id: row.id,
    code: row.code,
    description: row.description,
    discountType: row.discount_type,
    discountValue: row.discount_value,
    minOrderAmount: row.min_order_amount,
    maxDiscountAmount: row.max_discount_amount,
    usageLimit: row.usage_limit,
    usageCount: row.usage_count,
    perUserLimit: row.per_user_limit,
    redeemedTotal: row.redeemed_total,
    isActive: row.is_active === 1,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    createdAt: row.created_at,
  }));
}

/* -------------------------------------------------------------------------- */
/* Flash sales                                                                */
/* -------------------------------------------------------------------------- */

export interface AdminFlashSale {
  id: string;
  name: string;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
  items: {
    id: string;
    productId: string;
    productName: string;
    productImage: string | null;
    normalPrice: number;
    salePrice: number;
    stockLimit: number | null;
    soldCount: number;
  }[];
}

/** Scheduled sales with the products in them. The normal price is read live
 * from the catalog rather than snapshotted, so the discount shown is always
 * measured against what the product actually costs today. */
export async function listFlashSales(): Promise<AdminFlashSale[]> {
  const db = await getDB();

  const { results: sales } = await db
    .prepare(
      "SELECT id, name, starts_at, ends_at, is_active FROM flash_sales ORDER BY starts_at DESC LIMIT 20"
    )
    .all<{
      id: string;
      name: string;
      starts_at: string;
      ends_at: string;
      is_active: number;
    }>();

  if (sales.length === 0) return [];

  const placeholders = sales.map(() => "?").join(",");
  const { results: items } = await db
    .prepare(
      `SELECT f.id, f.flash_sale_id, f.product_id, f.sale_price, f.stock_limit, f.sold_count,
              p.name AS product_name, p.price AS normal_price,
              (SELECT url FROM product_images i WHERE i.product_id = p.id
                ORDER BY i.is_primary DESC, i.sort_order ASC LIMIT 1) AS product_image
       FROM flash_sale_items f
       JOIN products p ON p.id = f.product_id
       WHERE f.flash_sale_id IN (${placeholders})`
    )
    .bind(...sales.map((sale) => sale.id))
    .all<{
      id: string;
      flash_sale_id: string;
      product_id: string;
      sale_price: number;
      stock_limit: number | null;
      sold_count: number;
      product_name: string;
      normal_price: number;
      product_image: string | null;
    }>();

  return sales.map((sale) => ({
    id: sale.id,
    name: sale.name,
    startsAt: sale.starts_at,
    endsAt: sale.ends_at,
    isActive: sale.is_active === 1,
    items: items
      .filter((item) => item.flash_sale_id === sale.id)
      .map((item) => ({
        id: item.id,
        productId: item.product_id,
        productName: item.product_name,
        productImage: item.product_image,
        normalPrice: item.normal_price,
        salePrice: item.sale_price,
        stockLimit: item.stock_limit,
        soldCount: item.sold_count,
      })),
  }));
}

/** Live products as <select> options, for adding items to a flash sale. */
export async function listProductOptions(limit = 200) {
  const db = await getDB();
  const { results } = await db
    .prepare(
      `SELECT id, name, price FROM products
       WHERE status = 'active' ORDER BY name ASC LIMIT ?`
    )
    .bind(limit)
    .all<{ id: string; name: string; price: number }>();
  return results;
}
