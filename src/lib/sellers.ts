/** Marketplace sellers: onboarding, approval, storefronts and earnings.
 *
 * A seller is a store owned by a user. Products carry `seller_id` (NULL means
 * the platform sells it first-party), and each checkout order splits into one
 * `suborders` row per seller, which is what commission and payouts are
 * calculated from. */

import { cache } from "react";

import { getDB } from "@/lib/db";
import { AuthorizationError } from "@/lib/admin";
import { getCurrentUser } from "@/lib/session";
import type { AuthUser, Seller, SellerStatus } from "@/types";

interface SellerRow {
  id: string;
  user_id: string;
  store_name: string;
  slug: string;
  logo_url: string | null;
  banner_url: string | null;
  description: string | null;
  status: SellerStatus;
  commission_rate: number;
  rating_avg: number;
  rating_count: number;
  total_sales: number;
  created_at: string;
}

function toSeller(row: SellerRow): Seller {
  return {
    id: row.id,
    userId: row.user_id,
    storeName: row.store_name,
    slug: row.slug,
    logoUrl: row.logo_url,
    bannerUrl: row.banner_url,
    description: row.description,
    status: row.status,
    commissionRate: row.commission_rate,
    rating: row.rating_avg,
    ratingCount: row.rating_count,
    totalSales: row.total_sales,
    createdAt: row.created_at,
  };
}

const SELLER_COLUMNS = `id, user_id, store_name, slug, logo_url, banner_url, description,
                        status, commission_rate, rating_avg, rating_count, total_sales, created_at`;

export async function getSeller(sellerId: string): Promise<Seller | null> {
  const db = await getDB();
  const row = await db
    .prepare(`SELECT ${SELLER_COLUMNS} FROM sellers WHERE id = ?`)
    .bind(sellerId)
    .first<SellerRow>();
  return row ? toSeller(row) : null;
}

export async function getSellerBySlug(slug: string): Promise<Seller | null> {
  const db = await getDB();
  const row = await db
    .prepare(`SELECT ${SELLER_COLUMNS} FROM sellers WHERE slug = ?`)
    .bind(slug)
    .first<SellerRow>();
  return row ? toSeller(row) : null;
}

/** The store owned by a user, if they have one. */
export async function getSellerForUser(userId: string): Promise<Seller | null> {
  const db = await getDB();
  const row = await db
    .prepare(`SELECT ${SELLER_COLUMNS} FROM sellers WHERE user_id = ?`)
    .bind(userId)
    .first<SellerRow>();
  return row ? toSeller(row) : null;
}

export async function listSellers(status?: SellerStatus, limit = 50): Promise<Seller[]> {
  const db = await getDB();
  const where = status ? "WHERE status = ?" : "";
  const binds: unknown[] = status ? [status, limit] : [limit];

  const { results } = await db
    .prepare(`SELECT ${SELLER_COLUMNS} FROM sellers ${where} ORDER BY created_at DESC LIMIT ?`)
    .bind(...binds)
    .all<SellerRow>();

  return results.map(toSeller);
}

export interface SellerApplication {
  userId: string;
  storeName: string;
  slug: string;
  description?: string | null;
  logoUrl?: string | null;
  payoutMethod?: string | null;
  payoutDetails?: Record<string, string> | null;
}

/** Registers a store application. It starts as `pending` -- an admin has to
 * approve it before its products can go live. The owner's user role is
 * promoted to `seller` at the same time so the seller dashboard unlocks. */
export async function applyAsSeller(application: SellerApplication): Promise<string> {
  const db = await getDB();

  const existing = await db
    .prepare("SELECT id FROM sellers WHERE user_id = ? OR slug = ?")
    .bind(application.userId, application.slug)
    .first<{ id: string }>();
  if (existing) {
    throw new Error("A store already exists for this account or store URL.");
  }

  const sellerId = crypto.randomUUID();
  await db.batch([
    db
      .prepare(
        `INSERT INTO sellers (id, user_id, store_name, slug, description, logo_url,
                              payout_method, payout_details, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')`
      )
      .bind(
        sellerId,
        application.userId,
        application.storeName,
        application.slug,
        application.description ?? null,
        application.logoUrl ?? null,
        application.payoutMethod ?? null,
        application.payoutDetails ? JSON.stringify(application.payoutDetails) : null
      ),
    db
      .prepare("UPDATE users SET role = 'seller', updated_at = datetime('now') WHERE id = ? AND role = 'customer'")
      .bind(application.userId),
  ]);

  return sellerId;
}

export async function setSellerStatus(sellerId: string, status: SellerStatus): Promise<void> {
  const db = await getDB();
  await db
    .prepare(
      `UPDATE sellers
       SET status = ?, approved_at = CASE WHEN ? = 'approved' THEN datetime('now') ELSE approved_at END,
           updated_at = datetime('now')
       WHERE id = ?`
    )
    .bind(status, status, sellerId)
    .run();
}

export async function updateSellerProfile(
  sellerId: string,
  patch: { storeName?: string; description?: string | null; logoUrl?: string | null; bannerUrl?: string | null }
): Promise<void> {
  const db = await getDB();
  const columns: Record<string, unknown> = {
    store_name: patch.storeName,
    description: patch.description,
    logo_url: patch.logoUrl,
    banner_url: patch.bannerUrl,
  };

  const entries = Object.entries(columns).filter(([, value]) => value !== undefined);
  if (entries.length === 0) return;

  const assignments = entries.map(([column]) => `${column} = ?`).join(", ");
  await db
    .prepare(`UPDATE sellers SET ${assignments}, updated_at = datetime('now') WHERE id = ?`)
    .bind(...entries.map(([, value]) => value), sellerId)
    .run();
}

/* -------------------------------------------------------------------------- */
/* Seller dashboard figures                                                   */
/* -------------------------------------------------------------------------- */

export interface SellerStats {
  productCount: number;
  activeProductCount: number;
  orderCount: number;
  grossSales: number;
  commissionOwed: number;
  netEarnings: number;
  pendingPayout: number;
}

/** Headline numbers for the seller dashboard, computed from suborders so they
 * reflect this seller's share of multi-seller orders only. */
export async function getSellerStats(sellerId: string): Promise<SellerStats> {
  const db = await getDB();

  const [products, orders, payouts] = await db.batch<Record<string, number>>([
    db
      .prepare(
        `SELECT COUNT(*) AS total,
                SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active
         FROM products WHERE seller_id = ?`
      )
      .bind(sellerId),
    db
      .prepare(
        `SELECT COUNT(*) AS orders,
                COALESCE(SUM(subtotal), 0) AS gross,
                COALESCE(SUM(commission_amount), 0) AS commission
         FROM suborders WHERE seller_id = ? AND status != 'cancelled'`
      )
      .bind(sellerId),
    db
      .prepare(
        `SELECT COALESCE(SUM(net_payout), 0) AS pending
         FROM seller_payouts WHERE seller_id = ? AND status IN ('pending', 'processing')`
      )
      .bind(sellerId),
  ]);

  const productRow = (products.results as unknown as { total: number; active: number | null }[])[0];
  const orderRow = (orders.results as unknown as { orders: number; gross: number; commission: number }[])[0];
  const payoutRow = (payouts.results as unknown as { pending: number }[])[0];

  const gross = orderRow?.gross ?? 0;
  const commission = orderRow?.commission ?? 0;

  return {
    productCount: productRow?.total ?? 0,
    activeProductCount: productRow?.active ?? 0,
    orderCount: orderRow?.orders ?? 0,
    grossSales: gross,
    commissionOwed: commission,
    netEarnings: gross - commission,
    pendingPayout: payoutRow?.pending ?? 0,
  };
}

/** Commission the platform keeps on a given sale amount, rounded to whole
 * Taka so payouts never carry fractions. */
export function calcCommission(amount: number, commissionRate: number): number {
  return Math.round((amount * commissionRate) / 100);
}

/* -------------------------------------------------------------------------- */
/* Seller Center access                                                       */
/* -------------------------------------------------------------------------- */

export interface SellerSession {
  user: AuthUser;
  seller: Seller;
}

/** The signed-in user's store, memoised for the request.
 *
 * The Seller Center layout needs it to decide whether to render the panel at
 * all, and every page inside it needs the same row to scope its own queries.
 * Without the cache that is one extra Singapore round trip on every screen,
 * for a row that cannot have changed in between. */
export const getCurrentSeller = cache(async function getCurrentSeller(): Promise<Seller | null> {
  const user = await getCurrentUser();
  return user ? getSellerForUser(user.id) : null;
});

/** The approved store the signed-in user owns.
 *
 * Every Seller Center server action starts here rather than trusting a
 * `seller_id` that arrived in a form: the store is read from the session, so
 * one seller cannot act as another by editing a hidden field. The Seller
 * Center layout makes the same checks to decide what to render, but a layout
 * only guards rendering and a server action can be invoked directly.
 *
 * A store that is still pending, or has been suspended, is refused here as
 * firmly as a stranger -- approval is what separates an application from a
 * shop. */
export async function requireApprovedSeller(): Promise<SellerSession> {
  const user = await getCurrentUser();
  if (!user) throw new AuthorizationError("You need to sign in first.");

  const seller = await getCurrentSeller();
  if (!seller) throw new AuthorizationError("This account doesn't have a store.");
  if (seller.status !== "approved") {
    throw new AuthorizationError("This store hasn't been approved for selling yet.");
  }

  return { user, seller };
}
