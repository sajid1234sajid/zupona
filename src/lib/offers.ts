/** The offers hub: flash sale resolution, deal collections and the savings
 * arithmetic behind the page.
 *
 * Every figure here now comes from the database, so a flash sale scheduled on
 * the admin Marketing page and a coupon created on the Coupons page both show
 * up on `/offers` without a deploy. Prices are whole Taka (see `formatPrice`),
 * so everything returned is an integer and safe to add up.
 *
 * When no flash sale is running the sale section simply has nothing in it --
 * that is the honest state, rather than inventing a demo sale. */

import { getDB } from "@/lib/db";
import { toSummary } from "@/lib/categories";
import { listStoreProducts, type StoreProductCard } from "@/lib/storefront";
import type { FlashSaleItem, OfferCoupon, ProductSummary } from "@/types";

import { getShopSettings } from "@/lib/shopSettings";

/** Kept as a named export for the components that still import it, but the
 * live value now comes from `freeDeliveryProgress`, which reads settings. */
export const FREE_DELIVERY_THRESHOLD = 999;

/* -------------------------------------------------------------------------- */
/* Flash sales                                                                */
/* -------------------------------------------------------------------------- */

interface SaleRow {
  id: string;
  name: string;
  starts_at: string;
  ends_at: string;
}

/** The sale that is live right now, if any. Scheduled and finished sales are
 * both excluded by the same clause, so the storefront can never show a sale
 * that has not started. */
async function runningSale(): Promise<SaleRow | null> {
  const db = await getDB();
  return db
    .prepare(
      `SELECT id, name, starts_at, ends_at FROM flash_sales
       WHERE is_active = 1
         AND datetime(starts_at) <= datetime('now')
         AND datetime(ends_at) > datetime('now')
       ORDER BY starts_at DESC LIMIT 1`
    )
    .first<SaleRow>();
}

export async function flashSaleWindow(): Promise<{ startsAt: Date; endsAt: Date } | null> {
  const sale = await runningSale();
  if (!sale) return null;

  return {
    startsAt: new Date(`${sale.starts_at.replace(" ", "T")}Z`),
    endsAt: new Date(`${sale.ends_at.replace(" ", "T")}Z`),
  };
}

export async function flashSaleName(): Promise<string | null> {
  const sale = await runningSale();
  return sale?.name ?? null;
}

interface SaleItemRow {
  product_id: string;
  sale_price: number;
  stock_limit: number | null;
  sold_count: number;
  name: string;
  price: number;
  old_price: number;
  rating_avg: number;
  rating_count: number;
  image: string | null;
}

async function runningSaleItems(): Promise<SaleItemRow[]> {
  const sale = await runningSale();
  if (!sale) return [];

  const db = await getDB();
  const { results } = await db
    .prepare(
      `SELECT f.product_id, f.sale_price, f.stock_limit, f.sold_count,
              p.name, p.price, p.old_price, p.rating_avg, p.rating_count,
              (SELECT url FROM product_images i WHERE i.product_id = p.id
                ORDER BY i.is_primary DESC, i.sort_order ASC LIMIT 1) AS image
       FROM flash_sale_items f
       JOIN products p ON p.id = f.product_id
       WHERE f.flash_sale_id = ? AND p.status = 'active'`
    )
    .bind(sale.id)
    .all<SaleItemRow>();

  return results;
}

/** Resolves each sale line against the catalog. A line whose product has been
 * archived since is dropped rather than rendering an empty card. */
export async function flashSaleItems(): Promise<FlashSaleItem[]> {
  const rows = await runningSaleItems();

  return rows.map((row) => {
    // A null stock_limit means "no cap"; it can never sell out, so the
    // claimed bar stays at zero rather than dividing by nothing.
    const limit = row.stock_limit ?? 0;
    const soldCount = limit > 0 ? Math.min(row.sold_count, limit) : row.sold_count;

    return {
      product: {
        id: row.product_id,
        name: row.name,
        image: row.image ?? "",
        price: row.price,
        oldPrice: row.old_price,
        discountPercent:
          row.old_price > row.price
            ? Math.round(((row.old_price - row.price) / row.old_price) * 100)
            : 0,
        rating: row.rating_avg,
        reviews: row.rating_count,
      },
      salePrice: row.sale_price,
      saving: Math.max(0, row.price - row.sale_price),
      stockLimit: limit,
      soldCount,
      claimedPercent: limit > 0 ? Math.round((soldCount / limit) * 100) : 0,
      soldOut: limit > 0 && soldCount >= limit,
    } satisfies FlashSaleItem;
  });
}

/** Sale price for one product, or null when it is not in the running sale or
 * its allocation is gone. */
export async function flashPriceFor(productId: string): Promise<number | null> {
  const prices = await flashPriceMap();
  return prices.get(productId) ?? null;
}

export async function flashPriceMap(): Promise<Map<string, number>> {
  const rows = await runningSaleItems();
  const map = new Map<string, number>();

  for (const row of rows) {
    const limit = row.stock_limit ?? 0;
    if (limit > 0 && row.sold_count >= limit) continue;
    map.set(row.product_id, row.sale_price);
  }

  return map;
}

/* -------------------------------------------------------------------------- */
/* Deal collections                                                           */
/* -------------------------------------------------------------------------- */

export type DealTabId = "all" | "under1000" | "biggest" | "bestseller";

export const DEAL_TABS: { id: DealTabId; label: string }[] = [
  { id: "all", label: "All Deals" },
  { id: "under1000", label: "Under ৳1,000" },
  { id: "biggest", label: "25%+ Off" },
  { id: "bestseller", label: "Best Sellers" },
];

export function isDealTab(value: string | undefined): value is DealTabId {
  return DEAL_TABS.some((tab) => tab.id === value);
}

function matchesTab(product: StoreProductCard, tab: DealTabId): boolean {
  switch (tab) {
    case "under1000":
      return product.price < 1000;
    case "biggest":
      return product.discountPercent >= 25;
    case "bestseller":
      return product.bestSeller;
    case "all":
    default:
      return product.discountPercent > 0;
  }
}

/** Deals for one tab, deepest discount first — the order shoppers scan for. */
export async function dealProducts(tab: DealTabId = "all"): Promise<ProductSummary[]> {
  const products = await listStoreProducts({ sort: "discount" });
  return products
    .filter((product) => matchesTab(product, tab))
    .sort((a, b) => b.discountPercent - a.discountPercent || b.reviews - a.reviews)
    .map(toSummary);
}

export async function dealCount(tab: DealTabId): Promise<number> {
  const products = await listStoreProducts({ sort: "discount" });
  return products.filter((product) => matchesTab(product, tab)).length;
}

/* -------------------------------------------------------------------------- */
/* Savings                                                                    */
/* -------------------------------------------------------------------------- */

/** Total Taka off across every live offer — the headline figure on the page.
 *
 * Counted as one saving per product: a product in the flash sale is measured
 * against its original price, not against its already-discounted price, so the
 * two never double-count the same item. */
export async function totalSavingsAvailable(): Promise<number> {
  const [products, flashPrices] = await Promise.all([listStoreProducts(), flashPriceMap()]);

  return products.reduce((total, product) => {
    const sellingPrice = flashPrices.get(product.id) ?? product.price;
    return total + Math.max(0, product.oldPrice - sellingPrice);
  }, 0);
}

/** Deepest discount anywhere in the catalog, for the "up to N% off" line. */
export async function headlineDiscount(): Promise<number> {
  const [products, flashPrices] = await Promise.all([listStoreProducts(), flashPriceMap()]);

  return products.reduce((best, product) => {
    if (!product.oldPrice) return best;
    const sellingPrice = flashPrices.get(product.id) ?? product.price;
    const percent = Math.round(((product.oldPrice - sellingPrice) / product.oldPrice) * 100);
    return Math.max(best, percent);
  }, 0);
}

/* -------------------------------------------------------------------------- */
/* Coupons and delivery                                                       */
/* -------------------------------------------------------------------------- */

/** Vouchers shown in the offers wallet, read from the coupons an admin has
 * created. Only codes that are usable right now are listed, so a shopper never
 * copies one that checkout will refuse. */
export async function listOfferCoupons(): Promise<OfferCoupon[]> {
  const db = await getDB();
  const { results } = await db
    .prepare(
      `SELECT code, description, discount_type, discount_value, min_order_amount,
              max_discount_amount, ends_at
       FROM coupons
       WHERE is_active = 1
         AND (starts_at IS NULL OR datetime(starts_at) <= datetime('now'))
         AND (ends_at IS NULL OR datetime(ends_at) > datetime('now'))
         AND (usage_limit IS NULL OR usage_count < usage_limit)
       ORDER BY discount_value DESC LIMIT 12`
    )
    .all<{
      code: string;
      description: string | null;
      discount_type: "percent" | "fixed" | "free_shipping";
      discount_value: number;
      min_order_amount: number;
      max_discount_amount: number | null;
      ends_at: string | null;
    }>();

  return results.map((row) => ({
    code: row.code,
    title:
      row.discount_type === "free_shipping"
        ? "Free delivery"
        : row.discount_type === "percent"
          ? `${row.discount_value}% off`
          : `৳ ${row.discount_value.toLocaleString("en-US")} off`,
    description: row.description ?? "Apply this code at checkout.",
    discountType: row.discount_type,
    discountValue: row.discount_value,
    minOrderAmount: row.min_order_amount,
    maxDiscountAmount: row.max_discount_amount,
    validity: describeValidity(row.ends_at),
  }));
}

/** "Ends in 3 days" reads better than a timestamp on a voucher tile. */
function describeValidity(endsAt: string | null): string {
  if (!endsAt) return "No expiry";

  const end = new Date(`${endsAt.replace(" ", "T")}Z`).getTime();
  const days = Math.ceil((end - Date.now()) / (24 * 60 * 60 * 1000));

  if (days <= 0) return "Ends today";
  if (days === 1) return "Ends tomorrow";
  if (days <= 30) return `Ends in ${days} days`;
  return "Plenty of time left";
}

/** How far a cart is from free delivery, against the threshold configured in
 * the admin Settings page. `remaining` is 0 once it qualifies.
 *
 * A threshold of 0 means free delivery is switched off, which is reported as
 * "never qualified" rather than "always qualified". */
export async function freeDeliveryProgress(subtotal: number): Promise<{
  threshold: number;
  remaining: number;
  percent: number;
  qualified: boolean;
  enabled: boolean;
}> {
  const { freeShippingThreshold } = await getShopSettings();

  if (freeShippingThreshold <= 0) {
    return { threshold: 0, remaining: 0, percent: 0, qualified: false, enabled: false };
  }

  const remaining = Math.max(0, freeShippingThreshold - subtotal);
  return {
    threshold: freeShippingThreshold,
    remaining,
    percent: Math.min(100, Math.round((subtotal / freeShippingThreshold) * 100)),
    qualified: remaining === 0,
    enabled: true,
  };
}
