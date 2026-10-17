"use server";

import { getCurrentUser } from "@/lib/session";
import { invalidateCatalog } from "@/lib/cache";
import { createReview, getReviewableLines, rewardReview, voteHelpful } from "@/lib/reviews";
import { getShopSettings } from "@/lib/shopSettings";
import { getStoreProduct } from "@/lib/storefront";
import { needsModeration } from "@/lib/reviewModeration";
import { MAX_REVIEW_PHOTOS, MAX_REVIEW_TAGS, REVIEW_TAGS, type ReviewFit } from "@/lib/reviewTags";

export interface ReviewResult {
  ok: boolean;
  error?: string;
  /** The review was saved but waits for moderation before it shows. */
  pending?: boolean;
  /** Points it earned straight away. */
  points?: number;
}

const MAX_BODY = 1000;

/** Posts a review for one delivered order line.
 *
 * The browser names the line, the stars, the fit, the tags and the photos it
 * uploaded; whether that line belongs to this shopper, has been delivered,
 * and is still unreviewed -- and whether each photo is one this shopper
 * uploaded -- is all decided here. A review with a phone number, a link or
 * abuse in it waits for the admin instead of going live. */
export async function submitReviewAction(input: {
  productId: string;
  orderItemId: string;
  rating: number;
  body: string;
  fit?: string | null;
  tags?: string[];
  photos?: string[];
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

  const [lines, product, settings] = await Promise.all([
    getReviewableLines(user.id, input.productId),
    getStoreProduct(input.productId),
    getShopSettings(),
  ]);
  if (!lines.some((line) => line.orderItemId === input.orderItemId)) {
    return {
      ok: false,
      error: "This order can't be reviewed — it isn't delivered yet or already has a review.",
    };
  }

  // Fit only means something for a product sold in sizes.
  const apparel = (product?.optionGroups ?? []).some((group) => group.key === "size");
  const fit: ReviewFit | null =
    apparel && (input.fit === "small" || input.fit === "true" || input.fit === "large") ? input.fit : null;

  const known = new Set<string>(REVIEW_TAGS.map((tag) => tag.id));
  const tags = [...new Set((input.tags ?? []).filter((tag) => known.has(tag)))].slice(0, MAX_REVIEW_TAGS);

  const ownPrefix = `/api/media/reviews/${user.id}/`;
  const photos = [...new Set(input.photos ?? [])]
    .filter((url) => typeof url === "string" && url.startsWith(ownPrefix) && !url.includes(".."))
    .slice(0, MAX_REVIEW_PHOTOS);

  const held = settings.reviewsNeedApproval || needsModeration(body);
  const reviewId = await createReview({
    productId: input.productId,
    userId: user.id,
    orderItemId: input.orderItemId,
    rating,
    body: body || null,
    fit,
    tags,
    imageUrls: photos,
    status: held ? "pending" : "approved",
  });

  if (!reviewId) return { ok: false, error: "You have already reviewed this order." };

  let points = 0;
  if (!held) {
    points = await rewardReview(reviewId);
    // The rating on product cards is served from the catalog cache.
    await invalidateCatalog();
  }

  return { ok: true, pending: held, points };
}

/** "Helpful": one per signed-in shopper per review. Returns the new count. */
export async function voteHelpfulAction(reviewId: string): Promise<{ ok: boolean; count?: number; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in to mark reviews as helpful." };
  if (typeof reviewId !== "string" || !reviewId) return { ok: false };
  return { ok: true, count: await voteHelpful(reviewId, user.id) };
}
