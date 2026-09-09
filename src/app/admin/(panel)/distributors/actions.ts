"use server";

import { revalidatePath } from "next/cache";
import { getDB } from "@/lib/db";
import { invalidateCatalog } from "@/lib/cache";
import { logAdminAction, requireAdmin } from "@/lib/admin";
import { setSellerStatus } from "@/lib/sellers";
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
