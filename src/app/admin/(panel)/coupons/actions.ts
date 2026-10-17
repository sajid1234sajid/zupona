"use server";

import { revalidatePath } from "next/cache";
import { getDB } from "@/lib/db";
import { AuthorizationError, logAdminAction, requireAdmin } from "@/lib/admin";
import { couponInsertStatement, setCouponActive, type CouponInput } from "@/lib/coupons";
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

/** `count` distinct codes `PREFIX-XXXXXX`, from letters and digits that
 * cannot be misread (no 0/O, 1/I). */
function batchCodes(prefix: string, count: number): string[] {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const codes = new Set<string>();
  while (codes.size < count) {
    const bytes = crypto.getRandomValues(new Uint8Array(6));
    codes.add(`${prefix}-${Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("")}`);
  }
  return [...codes];
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
    // A batch: the code is a prefix, and each generated code is single-use
    // and kept off the Offers page -- it is handed to one person or one ad.
    const batchCount = Math.min(500, Math.max(1, readInt(formData, "batchCount", 1)));
    if (batchCount > 1 && code.length > 12) {
      return { error: "For a batch, keep the code to 12 characters; it becomes the start of each code." };
    }
    const codes = batchCount > 1 ? batchCodes(code, batchCount) : [code];
    // D1 binds at most 100 values a statement, so a large batch is checked in slices.
    const slices: string[][] = [];
    for (let at = 0; at < codes.length; at += 90) slices.push(codes.slice(at, at + 90));
    const taken = await db.batch<{ code: string }>(
      slices.map((slice) =>
        db.prepare(`SELECT code FROM coupons WHERE UPPER(code) IN (${slice.map(() => "?").join(",")})`).bind(...slice)
      )
    );
    if (taken.some((result) => result.results.length > 0)) {
      return { error: batchCount > 1 ? "Some of those codes clashed with existing ones. Try again." : "That code is already in use." };
    }

    const usageLimit = batchCount > 1 ? 1 : readInt(formData, "usageLimit");

    const ids = codes.map(() => crypto.randomUUID());
    const id = ids[0];
    const base: Omit<CouponInput, "code"> = {
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
      scope: String(formData.get("scopeId") ?? "") ? ("category" as const) : ("all" as const),
      scopeId: String(formData.get("scopeId") ?? "") || null,
      audience: formData.get("audience") === "new_customer" ? ("new_customer" as const) : ("all" as const),
      isPublic: batchCount > 1 ? false : formData.get("isPublic") === "on",
      batch: batchCount > 1 ? code : null,
    };
    // One round trip for the whole batch, and all of it or none.
    await db.batch(codes.map((each, index) => couponInsertStatement(db, ids[index], { ...base, code: each })));

    await logAdminAction(admin.id, batchCount > 1 ? "coupon.batch" : "coupon.create", "coupon", id, {
      after: { code, discountType, discountValue, count: codes.length },
    });
    if (batchCount > 1) {
      refresh();
      return { success: `${codes.length} codes created. Download them under “Code batches”.` };
    }
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
