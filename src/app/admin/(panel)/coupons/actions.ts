"use server";

import { revalidatePath } from "next/cache";
import { getDB } from "@/lib/db";
import { AuthorizationError, logAdminAction, requireAdmin } from "@/lib/admin";
import { createCoupon, setCouponActive } from "@/lib/coupons";
import type { CouponType } from "@/types";

export interface CouponFormState {
  error?: string;
  success?: string;
}

const TYPES: CouponType[] = ["percent", "fixed", "free_shipping"];

function refresh(): void {
  revalidatePath("/admin/coupons");
  revalidatePath("/offers");
}

function readInt(formData: FormData, key: string, fallback = 0): number {
  const raw = String(formData.get(key) ?? "").trim();
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw.replace(/[^\d-]/g, ""), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/** An empty datetime-local field means "no boundary", which is a NULL rather
 * than an empty string -- `validateCoupon` compares against NULL to decide a
 * coupon has no start or end. */
function readDate(formData: FormData, key: string): string | null {
  const raw = String(formData.get(key) ?? "").trim();
  if (!raw) return null;
  // <input type="datetime-local"> gives "2026-09-08T14:30"; the column stores
  // SQLite's "YYYY-MM-DD HH:MM:SS".
  return `${raw.replace("T", " ")}:00`.slice(0, 19);
}

export async function createCouponAction(
  _prevState: CouponFormState,
  formData: FormData
): Promise<CouponFormState> {
  try {
    const admin = await requireAdmin();

    const code = String(formData.get("code") ?? "").trim().toUpperCase();
    if (!/^[A-Z0-9_-]{3,24}$/.test(code)) {
      return { error: "Codes are 3–24 characters: letters, numbers, - and _ only." };
    }

    const discountType = String(formData.get("discountType") ?? "") as CouponType;
    if (!TYPES.includes(discountType)) return { error: "Pick a discount type." };

    const discountValue = readInt(formData, "discountValue");
    if (discountType === "percent" && (discountValue < 1 || discountValue > 100)) {
      return { error: "A percentage discount must be between 1 and 100." };
    }
    if (discountType === "fixed" && discountValue < 1) {
      return { error: "Enter the amount to take off the order." };
    }

    const startsAt = readDate(formData, "startsAt");
    const endsAt = readDate(formData, "endsAt");
    if (startsAt && endsAt && endsAt <= startsAt) {
      return { error: "The end date has to be after the start date." };
    }

    const db = await getDB();
    const existing = await db
      .prepare("SELECT id FROM coupons WHERE UPPER(code) = ?")
      .bind(code)
      .first<{ id: string }>();
    if (existing) return { error: "That code is already in use." };

    const usageLimit = readInt(formData, "usageLimit");

    const id = await createCoupon({
      code,
      description: String(formData.get("description") ?? "").trim() || null,
      discountType,
      discountValue: discountType === "free_shipping" ? 0 : discountValue,
      minOrderAmount: Math.max(0, readInt(formData, "minOrderAmount")),
      // Blank means uncapped, which is NULL rather than zero -- zero would cap
      // every discount at nothing.
      maxDiscountAmount: readInt(formData, "maxDiscountAmount") || null,
      usageLimit: usageLimit > 0 ? usageLimit : null,
      perUserLimit: Math.max(1, readInt(formData, "perUserLimit", 1)),
      startsAt,
      endsAt,
    });

    await logAdminAction(admin.id, "coupon.create", "coupon", id, {
      after: { code, discountType, discountValue },
    });
  } catch (error) {
    if (error instanceof AuthorizationError) return { error: error.message };
    throw error;
  }

  refresh();
  return { success: "Coupon created." };
}

export async function toggleCouponAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const couponId = String(formData.get("couponId") ?? "");
  if (!couponId) return;

  const db = await getDB();
  const row = await db
    .prepare("SELECT is_active, code FROM coupons WHERE id = ?")
    .bind(couponId)
    .first<{ is_active: number; code: string }>();

  if (!row) return;

  const next = row.is_active !== 1;
  await setCouponActive(couponId, next);
  await logAdminAction(admin.id, next ? "coupon.enable" : "coupon.disable", "coupon", couponId, {
    after: { code: row.code, isActive: next },
  });

  refresh();
}

/** Only ever removes a coupon nobody has used.
 *
 * `coupon_redemptions.coupon_id` cascades, so deleting a redeemed coupon would
 * erase the record of discounts already given. Disabling keeps the history and
 * has the same effect at checkout. */
export async function deleteCouponAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const couponId = String(formData.get("couponId") ?? "");
  if (!couponId) return;

  const db = await getDB();
  const used = await db
    .prepare("SELECT COUNT(*) AS n FROM coupon_redemptions WHERE coupon_id = ?")
    .bind(couponId)
    .first<{ n: number }>();

  if ((used?.n ?? 0) > 0) {
    await setCouponActive(couponId, false);
    await logAdminAction(admin.id, "coupon.disable", "coupon", couponId, {
      after: { reason: "delete refused — coupon has redemptions" },
    });
    refresh();
    return;
  }

  await db.prepare("DELETE FROM coupons WHERE id = ?").bind(couponId).run();
  await logAdminAction(admin.id, "coupon.delete", "coupon", couponId);
  refresh();
}
