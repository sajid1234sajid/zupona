/** Coupon validation and redemption.
 *
 * Validation is deliberately separate from redemption: `validateCoupon` is
 * safe to call on every keystroke in the cart, while `redeemCoupon` is called
 * once, inside the same flow that writes the order. */

import { getDB } from "@/lib/db";
import type { Coupon, CouponType } from "@/types";

interface CouponRow {
  id: string;
  code: string;
  description: string | null;
  discount_type: CouponType;
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
}

function toCoupon(row: CouponRow): Coupon {
  return {
    id: row.id,
    code: row.code,
    description: row.description,
    discountType: row.discount_type,
    discountValue: row.discount_value,
    minOrderAmount: row.min_order_amount,
    maxDiscountAmount: row.max_discount_amount,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    isActive: row.is_active === 1,
  };
}

export interface CouponResult {
  ok: boolean;
  /** Shopper-facing reason the code was refused. */
  error?: string;
  coupon?: Coupon;
  /** Taka taken off the order subtotal. */
  discount: number;
  /** True for free-shipping codes, which zero the delivery fee instead. */
  freeShipping: boolean;
}

const REFUSED = (error: string): CouponResult => ({
  ok: false,
  error,
  discount: 0,
  freeShipping: false,
});

/** Discount a coupon takes off a given subtotal, capped so it can never
 * exceed the order value or the coupon's own ceiling. */
export function calcDiscount(coupon: Coupon, subtotal: number): number {
  if (coupon.discountType === "free_shipping") return 0;

  const raw =
    coupon.discountType === "percent"
      ? Math.round((subtotal * coupon.discountValue) / 100)
      : coupon.discountValue;

  const capped = coupon.maxDiscountAmount ? Math.min(raw, coupon.maxDiscountAmount) : raw;
  return Math.max(0, Math.min(capped, subtotal));
}

/** Checks a code against every rule: existence, active window, usage limits,
 * per-user limits and minimum spend. Does not consume anything. */
export async function validateCoupon(
  code: string,
  userId: string | null,
  subtotal: number
): Promise<CouponResult> {
  const trimmed = code.trim().toUpperCase();
  if (!trimmed) return REFUSED("Enter a coupon code.");

  const db = await getDB();
  const row = await db
    .prepare("SELECT * FROM coupons WHERE UPPER(code) = ?")
    .bind(trimmed)
    .first<CouponRow>();

  if (!row) return REFUSED("That coupon code isn't valid.");
  if (row.is_active !== 1) return REFUSED("This coupon is no longer active.");

  const now = new Date().toISOString().slice(0, 19).replace("T", " ");
  if (row.starts_at && now < row.starts_at) return REFUSED("This coupon isn't active yet.");
  if (row.ends_at && now > row.ends_at) return REFUSED("This coupon has expired.");

  if (row.usage_limit !== null && row.usage_count >= row.usage_limit) {
    return REFUSED("This coupon has been fully claimed.");
  }

  if (subtotal < row.min_order_amount) {
    return REFUSED(`Spend ৳ ${row.min_order_amount.toLocaleString("en-US")} to use this coupon.`);
  }

  if (userId) {
    const used = await db
      .prepare("SELECT COUNT(*) AS n FROM coupon_redemptions WHERE coupon_id = ? AND user_id = ?")
      .bind(row.id, userId)
      .first<{ n: number }>();

    if ((used?.n ?? 0) >= row.per_user_limit) {
      return REFUSED("You've already used this coupon.");
    }
  }

  const coupon = toCoupon(row);
  return {
    ok: true,
    coupon,
    discount: calcDiscount(coupon, subtotal),
    freeShipping: coupon.discountType === "free_shipping",
  };
}

/** Records a redemption and bumps the usage counter.
 *
 * Re-validates first so a code that ran out between the cart page and the
 * order being placed cannot slip through. */
export async function redeemCoupon(
  code: string,
  userId: string,
  orderId: string,
  subtotal: number
): Promise<CouponResult> {
  const result = await validateCoupon(code, userId, subtotal);
  if (!result.ok || !result.coupon) return result;

  const db = await getDB();
  await db.batch([
    db
      .prepare(
        `INSERT INTO coupon_redemptions (id, coupon_id, user_id, order_id, discount_amount)
         VALUES (?, ?, ?, ?, ?)`
      )
      .bind(crypto.randomUUID(), result.coupon.id, userId, orderId, result.discount),
    db
      .prepare("UPDATE coupons SET usage_count = usage_count + 1 WHERE id = ?")
      .bind(result.coupon.id),
  ]);

  return result;
}

/* -------------------------------------------------------------------------- */
/* Admin                                                                      */
/* -------------------------------------------------------------------------- */

export interface CouponInput {
  code: string;
  description?: string | null;
  discountType: CouponType;
  discountValue: number;
  minOrderAmount?: number;
  maxDiscountAmount?: number | null;
  usageLimit?: number | null;
  perUserLimit?: number;
  scope?: "all" | "category" | "product" | "seller";
  scopeId?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
}

export async function createCoupon(input: CouponInput): Promise<string> {
  const db = await getDB();
  const id = crypto.randomUUID();

  await db
    .prepare(
      `INSERT INTO coupons (id, code, description, discount_type, discount_value, min_order_amount,
                            max_discount_amount, usage_limit, per_user_limit, scope, scope_id,
                            starts_at, ends_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      id,
      input.code.trim().toUpperCase(),
      input.description ?? null,
      input.discountType,
      input.discountValue,
      input.minOrderAmount ?? 0,
      input.maxDiscountAmount ?? null,
      input.usageLimit ?? null,
      input.perUserLimit ?? 1,
      input.scope ?? "all",
      input.scopeId ?? null,
      input.startsAt ?? null,
      input.endsAt ?? null
    )
    .run();

  return id;
}

export async function listCoupons(activeOnly = false): Promise<Coupon[]> {
  const db = await getDB();
  const where = activeOnly ? "WHERE is_active = 1" : "";
  const { results } = await db
    .prepare(`SELECT * FROM coupons ${where} ORDER BY created_at DESC`)
    .all<CouponRow>();
  return results.map(toCoupon);
}

export async function setCouponActive(couponId: string, isActive: boolean): Promise<void> {
  const db = await getDB();
  await db
    .prepare("UPDATE coupons SET is_active = ? WHERE id = ?")
    .bind(isActive ? 1 : 0, couponId)
    .run();
}
