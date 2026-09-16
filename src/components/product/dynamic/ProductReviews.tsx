"use client";

import { useState, useSyncExternalStore } from "react";
import Image from "@/components/ui/StoreImage";
import { BadgeCheck, PenLine, Star } from "lucide-react";
import type { Review } from "@/types";
import type { RatingBreakdown, ReviewableLine } from "@/lib/reviews";
import { formatDate } from "@/lib/format";
import ReviewForm from "./ReviewForm";

/** How many reviews show before "See all". */
const INITIAL_REVIEWS = 5;

function Stars({ rating, size = "h-4 w-4" }: { rating: number; size?: string }) {
  return (
    <span className="flex items-center gap-0.5" aria-label={`Rated ${rating} out of 5`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          aria-hidden
          className={`${size} ${rating >= star - 0.25 ? "fill-gold text-gold" : "fill-line text-line"}`}
        />
      ))}
    </span>
  );
}

function subscribeToHash(onChange: () => void) {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}

function readHash() {
  return window.location.hash;
}

/** A name that is really a phone number is not printed on a public page. */
function displayName(name: string): string {
  return /\d{6,}/.test(name) || !name.trim() ? "Zupona Customer" : name;
}

/** Rating summary, the write-a-review entry point and the review list.
 *
 * Everything shown is an approved review in the database. With none, the page
 * says so rather than drawing an empty histogram. The form is only offered to
 * a signed-in shopper holding a delivered, unreviewed order of this product --
 * the server checks the same thing again when it is submitted. */
export default function ProductReviews({
  productId,
  breakdown,
  reviews,
  reviewableLines,
}: {
  productId: string;
  breakdown: RatingBreakdown;
  reviews: Review[];
  reviewableLines: ReviewableLine[];
}) {
  const [openedByTap, setOpenedByTap] = useState(false);
  const [submitted, setSubmitted] = useState<null | { pending: boolean }>(null);
  const [showAll, setShowAll] = useState(false);

  // The order page links straight to the form with #write-review. Read as an
  // external store so the server render (no hash) and hydration agree.
  const hash = useSyncExternalStore(subscribeToHash, readHash, () => "");
  const formOpen = openedByTap || hash === "#write-review";

  const canReview = reviewableLines.length > 0;
  const visible = showAll ? reviews : reviews.slice(0, INITIAL_REVIEWS);
  const maxCount = Math.max(1, ...Object.values(breakdown.counts));

  return (
    <>
      <section id="reviews" aria-labelledby="rating-title" className="scroll-mt-4 rounded-2xl border border-line bg-white p-4">
        <h2 id="rating-title" className="text-base font-extrabold text-heading">
          Rating &amp; Reviews
        </h2>

        {breakdown.total === 0 ? (
          <p className="mt-2 text-sm text-ink-muted">
            No reviews yet. Reviews come from customers who have received this product.
          </p>
        ) : (
          <div className="mt-3 flex items-center gap-4">
            <div className="shrink-0 text-center">
              <p className="flex items-center justify-center gap-1 text-[40px] font-extrabold leading-none text-heading">
                {breakdown.average.toFixed(1)}
                <Star className="h-7 w-7 fill-gold text-gold" aria-hidden />
              </p>
              <p className="mt-1.5 text-[11px] text-ink-muted">
                {breakdown.total} {breakdown.total === 1 ? "rating" : "ratings"}
              </p>
            </div>

            <ul className="min-w-0 flex-1 space-y-1" aria-label="Rating breakdown">
              {([5, 4, 3, 2, 1] as const).map((star) => (
                <li key={star} className="flex items-center gap-2 text-xs">
                  <span className="w-6 shrink-0 font-semibold text-heading">
                    {star}
                    <span aria-hidden className="text-gold"> ★</span>
                  </span>
                  <span className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-brand-tint">
                    <span
                      className="block h-full rounded-full bg-brand"
                      style={{ width: `${(breakdown.counts[star] / maxCount) * 100}%` }}
                    />
                  </span>
                  <span className="w-6 shrink-0 text-right text-ink-muted">{breakdown.counts[star]}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {submitted ? (
          <p role="status" className="mt-3 rounded-xl bg-mint px-3 py-2.5 text-xs font-semibold text-brand-dark">
            {submitted.pending
              ? "Thanks! Your review will appear once it has been approved."
              : "Thanks! Your review is now live."}
          </p>
        ) : (
          canReview && (
            <div id="write-review" className="scroll-mt-4">
              {!formOpen ? (
                <button
                  type="button"
                  onClick={() => setOpenedByTap(true)}
                  className="mt-3 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-full border-2 border-brand text-sm font-extrabold text-brand transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
                >
                  <PenLine className="h-4 w-4" />
                  Write a Review
                </button>
              ) : (
                <ReviewForm
                  productId={productId}
                  lines={reviewableLines}
                  onSubmitted={(pending) => setSubmitted({ pending })}
                />
              )}
            </div>
          )
        )}
      </section>

      {reviews.length > 0 && (
        <section aria-labelledby="reviews-title" className="rounded-2xl border border-line bg-white p-4">
          <h2 id="reviews-title" className="text-base font-extrabold text-heading">
            Product Reviews ({breakdown.total})
          </h2>

          <ul className="mt-2 divide-y divide-line">
            {visible.map((review) => (
              <li key={review.id} className="py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-heading">{displayName(review.userName)}</p>
                    <p className="mt-0.5 text-[11px] text-ink-muted">
                      {review.purchasedOption && <span>{review.purchasedOption} · </span>}
                      {formatDate(review.createdAt)}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-md border border-line px-1.5 py-1">
                    <Stars rating={review.rating} size="h-3.5 w-3.5" />
                  </span>
                </div>

                {review.isVerifiedPurchase && (
                  <p className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-brand">
                    <BadgeCheck className="h-3.5 w-3.5" aria-hidden />
                    Verified Purchase
                  </p>
                )}

                {review.body && (
                  <p className="mt-1.5 whitespace-pre-line break-words text-sm leading-relaxed text-ink">
                    {review.body}
                  </p>
                )}

                {review.images.length > 0 && (
                  <ul className="mt-2 flex flex-wrap gap-2">
                    {review.images.map((url) => (
                      <li key={url} className="relative h-16 w-16 overflow-hidden rounded-lg bg-mint">
                        <Image
                          src={url}
                          alt=""
                          fill
                          sizes="64px"
                          className="object-cover"
                          unoptimized={url.startsWith("/api/media/")}
                        />
                      </li>
                    ))}
                  </ul>
                )}

                {review.sellerReply && (
                  <div className="mt-2 rounded-lg bg-surface px-3 py-2 text-xs text-ink">
                    <span className="font-bold text-brand-dark">Seller reply: </span>
                    {review.sellerReply}
                  </div>
                )}
              </li>
            ))}
          </ul>

          {reviews.length > INITIAL_REVIEWS && (
            <button
              type="button"
              onClick={() => setShowAll((value) => !value)}
              aria-expanded={showAll}
              className="mt-1 min-h-[44px] w-full rounded-full bg-brand-tint text-sm font-bold text-brand-darkest transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              {showAll ? "Show fewer reviews" : `See all ${reviews.length} reviews`}
            </button>
          )}
        </section>
      )}
    </>
  );
}
