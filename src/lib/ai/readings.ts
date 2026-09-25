/** Everything the assistant is allowed to look at, and nothing else.
 *
 * This is a closed list on purpose. The assistant does not write SQL and is
 * never handed a query to run -- it names a reading from the menu below, and
 * this file decides what that name means. A model that hallucinates a reading
 * gets nothing back; a model talked into asking for something clever gets
 * nothing back either, because "something clever" is not on the list.
 *
 * What is deliberately absent matters as much as what is here. There is no
 * reading that returns a customer's name, phone number or address, and none
 * that returns a row from `users`, `sessions` or `site_settings`. The
 * assistant can tell the owner that repeat buyers are 23% of orders and that
 * Dhaka is the busiest district; it cannot tell them who bought what, because
 * answering an advertising question has never required knowing that, and a
 * column that is never selected cannot leak.
 *
 * One deliberate exception: an order can be looked up by its number, because
 * "what happened to order ZU-1043?" is the question an owner actually asks
 * most. Even then the reading returns the order's state and totals, not the
 * shopper's contact details. */

import { getDB } from "@/lib/db";
import {
  getCustomerStats,
  getDashboardSummary,
  getOrderCounts,
  getProductStats,
  getTopProductsDetailed,
  listAdminProducts,
  listOrders,
} from "@/lib/adminData";
import { getAudienceShape, listPriorLessons } from "@/lib/marketing/data";
import { listCampaigns, getMarketingOverview } from "@/lib/marketing/campaigns";

/** The menu, as the model sees it. Each line is one thing it can ask for. */
export const READINGS = {
  shop_overview: "Headline figures: revenue, orders, customers and their recent trend.",
  order_counts: "How many orders sit in each status right now.",
  recent_orders: "The most recent orders with their status and total.",
  order_lookup: "One order by its number, e.g. ZU-1043. Needs `query`.",
  product_stats: "How many products exist, how many are active, pending or out of stock.",
  top_products: "Best selling products over the last 30 days, with units and revenue.",
  low_stock: "Products whose stock has run low or out.",
  product_lookup: "Products matching a name. Needs `query`.",
  customer_stats: "How many customers there are and how many are new.",
  audience_shape: "Where orders come from and how often people buy again. No personal data.",
  marketing_overview: "Today's ad spend, CPA and ROAS, plus anything awaiting approval.",
  campaigns: "Marketing campaigns that have been drafted, approved or run.",
  marketing_lessons: "What past campaigns concluded, for this shop.",
} as const;

export type ReadingName = keyof typeof READINGS;

export function isReadingName(value: string): value is ReadingName {
  return Object.prototype.hasOwnProperty.call(READINGS, value);
}

export interface ReadingRequest {
  name: ReadingName;
  /** Free text for the readings that take one, e.g. an order number. */
  query?: string;
}

export interface Reading {
  name: ReadingName;
  /** What came back, already shaped for a prompt. */
  value: unknown;
}

/** Caps every list so a chatty question cannot drag the whole catalogue into
 * a prompt and be billed for it. */
const LIMIT = 15;

async function runOne(request: ReadingRequest): Promise<unknown> {
  const query = (request.query ?? "").trim();

  switch (request.name) {
    case "shop_overview":
      return getDashboardSummary("30d");

    case "order_counts":
      return getOrderCounts();

    case "recent_orders": {
      const page = await listOrders({ page: 1 });
      return page.rows.slice(0, LIMIT).map((row) => ({
        orderNumber: row.orderNumber,
        status: row.status,
        paymentStatus: row.paymentStatus,
        total: row.total,
        placedAt: row.placedAt,
        items: row.itemCount,
      }));
    }

    case "order_lookup": {
      if (!query) return { error: "No order number was given." };
      const page = await listOrders({ search: query, page: 1 });
      return page.rows.slice(0, 5).map((row) => ({
        orderNumber: row.orderNumber,
        status: row.status,
        paymentStatus: row.paymentStatus,
        total: row.total,
        placedAt: row.placedAt,
        items: row.itemCount,
      }));
    }

    case "product_stats":
      return getProductStats();

    case "top_products":
      return getTopProductsDetailed(LIMIT, "30d");

    case "low_stock": {
      // Its own query rather than a filter on the product list, which has no
      // low-stock option. Mirrors what the admin's own badge counts --
      // products that track their units, over their active variants, at or
      // below the threshold those variants carry. Unlike the badge this keeps
      // the ones already at zero, because "what has run out?" is the question
      // an owner asks in the same breath, and `stock` tells the two apart.
      const db = await getDB();
      const { results } = await db
        .prepare(
          `SELECT p.name, p.price, p.status,
                  COALESCE(SUM(v.stock_quantity), 0) AS stock,
                  COALESCE(MIN(v.low_stock_threshold), 5) AS threshold
           FROM products p
           JOIN product_variants v ON v.product_id = p.id AND v.is_active = 1
           WHERE p.status != 'archived' AND p.track_inventory = 1
           GROUP BY p.id
           HAVING stock <= threshold
           ORDER BY stock ASC
           LIMIT ?`
        )
        .bind(LIMIT)
        .all<{ name: string; price: number; status: string; stock: number; threshold: number }>();
      return results;
    }

    case "product_lookup": {
      if (!query) return { error: "No product name was given." };
      const page = await listAdminProducts({ search: query, page: 1 });
      return page.rows.slice(0, LIMIT).map((row) => ({
        id: row.id,
        name: row.name,
        price: row.price,
        stock: row.stock,
        status: row.status,
      }));
    }

    case "customer_stats":
      return getCustomerStats();

    case "audience_shape":
      return getAudienceShape();

    case "marketing_overview":
      return getMarketingOverview();

    case "campaigns":
      return listCampaigns(LIMIT);

    case "marketing_lessons":
      return listPriorLessons(null, LIMIT);

    default:
      return { error: "That reading does not exist." };
  }
}

/**
 * Fetches the requested readings, all at once.
 *
 * `Promise.all` rather than a loop because these do not depend on each other
 * and the database is in Singapore -- four readings in series is four round
 * trips from Dhaka for an answer the owner is waiting on.
 *
 * A reading that throws comes back as an error value rather than taking the
 * whole answer down: a question that needed four figures and got three is
 * still worth answering, as long as the answer says which one is missing.
 */
export async function fetchReadings(requests: ReadingRequest[]): Promise<Reading[]> {
  const wanted = requests.filter((request) => isReadingName(request.name)).slice(0, 6);

  return Promise.all(
    wanted.map(async (request) => {
      try {
        return { name: request.name, value: await runOne(request) };
      } catch (error) {
        console.error("assistant reading failed", { name: request.name, error });
        return {
          name: request.name,
          value: { error: "That reading could not be loaded." },
        };
      }
    })
  );
}

/** Confirms the database is reachable before the assistant claims anything
 * about the shop. Used by the page to warn rather than to answer wrongly. */
export async function readingsAvailable(): Promise<boolean> {
  try {
    const db = await getDB();
    await db.prepare("SELECT 1").first();
    return true;
  } catch {
    return false;
  }
}
