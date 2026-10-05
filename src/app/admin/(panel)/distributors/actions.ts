"use server";

import { revalidatePath } from "next/cache";
import { getDB } from "@/lib/db";
import { invalidateCatalog } from "@/lib/cache";
import { logAdminAction, requireAdmin } from "@/lib/admin";
import { setSellerStatus } from "@/lib/sellers";
import { recordSellerPayout } from "@/lib/sellerPayouts";
import type { SellerStatus } from "@/types";

const STATUSES: SellerStatus[] = ["pending", "approved", "suspended", "rejected"];

function refresh(): void {
  revalidatePath("/admin/distributors");
  revalidatePath("/admin");
}

/** Approving or suspending a store also decides whether its products may be
 * seen: suspending a seller but leaving their listings live would put items
 * on the storefront that nobody is fulfilling. */
export async function setSellerStatusAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const sellerId = String(formData.get("sellerId") ?? "");
  const status = String(formData.get("status") ?? "") as SellerStatus;

  if (!sellerId || !STATUSES.includes(status)) return;

  const db = await getDB();
  const before = await db
    .prepare("SELECT status, store_name FROM sellers WHERE id = ?")
    .bind(sellerId)
    .first<{ status: string; store_name: string }>();

  if (!before || before.status === status) return;

  await setSellerStatus(sellerId, status);

  if (status === "suspended" || status === "rejected") {
    await db
      .prepare(
        `UPDATE products SET status = 'draft', updated_at = datetime('now')
         WHERE seller_id = ? AND status = 'active'`
      )
      .bind(sellerId)
      .run();
  }

  await logAdminAction(admin.id, `seller.${status}`, "seller", sellerId, {
    before,
    after: { status },
  });
  await invalidateCatalog();
  refresh();
}

/** The platform's take rate on this store's sales. Stored as a percentage with
 * one decimal, matching `sellers.commission_rate`. */
export async function setCommissionAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const sellerId = String(formData.get("sellerId") ?? "");
  const rate = Number(formData.get("commissionRate"));

  if (!sellerId || !Number.isFinite(rate) || rate < 0 || rate > 100) return;

  const db = await getDB();
  const before = await db
    .prepare("SELECT commission_rate FROM sellers WHERE id = ?")
    .bind(sellerId)
    .first<{ commission_rate: number }>();

  await db
    .prepare("UPDATE sellers SET commission_rate = ?, updated_at = datetime('now') WHERE id = ?")
    .bind(Math.round(rate * 10) / 10, sellerId)
    .run();

  await logAdminAction(admin.id, "seller.commission", "seller", sellerId, {
    before,
    after: { commission_rate: rate },
  });
  refresh();
}

/** Records that a store has been sent everything it is currently owed.
 *
 * The money moves outside Zupona -- the admin sends it by bKash, Nagad or
 * bank first -- and this writes the receipt the seller then sees in their
 * Finance screen, with the transfer's own reference to match against. */
export async function recordPayoutAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const sellerId = String(formData.get("sellerId") ?? "");
  const reference = String(formData.get("reference") ?? "").trim().slice(0, 80) || null;
  if (!sellerId) return;

  const payout = await recordSellerPayout(sellerId, reference);
  if (!payout) return;

  await logAdminAction(admin.id, "seller.payout", "seller", sellerId, {
    after: { payoutId: payout.id, amount: payout.amount, orders: payout.count, reference },
  });
  refresh();
  revalidatePath("/seller/finance");
}
