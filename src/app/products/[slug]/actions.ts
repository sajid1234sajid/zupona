"use server";

import { getCurrentUser } from "@/lib/session";
import { invalidateCatalog } from "@/lib/cache";
import { createReview, getReviewableLines } from "@/lib/reviews";
import { getShopSettings } from "@/lib/shopSettings";

export interface ReviewResult {
  ok: boolean;
  error?: string;
  /** The review was saved but waits for moderation before it shows. */
  pending?: boolean;
}

const MAX_BODY = 1000;

/** Posts a review for one delivered order line.
 *
 * The browser names the line and the stars; whether that line belongs to this
 * shopper, has been delivered, and is still unreviewed is all decided here. */
export async function submitReviewAction(input: {
  productId: string;
  orderItemId: string;
  rating: number;
  body: string;
}): Promise<ReviewResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Please sign in to write a review." };

  const rating = Number(input.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return { ok: false, error: "Choose a rating from 1 to 5 stars." };
  }

  const body = String(input.body ?? "").trim();
  if (body.length > MAX_BODY) {
    return { ok: false, error: `Keep the review under ${MAX_BODY} characters.` };
  }

  const lines = await getReviewableLines(user.id, input.productId);
  if (!lines.some((line) => line.orderItemId === input.orderItemId)) {
    return {
      ok: false,
      error: "This order can't be reviewed — it isn't delivered yet or already has a review.",
    };
  }

  const { reviewsNeedApproval } = await getShopSettings();
  const reviewId = await createReview({
    productId: input.productId,
    userId: user.id,
    orderItemId: input.orderItemId,
    rating,
    body: body || null,
    status: reviewsNeedApproval ? "pending" : "approved",
  });

  if (!reviewId) return { ok: false, error: "You have already reviewed this order." };

  // The rating on product cards is served from the catalog cache.
  if (!reviewsNeedApproval) await invalidateCatalog();

  return { ok: true, pending: reviewsNeedApproval };
}
