/** The coupons a shopper holds, and the ones offered to everyone.
 *
 * Collecting a coupon puts it in the shopper's wallet (`user_coupons`); it
 * does not apply it or reserve anything. Every rule -- dates, limits, minimum
 * spend, who it is for -- is checked again when it is used, so the wallet only
 * ever shows a coupon's state, never promises a discount. */

import { getDB } from "@/lib/db";

export interface WalletCoupon {
  id: string;
  code: string;
  /** "৳100 off", "10% off", "Free delivery". */
  title: string;
  description: string | null;
  /** "On orders over ৳500", "Up to ৳200". */
  condition: string;
  audience: "all" | "new_customer";
  endsAt: string | null;
  /** Whole days until it ends, worked out on the server; null with no end. */
  daysLeft: number | null;
  /** Where "Use now" goes: what the coupon covers. */
  useHref: string;
  state: "unused" | "used" | "expired";
  collected: boolean;
}

interface Row {
  id: string;
  code: string;
  description: string | null;
  discount_type: "percent" | "fixed" | "free_shipping";
  discount_value: number;
  min_order_amount: number;
  max_discount_amount: number | null;
  usage_limit: number | null;
  usage_count: number;
  per_user_limit: number;
  scope: string;
  scope_id: string | null;
  starts_at: string | null;
  ends_at: string | null;
  is_active: number;
  audience: string | null;
  collected?: number;
  used?: number;
  scope_slug?: string | null;
}

const taka = (n: number) => `৳${n.toLocaleString("en-US")}`;

function toWallet(row: Row): WalletCoupon {
  const title =
    row.discount_type === "free_shipping"
      ? "Free delivery"
      : row.discount_type === "percent"
        ? `${row.discount_value}% off`
        : `${taka(row.discount_value)} off`;
  const parts = [
    row.min_order_amount > 0 ? `On orders over ${taka(row.min_order_amount)}` : "No minimum spend",
    row.discount_type === "percent" && row.max_discount_amount ? `up to ${taka(row.max_discount_amount)}` : null,
  ].filter(Boolean);
  const now = new Date().toISOString().slice(0, 19).replace("T", " ");
  const expired =
    row.is_active !== 1 ||
    (row.ends_at !== null && row.ends_at < now) ||
    (row.usage_limit !== null && row.usage_count >= row.usage_limit);
  const used = (row.used ?? 0) >= row.per_user_limit;
  return {
    id: row.id,
    code: row.code,
    title,
    description: row.description,
    condition: parts.join(", "),
    audience: row.audience === "new_customer" ? "new_customer" : "all",
    endsAt: row.ends_at,
    daysLeft: row.ends_at
      ? Math.ceil((new Date(`${row.ends_at.replace(" ", "T")}Z`).getTime() - Date.now()) / 86_400_000)
      : null,
    useHref:
      row.scope === "category" && row.scope_id
        ? `/category/${row.scope_id}`
        : row.scope === "product" && row.scope_slug
          ? `/products/${row.scope_slug}`
          : "/",
    state: used ? "used" : expired ? "expired" : "unused",
    collected: (row.collected ?? 0) > 0,
  };
}

const SELECT = `SELECT c.id, c.code, c.description, c.discount_type, c.discount_value, c.min_order_amount,
       c.max_discount_amount, c.usage_limit, c.usage_count, c.per_user_limit, c.scope, c.scope_id,
       c.starts_at, c.ends_at, c.is_active, c.audience,
       (SELECT slug FROM products p WHERE c.scope = 'product' AND p.id = c.scope_id) AS scope_slug`;

/** Coupons offered on the Offers page: public, active, in their dates and
 * not used up, with whether this shopper already holds each. */
export async function offeredCoupons(userId: string | null): Promise<WalletCoupon[]> {
  const db = await getDB();
  const { results } = await db
    .prepare(
      `${SELECT},
       ${userId ? "EXISTS (SELECT 1 FROM user_coupons u WHERE u.coupon_id = c.id AND u.user_id = ?)" : "0"} AS collected,
       ${userId ? "(SELECT COUNT(*) FROM coupon_redemptions r WHERE r.coupon_id = c.id AND r.user_id = ?)" : "0"} AS used
       FROM coupons c
       WHERE c.is_active = 1 AND c.is_public = 1
         AND (c.starts_at IS NULL OR datetime(c.starts_at) <= datetime('now'))
         AND (c.ends_at IS NULL OR datetime(c.ends_at) > datetime('now'))
         AND (c.usage_limit IS NULL OR c.usage_count < c.usage_limit)
       ORDER BY c.discount_value DESC LIMIT 12`
    )
    .bind(...(userId ? [userId, userId] : []))
    .all<Row>();
  return results.map(toWallet).filter((coupon) => coupon.state === "unused");
}

/** Everything in the shopper's wallet, newest first. */
export async function walletCoupons(userId: string): Promise<WalletCoupon[]> {
  const db = await getDB();
  const { results } = await db
    .prepare(
      `${SELECT}, 1 AS collected,
       (SELECT COUNT(*) FROM coupon_redemptions r WHERE r.coupon_id = c.id AND r.user_id = ?) AS used
       FROM user_coupons u JOIN coupons c ON c.id = u.coupon_id
       WHERE u.user_id = ?
       ORDER BY u.claimed_at DESC`
    )
    .bind(userId, userId)
    .all<Row>();
  return results.map(toWallet);
}

/** Puts a coupon in the wallet: by id from the Offers page (public coupons
 * only), or by code typed in (any active coupon). */
export async function collectCoupon(
  userId: string,
  by: { id: string } | { code: string }
): Promise<{ ok: boolean; error?: string; code?: string }> {
  const db = await getDB();
  const row =
    "id" in by
      ? await db.prepare("SELECT id, code, is_active, is_public, ends_at, audience FROM coupons WHERE id = ?").bind(by.id).first<{
          id: string;
          code: string;
          is_active: number;
          is_public: number;
          ends_at: string | null;
          audience: string;
        }>()
      : await db
          .prepare("SELECT id, code, is_active, is_public, ends_at, audience FROM coupons WHERE UPPER(code) = ?")
          .bind(by.code.trim().toUpperCase())
          .first<{ id: string; code: string; is_active: number; is_public: number; ends_at: string | null; audience: string }>();

  // A store credit is issued into its owner's wallet and can't be collected by anyone else.
  if (!row || ("id" in by && row.is_public !== 1) || row.audience === "owner") return { ok: false, error: "That coupon code isn't valid." };
  if (row.is_active !== 1) return { ok: false, error: "This coupon is no longer active." };
  const now = new Date().toISOString().slice(0, 19).replace("T", " ");
  if (row.ends_at && row.ends_at < now) return { ok: false, error: "This coupon has expired." };

  await db
    .prepare("INSERT OR IGNORE INTO user_coupons (user_id, coupon_id) VALUES (?, ?)")
    .bind(userId, row.id)
    .run();
  return { ok: true, code: row.code };
}
