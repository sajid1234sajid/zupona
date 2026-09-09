"use server";

import { revalidatePath } from "next/cache";
import { getDB } from "@/lib/db";
import { invalidateCatalog } from "@/lib/cache";
import { logAdminAction, requireStaff } from "@/lib/admin";
import { recalculateRating, replyToReview } from "@/lib/reviews";

/** Moderation states the queue offers. `is_approved` is the older two-state
 * column the storefront filters on, so it is derived from this rather than set
 * independently -- the two can never drift. */
const STATUSES = ["approved", "pending", "rejected", "spam"] as const;
type ReviewStatus = (typeof STATUSES)[number];

function isReviewStatus(value: string): value is ReviewStatus {
  return (STATUSES as readonly string[]).includes(value);
}

function refresh(): void {
  revalidatePath("/admin/products/reviews");
  revalidatePath("/admin");
}

/** Applies a moderation decision and refreshes the affected products' rating
 * averages in the same round trip, so a hidden review stops counting towards
 * the stars immediately rather than at the next write. */
async function applyStatus(reviewIds: string[], status: ReviewStatus): Promise<string[]> {
  if (reviewIds.length === 0) return [];

  const db = await getDB();
  const placeholders = reviewIds.map(() => "?").join(",");

  const { results: affected } = await db
    .prepare(`SELECT DISTINCT product_id FROM reviews WHERE id IN (${placeholders})`)
    .bind(...reviewIds)
    .all<{ product_id: string }>();

  await db
    .prepare(
      `UPDATE reviews SET status = ?, is_approved = ? WHERE id IN (${placeholders})`
    )
    .bind(status, status === "approved" ? 1 : 0, ...reviewIds)
    .run();

  for (const row of affected) {
    await recalculateRating(row.product_id);
  }

  await invalidateCatalog();
  return affected.map((row) => row.product_id);
}

export async function setReviewStatusAction(formData: FormData): Promise<void> {
  const staff = await requireStaff();
  const reviewId = String(formData.get("reviewId") ?? "");
  const status = String(formData.get("status") ?? "");

  if (!reviewId || !isReviewStatus(status)) return;

  await applyStatus([reviewId], status);
  await logAdminAction(staff.id, `review.${status}`, "review", reviewId, { after: { status } });
  refresh();
}

export async function bulkReviewAction(formData: FormData): Promise<void> {
  const staff = await requireStaff();
  const ids = formData.getAll("selected").map(String).filter(Boolean);
  const action = String(formData.get("bulkAction") ?? "");
  if (ids.length === 0) return;

  if (action === "delete") {
    const db = await getDB();
    const placeholders = ids.map(() => "?").join(",");

    const { results: affected } = await db
      .prepare(`SELECT DISTINCT product_id FROM reviews WHERE id IN (${placeholders})`)
      .bind(...ids)
      .all<{ product_id: string }>();

    await db.prepare(`DELETE FROM reviews WHERE id IN (${placeholders})`).bind(...ids).run();
    for (const row of affected) await recalculateRating(row.product_id);

    await invalidateCatalog();
    await logAdminAction(staff.id, "review.bulk.delete", "review", null, { before: { ids } });
    refresh();
    return;
  }

  if (!isReviewStatus(action)) return;

  await applyStatus(ids, action);
  await logAdminAction(staff.id, `review.bulk.${action}`, "review", null, {
    after: { ids, status: action },
  });
  refresh();
}

/** Removes a review outright. Reserved for content that should not exist at
 * all -- abuse, personal data -- since hiding it with a status keeps the
 * record for later reference. */
export async function deleteReviewAction(formData: FormData): Promise<void> {
  const staff = await requireStaff();
  const reviewId = String(formData.get("reviewId") ?? "");
  if (!reviewId) return;

  const db = await getDB();
  const row = await db
    .prepare("SELECT product_id, rating, body FROM reviews WHERE id = ?")
    .bind(reviewId)
    .first<{ product_id: string; rating: number; body: string | null }>();

  if (!row) return;

  await db.prepare("DELETE FROM reviews WHERE id = ?").bind(reviewId).run();
  await recalculateRating(row.product_id);
  await invalidateCatalog();
  await logAdminAction(staff.id, "review.delete", "review", reviewId, { before: row });
  refresh();
}

export async function replyToReviewAction(formData: FormData): Promise<void> {
  const staff = await requireStaff();
  const reviewId = String(formData.get("reviewId") ?? "");
  const reply = String(formData.get("reply") ?? "").trim();

  if (!reviewId || !reply) return;

  await replyToReview(reviewId, reply.slice(0, 1000));
  await logAdminAction(staff.id, "review.reply", "review", reviewId, { after: { reply } });
  refresh();
}
