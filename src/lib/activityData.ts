/** Reads for Admin -> Activity: who looked at what, who added it to a cart,
 * who bought, and where they came from.
 *
 * Everything comes out of `visitor_events` (see db/migrations/0026). A
 * "visitor" is one browser. It has no name until it does something that
 * gives it one -- signs in, or places an order -- and from then on every row
 * of that browser, earlier ones included, reads as that person.
 *
 * Each page is two trips to D1: one batch for the figures and the rows, then
 * one batch to put names to the visitors those rows mention. */

import { getDB } from "@/lib/db";
import { SHOP_TIME_ZONE } from "@/lib/format";

/* -------------------------------------------------------------------------- */
/* Ranges                                                                     */
/* -------------------------------------------------------------------------- */

export const ACTIVITY_RANGES = [
  { key: "today", label: "Today" },
  { key: "7d", label: "Last 7 Days" },
  { key: "30d", label: "Last 30 Days" },
  { key: "90d", label: "Last 90 Days" },
] as const;

export type ActivityRange = (typeof ACTIVITY_RANGES)[number]["key"];

export function asActivityRange(value: string | undefined): ActivityRange {
  return ACTIVITY_RANGES.some((range) => range.key === value) ? (value as ActivityRange) : "7d";
}

function sqlTime(date: Date): string {
  return date.toISOString().slice(0, 19).replace("T", " ");
}

/** The UTC moment a range starts, in the shape `created_at` is stored in.
 * "Today" is the shop's day in Dhaka, not the server's. */
export function rangeStart(range: ActivityRange): string {
  const now = new Date();
  if (range === "today") {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: SHOP_TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(now);
    // Dhaka is UTC+6 all year, with no daylight saving.
    return sqlTime(new Date(`${parts}T00:00:00+06:00`));
  }
  const days = Number(range.replace("d", ""));
  return sqlTime(new Date(now.getTime() - days * 24 * 60 * 60 * 1000));
}

/* -------------------------------------------------------------------------- */
/* Shapes                                                                     */
/* -------------------------------------------------------------------------- */

export const EVENT_LABELS: Record<string, string> = {
  page_view: "Viewed a page",
  product_view: "Viewed product",
  cart_view: "Opened cart",
  checkout: "Opened checkout",
  add_to_cart: "Added to cart",
  buy_now: "Tapped Buy Now",
  purchase: "Placed order",
};

/** The feed's filter chips, each a set of events. */
export const FEED_FILTERS: Record<string, { label: string; events: string[] }> = {
  all: { label: "Everything", events: [] },
  product: { label: "Product views", events: ["product_view"] },
  cart: { label: "Add to cart", events: ["add_to_cart", "buy_now"] },
  checkout: { label: "Checkout", events: ["checkout"] },
  purchase: { label: "Orders", events: ["purchase"] },
};

export const SOURCE_LABELS: Record<string, string> = {
  facebook_ad: "Facebook Ad",
  facebook: "Facebook",
  instagram: "Instagram",
  messenger: "Messenger",
  whatsapp: "WhatsApp",
  youtube: "YouTube",
  tiktok: "TikTok",
  google: "Google",
  bing: "Bing",
  direct: "Direct / typed",
  other: "Other sites",
  unknown: "Unknown",
};

export function sourceLabel(source: string | null): string {
  return SOURCE_LABELS[source ?? "unknown"] ?? source ?? "Unknown";
}

export interface Person {
  visitorId: string;
  /** A real name when one is known, otherwise "Visitor 3F2A9C". */
  name: string;
  phone: string | null;
  /** The account, when the visitor is a signed-in or ordering customer. */
  customerId: string | null;
  known: boolean;
  source: string | null;
  campaign: string | null;
  referrer: string | null;
}

export interface FeedRow {
  id: number;
  visitorId: string;
  event: string;
  path: string | null;
  productId: string | null;
  productName: string | null;
  productSlug: string | null;
  productImage: string | null;
  orderId: string | null;
  orderNumber: string | null;
  quantity: number | null;
  value: number | null;
  device: string | null;
  createdAt: string;
}

export interface Funnel {
  visitors: number;
  viewed: number;
  carted: number;
  checkout: number;
  bought: number;
  pageViews: number;
  productViews: number;
  orders: number;
  revenue: number;
}

export interface SourceRow {
  source: string;
  visitors: number;
  carted: number;
  orders: number;
  revenue: number;
}

export interface CampaignRow {
  campaign: string;
  visitors: number;
  carted: number;
  orders: number;
  revenue: number;
}

export interface ProductActivityRow {
  id: string;
  name: string;
  image: string | null;
  viewers: number;
  views: number;
  carted: number;
  buyers: number;
  units: number;
}

export interface AbandonedRow {
  visitorId: string;
  lastAt: string;
  adds: number;
  value: number;
  productName: string | null;
  productImage: string | null;
}

/* -------------------------------------------------------------------------- */
/* Names                                                                      */
/* -------------------------------------------------------------------------- */

const IMAGE_OF = (alias: string) =>
  `(SELECT url FROM product_images WHERE product_id = ${alias}.id ORDER BY is_primary DESC, sort_order ASC LIMIT 1)`;

function anonymousName(visitorId: string): string {
  const core = visitorId.startsWith("u:") ? visitorId.slice(2) : visitorId;
  return `Visitor ${core.replace(/-/g, "").slice(0, 6).toUpperCase()}`;
}

/** Puts names, numbers and an arrival source to a set of visitors.
 *
 * A name comes from the most recent order the browser placed, else from the
 * customer account it was signed in to. A guest account's "Guest" is not a
 * name and is skipped. */
export async function resolvePeople(visitorIds: string[]): Promise<Map<string, Person>> {
  const ids = [...new Set(visitorIds)].slice(0, 90);
  const people = new Map<string, Person>();
  for (const id of ids) {
    people.set(id, {
      visitorId: id,
      name: anonymousName(id),
      phone: null,
      customerId: null,
      known: false,
      source: null,
      campaign: null,
      referrer: null,
    });
  }
  if (ids.length === 0) return people;

  const db = await getDB();
  const marks = ids.map(() => "?").join(", ");

  const [ordersResult, accountsResult, sourcesResult] = await db.batch<Record<string, string | null>>([
    db
      .prepare(
        `SELECT e.visitor_id, o.user_id, o.address_full_name AS name, o.address_phone AS phone
         FROM visitor_events e JOIN orders o ON o.id = e.order_id
         WHERE e.event = 'purchase' AND e.visitor_id IN (${marks})
         ORDER BY e.id DESC`
      )
      .bind(...ids),
    db
      .prepare(
        `SELECT e.visitor_id, u.id AS user_id, u.name, u.phone, MAX(e.id) AS last_id
         FROM visitor_events e JOIN users u ON u.id = e.user_id
         WHERE e.visitor_id IN (${marks}) AND u.role != 'guest'
         GROUP BY e.visitor_id, u.id
         ORDER BY last_id DESC`
      )
      .bind(...ids),
    // SQLite returns the other columns from the row MIN() picked, which is the
    // visit's first recorded arrival.
    db
      .prepare(
        `SELECT visitor_id, source, campaign, referrer, MIN(id) AS first_id
         FROM visitor_events
         WHERE visitor_id IN (${marks}) AND source IS NOT NULL
         GROUP BY visitor_id`
      )
      .bind(...ids),
  ]);

  for (const row of accountsResult.results ?? []) {
    const person = people.get(row.visitor_id as string);
    if (!person || person.known) continue;
    person.name = (row.name as string) || person.name;
    person.phone = row.phone ?? null;
    person.customerId = row.user_id ?? null;
    person.known = true;
  }

  // An order's name beats an account's: it is what the shopper typed for the
  // rider, and a guest's only name.
  const named = new Set<string>();
  for (const row of ordersResult.results ?? []) {
    const visitorId = row.visitor_id as string;
    const person = people.get(visitorId);
    if (!person || named.has(visitorId)) continue;
    named.add(visitorId);
    person.name = (row.name as string) || person.name;
    person.phone = row.phone ?? person.phone;
    person.customerId = row.user_id ?? person.customerId;
    person.known = true;
  }

  for (const row of sourcesResult.results ?? []) {
    const person = people.get(row.visitor_id as string);
    if (!person) continue;
    person.source = row.source ?? null;
    person.campaign = row.campaign ?? null;
    person.referrer = row.referrer ?? null;
  }

  return people;
}

/* -------------------------------------------------------------------------- */
/* The overview page                                                          */
/* -------------------------------------------------------------------------- */

export const FEED_PAGE_SIZE = 40;

export interface ActivityOverview {
  funnel: Funnel;
  sources: SourceRow[];
  campaigns: CampaignRow[];
  products: ProductActivityRow[];
  abandoned: AbandonedRow[];
  feed: FeedRow[];
  feedTotal: number;
  people: Map<string, Person>;
}

const FEED_SELECT = `
  SELECT e.id, e.visitor_id, e.event, e.path, e.product_id, e.order_id, e.quantity, e.value,
         e.device, e.created_at,
         p.name AS product_name, p.slug AS product_slug, ${IMAGE_OF("p")} AS product_image,
         o.order_number
  FROM visitor_events e
  LEFT JOIN products p ON p.id = e.product_id
  LEFT JOIN orders o ON o.id = e.order_id`;

interface FeedSqlRow {
  id: number;
  visitor_id: string;
  event: string;
  path: string | null;
  product_id: string | null;
  order_id: string | null;
  quantity: number | null;
  value: number | null;
  device: string | null;
  created_at: string;
  product_name: string | null;
  product_slug: string | null;
  product_image: string | null;
  order_number: string | null;
}

function toFeedRow(row: FeedSqlRow): FeedRow {
  return {
    id: row.id,
    visitorId: row.visitor_id,
    event: row.event,
    path: row.path,
    productId: row.product_id,
    productName: row.product_name,
    productSlug: row.product_slug,
    productImage: row.product_image,
    orderId: row.order_id,
    orderNumber: row.order_number,
    quantity: row.quantity,
    value: row.value,
    device: row.device,
    createdAt: row.created_at,
  };
}

export async function getActivityOverview(options: {
  range: ActivityRange;
  filter: string;
  page: number;
}): Promise<ActivityOverview> {
  const db = await getDB();
  const since = rangeStart(options.range);
  const events = (FEED_FILTERS[options.filter] ?? FEED_FILTERS.all).events;
  // Plain page views are noise in a feed about shopping; "Everything" still
  // leaves them out and the funnel counts them instead.
  const feedEvents = events.length > 0 ? events : Object.keys(EVENT_LABELS).filter((e) => e !== "page_view");
  const eventMarks = feedEvents.map(() => "?").join(", ");
  const offset = (Math.max(1, options.page) - 1) * FEED_PAGE_SIZE;

  const [funnelR, sourcesR, campaignsR, productsR, boughtR, abandonedR, feedR, feedCountR] =
    await db.batch<Record<string, unknown>>([
      db
        .prepare(
          `SELECT
             COUNT(DISTINCT visitor_id) AS visitors,
             COUNT(DISTINCT CASE WHEN event = 'product_view' THEN visitor_id END) AS viewed,
             COUNT(DISTINCT CASE WHEN event IN ('add_to_cart', 'buy_now') THEN visitor_id END) AS carted,
             COUNT(DISTINCT CASE WHEN event = 'checkout' THEN visitor_id END) AS checkout,
             COUNT(DISTINCT CASE WHEN event = 'purchase' THEN visitor_id END) AS bought,
             COALESCE(SUM(event IN ('page_view', 'product_view', 'cart_view', 'checkout')), 0) AS page_views,
             COALESCE(SUM(event = 'product_view'), 0) AS product_views,
             COALESCE(SUM(event = 'purchase'), 0) AS orders,
             COALESCE(SUM(CASE WHEN event = 'purchase' THEN value END), 0) AS revenue
           FROM visitor_events WHERE created_at >= ?`
        )
        .bind(since),
      db
        .prepare(
          `WITH v AS (
             SELECT visitor_id,
                    MAX(event IN ('add_to_cart', 'buy_now')) AS carted,
                    SUM(event = 'purchase') AS orders,
                    SUM(CASE WHEN event = 'purchase' THEN value ELSE 0 END) AS revenue
             FROM visitor_events WHERE created_at >= ?1 GROUP BY visitor_id
           ),
           f AS (
             SELECT visitor_id, source, MIN(id) AS first_id
             FROM visitor_events WHERE created_at >= ?1 AND source IS NOT NULL
             GROUP BY visitor_id
           )
           SELECT COALESCE(f.source, 'unknown') AS source, COUNT(*) AS visitors,
                  SUM(v.carted) AS carted, SUM(v.orders) AS orders, SUM(v.revenue) AS revenue
           FROM v LEFT JOIN f ON f.visitor_id = v.visitor_id
           GROUP BY 1 ORDER BY visitors DESC`
        )
        .bind(since),
      db
        .prepare(
          `WITH c AS (
             SELECT visitor_id, campaign, MIN(id) AS first_id
             FROM visitor_events WHERE created_at >= ?1 AND campaign IS NOT NULL
             GROUP BY visitor_id
           ),
           v AS (
             SELECT visitor_id,
                    MAX(event IN ('add_to_cart', 'buy_now')) AS carted,
                    SUM(event = 'purchase') AS orders,
                    SUM(CASE WHEN event = 'purchase' THEN value ELSE 0 END) AS revenue
             FROM visitor_events WHERE created_at >= ?1 AND visitor_id IN (SELECT visitor_id FROM c)
             GROUP BY visitor_id
           )
           SELECT c.campaign, COUNT(*) AS visitors, SUM(v.carted) AS carted,
                  SUM(v.orders) AS orders, SUM(v.revenue) AS revenue
           FROM c JOIN v ON v.visitor_id = c.visitor_id
           GROUP BY c.campaign ORDER BY visitors DESC LIMIT 10`
        )
        .bind(since),
      db
        .prepare(
          `SELECT p.id, p.name, ${IMAGE_OF("p")} AS image,
                  COUNT(DISTINCT CASE WHEN e.event = 'product_view' THEN e.visitor_id END) AS viewers,
                  SUM(e.event = 'product_view') AS views,
                  COUNT(DISTINCT CASE WHEN e.event IN ('add_to_cart', 'buy_now') THEN e.visitor_id END) AS carted
           FROM visitor_events e JOIN products p ON p.id = e.product_id
           WHERE e.created_at >= ? AND e.product_id IS NOT NULL
           GROUP BY p.id
           ORDER BY viewers DESC, carted DESC
           LIMIT 20`
        )
        .bind(since),
      db
        .prepare(
          `SELECT oi.product_id, COUNT(DISTINCT e.visitor_id) AS buyers, SUM(oi.quantity) AS units
           FROM visitor_events e JOIN order_items oi ON oi.order_id = e.order_id
           WHERE e.event = 'purchase' AND e.created_at >= ?
           GROUP BY oi.product_id`
        )
        .bind(since),
      // Added something and has not ordered since. The latest add names the
      // product, which is usually the one worth a phone call about.
      db
        .prepare(
          `WITH a AS (
             SELECT e.visitor_id, MAX(e.id) AS last_id, MAX(e.created_at) AS last_at,
                    COUNT(*) AS adds, COALESCE(SUM(e.value), 0) AS value
             FROM visitor_events e
             WHERE e.event IN ('add_to_cart', 'buy_now') AND e.created_at >= ?
               AND NOT EXISTS (
                 SELECT 1 FROM visitor_events x
                 WHERE x.visitor_id = e.visitor_id AND x.event = 'purchase' AND x.id > e.id
               )
             GROUP BY e.visitor_id
             ORDER BY last_id DESC
             LIMIT 15
           )
           SELECT a.visitor_id, a.last_at, a.adds, a.value, p.name AS product_name,
                  ${IMAGE_OF("p")} AS product_image
           FROM a
           JOIN visitor_events l ON l.id = a.last_id
           LEFT JOIN products p ON p.id = l.product_id
           ORDER BY a.last_id DESC`
        )
        .bind(since),
      db
        .prepare(
          `${FEED_SELECT}
           WHERE e.created_at >= ? AND e.event IN (${eventMarks})
           ORDER BY e.id DESC LIMIT ? OFFSET ?`
        )
        .bind(since, ...feedEvents, FEED_PAGE_SIZE, offset),
      db
        .prepare(
          `SELECT COUNT(*) AS n FROM visitor_events WHERE created_at >= ? AND event IN (${eventMarks})`
        )
        .bind(since, ...feedEvents),
    ]);

  const f = (funnelR.results?.[0] ?? {}) as Record<string, number | null>;
  const funnel: Funnel = {
    visitors: f.visitors ?? 0,
    viewed: f.viewed ?? 0,
    carted: f.carted ?? 0,
    checkout: f.checkout ?? 0,
    bought: f.bought ?? 0,
    pageViews: f.page_views ?? 0,
    productViews: f.product_views ?? 0,
    orders: f.orders ?? 0,
    revenue: f.revenue ?? 0,
  };

  const num = (value: unknown) => Number(value ?? 0);

  const sources: SourceRow[] = (sourcesR.results ?? []).map((row) => ({
    source: String(row.source),
    visitors: num(row.visitors),
    carted: num(row.carted),
    orders: num(row.orders),
    revenue: num(row.revenue),
  }));

  const campaigns: CampaignRow[] = (campaignsR.results ?? []).map((row) => ({
    campaign: String(row.campaign),
    visitors: num(row.visitors),
    carted: num(row.carted),
    orders: num(row.orders),
    revenue: num(row.revenue),
  }));

  const bought = new Map(
    (boughtR.results ?? []).map((row) => [String(row.product_id), { buyers: num(row.buyers), units: num(row.units) }])
  );
  const products: ProductActivityRow[] = (productsR.results ?? []).map((row) => ({
    id: String(row.id),
    name: String(row.name),
    image: (row.image as string | null) ?? null,
    viewers: num(row.viewers),
    views: num(row.views),
    carted: num(row.carted),
    buyers: bought.get(String(row.id))?.buyers ?? 0,
    units: bought.get(String(row.id))?.units ?? 0,
  }));

  const abandoned: AbandonedRow[] = (abandonedR.results ?? []).map((row) => ({
    visitorId: String(row.visitor_id),
    lastAt: String(row.last_at),
    adds: num(row.adds),
    value: num(row.value),
    productName: (row.product_name as string | null) ?? null,
    productImage: (row.product_image as string | null) ?? null,
  }));

  const feed = ((feedR.results ?? []) as unknown as FeedSqlRow[]).map(toFeedRow);
  const feedTotal = num(feedCountR.results?.[0]?.n);

  const people = await resolvePeople([
    ...feed.map((row) => row.visitorId),
    ...abandoned.map((row) => row.visitorId),
  ]);

  return { funnel, sources, campaigns, products, abandoned, feed, feedTotal, people };
}

/* -------------------------------------------------------------------------- */
/* One visitor                                                                */
/* -------------------------------------------------------------------------- */

export interface VisitorDetail {
  person: Person;
  /** Every browser the customer used, when looked up by customer. */
  visitorIds: string[];
  events: FeedRow[];
  firstSeen: string | null;
  lastSeen: string | null;
  devices: string[];
}

/** One visitor's whole history, newest first. `key` is a visitor id, or
 * `c-<user id>` for every browser a customer has been seen in. */
export async function getVisitorDetail(key: string): Promise<VisitorDetail | null> {
  const db = await getDB();
  const byCustomer = key.startsWith("c-");
  const customerId = byCustomer ? key.slice(2) : null;

  const scope = byCustomer
    ? "e.visitor_id IN (SELECT DISTINCT visitor_id FROM visitor_events WHERE user_id = ?)"
    : "e.visitor_id = ?";

  const { results } = await db
    .prepare(`${FEED_SELECT} WHERE ${scope} ORDER BY e.id DESC LIMIT 500`)
    .bind(byCustomer ? customerId : key)
    .all<FeedSqlRow>();

  const events = (results ?? []).map(toFeedRow);
  if (events.length === 0) return null;

  const visitorIds = [...new Set(events.map((row) => row.visitorId))];
  const people = await resolvePeople(visitorIds);

  // Several browsers of one customer: the one that knows the most speaks.
  const person =
    [...people.values()].find((candidate) => candidate.known) ?? people.get(visitorIds[0])!;

  return {
    person,
    visitorIds,
    events,
    firstSeen: events[events.length - 1]?.createdAt ?? null,
    lastSeen: events[0]?.createdAt ?? null,
    devices: [...new Set(events.map((row) => row.device).filter((d): d is string => Boolean(d)))],
  };
}

/** Whether a customer has any recorded activity, for the link on their page. */
export async function customerHasActivity(userId: string): Promise<boolean> {
  try {
    const db = await getDB();
    const row = await db
      .prepare("SELECT 1 AS hit FROM visitor_events WHERE user_id = ? LIMIT 1")
      .bind(userId)
      .first<{ hit: number }>();
    return Boolean(row);
  } catch {
    return false;
  }
}
