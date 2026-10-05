"use server";

import { revalidatePath } from "next/cache";
import { getDB } from "@/lib/db";
import { AuthorizationError, logAdminAction } from "@/lib/admin";
import { requireApprovedSeller } from "@/lib/sellers";
import { replyToReview } from "@/lib/reviews";

export interface ReplyState {
  error?: string;
  success?: string;
}

/** Answers a review on one of this store's products. The reply appears under
 * the review on the product page, marked as the seller's. Sending an empty box
 * removes a reply. */
export async function replyToReviewAction(
  _prevState: ReplyState,
  formData: FormData
): Promise<ReplyState> {
  try {
    const { user, seller } = await requireApprovedSeller();
    const reviewId = String(formData.get("reviewId") ?? "");
    const reply = String(formData.get("reply") ?? "").trim().slice(0, 1000);

    const db = await getDB();
    const owned = await db
      .prepare(
        `SELECT r.product_id, p.slug FROM reviews r JOIN products p ON p.id = r.product_id
         WHERE r.id = ? AND p.seller_id = ?`
      )
      .bind(reviewId, seller.id)
      .first<{ product_id: string; slug: string }>();
    if (!owned) return { error: "That review isn't on one of your products." };

    if (reply) {
      await replyToReview(reviewId, reply);
    } else {
      await db
        .prepare("UPDATE reviews SET seller_reply = NULL, seller_replied_at = NULL WHERE id = ?")
        .bind(reviewId)
        .run();
    }

    await logAdminAction(user.id, reply ? "seller.review.reply" : "seller.review.unreply", "review", reviewId);
    revalidatePath("/seller/reviews");
    revalidatePath(`/product/${owned.slug}`);
    revalidatePath(`/product/${owned.product_id}`);
    return { success: reply ? "Reply published." : "Reply removed." };
  } catch (error) {
    if (error instanceof AuthorizationError) return { error: error.message };
    throw error;
  }
}
