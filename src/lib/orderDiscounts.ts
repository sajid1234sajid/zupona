/** What comes off an order: a coupon, then points.
 *
 * One function prices both the checkout preview and the order itself, so the
 * total the shopper sees beside "Place order" is the total the order is
 * written with. Everything is read here from the database -- the coupon, its
 * rules, the shopper's balance, which category each line is in -- and nothing
 * the browser sends is taken as a number.
 *
 * Order of operations:
 *   1. The coupon takes its discount off the items it applies to (or makes
 *      delivery free).
 *   2. Points pay for part of what is left of the items, at the value set in
 *      Settings, up to `pointsMaxPercent` of it, and only from
 *      `pointsMinRedeem` points up. Delivery is never paid with points. */

import { getDB } from "@/lib/db";
import { validateCoupon } from "@/lib/coupons";
import type { ShopSettings } from "@/lib/shopSettings";
import { pointsToTaka } from "@/lib/points";

export interface PricedLine {
  productId: string;
  price: number;
  quantity: number;
}

export interface DiscountQuote {
  /** Points offer for a signed-in customer; null for a guest. */
  points: {
    balance: number;
    /** The most this order can take. */
    usable: number;
    usableDiscount: number;
    /** Why none can be used, when none can. */
    blocked: string | null;
  } | null;
  pointsUsed: number;
  pointsDiscount: number;
  coupon: { id: string; code: string; description: string | null; discount: number; freeShipping: boolean } | null;
  couponError: string | null;
  itemsSubtotal: number;
  shippingFee: number;
  discountTotal: number;
  total: number;
}

/** The lines as coupon scopes see them: which department, sub-department
 * and seller each product belongs to. */
async function scopeData(lines: PricedLine[]) {
  const ids = [...new Set(lines.map((line) => line.productId))];
  if (ids.length === 0) return new Map<string, { categories: string[]; sellerId: string | null }>();
  const db = await getDB();
  const { results } = await db
    .prepare(
      `SELECT p.id, p.category_id, c.parent_id, p.seller_id FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       WHERE p.id IN (${ids.map(() => "?").join(",")})`
    )
    .bind(...ids)
    .all<{ id: string; category_id: string | null; parent_id: string | null; seller_id: string | null }>();
  return new Map(
    results.map((row) => [
      row.id,
      {
        categories: [row.category_id, row.parent_id].filter((id): id is string => Boolean(id)),
        sellerId: row.seller_id,
      },
    ])
  );
}

export async function quoteDiscounts(input: {
  /** A signed-in customer's id; null for a guest, who has no points. */
  userId: string | null;
  lines: PricedLine[];
  shippingFee: number;
  usePoints: boolean;
  couponCode: string | null;
  settings: ShopSettings;
}): Promise<DiscountQuote> {
  const itemsSubtotal = input.lines.reduce((sum, line) => sum + line.price * line.quantity, 0);
  let shippingFee = input.shippingFee;

  // 1. The coupon.
  let coupon: DiscountQuote["coupon"] = null;
  let couponError: string | null = null;
  const code = input.couponCode?.trim();
  if (code) {
    const scopes = await scopeData(input.lines);
    const result = await validateCoupon(code, input.userId, itemsSubtotal, {
      lines: input.lines.map((line) => ({
        amount: line.price * line.quantity,
        productId: line.productId,
        categories: scopes.get(line.productId)?.categories ?? [],
        sellerId: scopes.get(line.productId)?.sellerId ?? null,
      })),
    });
    if (result.ok && result.coupon) {
      coupon = {
        id: result.coupon.id,
        code: result.coupon.code,
        description: result.coupon.description,
        discount: result.discount,
        freeShipping: result.freeShipping,
      };
      if (result.freeShipping) shippingFee = 0;
    } else {
      couponError = result.error ?? "That coupon can't be used.";
    }
  }
  const couponDiscount = coupon?.discount ?? 0;
  const afterCoupon = Math.max(0, itemsSubtotal - couponDiscount);

  // 2. Points.
  let points: DiscountQuote["points"] = null;
  let pointsUsed = 0;
  let pointsDiscount = 0;
  if (input.userId) {
    const db = await getDB();
    const row = await db
      .prepare("SELECT points FROM users WHERE id = ?")
      .bind(input.userId)
      .first<{ points: number }>();
    const balance = Math.max(0, row?.points ?? 0);
    const { pointValue, pointsMaxPercent, pointsMinRedeem } = input.settings;
    const takaCap = Math.floor((afterCoupon * pointsMaxPercent) / 100);
    const pointsCap = pointValue > 0 ? Math.floor(takaCap / pointValue) : 0;
    const usable = Math.min(balance, pointsCap);
    const usableDiscount = pointsToTaka(usable, pointValue);

    let blocked: string | null = null;
    if (pointValue <= 0 || pointsMaxPercent <= 0) blocked = "Points can't be used right now.";
    else if (balance < pointsMinRedeem) blocked = `You need at least ${pointsMinRedeem} points to use them.`;
    else if (usable < pointsMinRedeem || usableDiscount < 1)
      blocked = `This order is too small to use ${pointsMinRedeem} points.`;

    points = { balance, usable: blocked ? 0 : usable, usableDiscount: blocked ? 0 : usableDiscount, blocked };
    if (input.usePoints && !blocked) {
      // Only whole Taka are taken off, so only the points those Taka need are used.
      pointsDiscount = usableDiscount;
      pointsUsed = Math.ceil(pointsDiscount / pointValue - 1e-9);
    }
  }

  const discountTotal = couponDiscount + pointsDiscount;
  return {
    points,
    pointsUsed,
    pointsDiscount,
    coupon,
    couponError,
    itemsSubtotal,
    shippingFee,
    discountTotal,
    total: Math.max(0, itemsSubtotal - discountTotal) + shippingFee,
  };
}
