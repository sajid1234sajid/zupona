"use client";

import { useMemo, useState, useSyncExternalStore, useTransition } from "react";
import Image from "@/components/ui/StoreImage";
import { BadgeCheck, ChevronLeft, ChevronRight, Gift, PenLine, Star, ThumbsUp, X } from "lucide-react";
import type { Review } from "@/types";
import type { RatingBreakdown, ReviewableLine } from "@/lib/reviews";
import { formatDate } from "@/lib/format";
import { FIT_LABELS, RATING_WORDS, maskName, tagLabel } from "@/lib/reviewTags";
import { voteHelpfulAction } from "@/app/products/[slug]/actions";
import ReviewForm from "./ReviewForm";

/** How many reviews show before "See all". */
const INITIAL_REVIEWS = 5;
/** Fewer fit answers than this and the bar would be one person's opinion. */
const MIN_FIT_ANSWERS = 5;

type Sort = "relevant" | "newest" | "highest" | "lowest";
type Filter = { kind: "all" } | { kind: "photos" } | { kind: "stars"; value: number } | { kind: "tag"; value: string };

function Stars({ rating, size = "h-4 w-4" }: { rating: number; size?: string }) {
  return (
    <span className="flex items-center gap-0.5" aria-label={`Rated ${rating} out of 5`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          aria-hidden
          className={`${size} ${rating >= star - 0.25 ? "fill-rating text-rating" : "fill-line text-line"}`}
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

/** "Most relevant": a review with photos, words and helpful votes says more
 * than a bare star. */
function relevance(review: Review): number {
  return (
    (review.images.length > 0 ? 3 : 0) +
    Math.min(3, (review.body?.length ?? 0) / 150) +
    Math.min(3, review.helpfulCount / 2)
  );
}

/** The rating summary, the write-a-review entry point and the review list.
 *
 * Everything shown is an approved review in the database. With none, the page
 * says so rather than drawing an empty histogram or "0.0". The form is only
 * offered to a signed-in shopper holding a delivered, unreviewed order of
 * this product -- the server checks the same thing again on submit. */
export default function ProductReviews({
  productId,
  breakdown,
  reviews,
  reviewableLines,
  apparel,
  reward,
}: {
  productId: string;
  breakdown: RatingBreakdown;
  reviews: Review[];
  reviewableLines: ReviewableLine[];
  apparel: boolean;
  reward: { text: number; photo: number };
}) {
  const [openedByTap, setOpenedByTap] = useState(false);
  const [submitted, setSubmitted] = useState<null | { pending: boolean; points: number }>(null);
  const [showAll, setShowAll] = useState(false);
  const [filter, setFilter] = useState<Filter>({ kind: "all" });
  const [sort, setSort] = useState<Sort>("relevant");
  const [lightbox, setLightbox] = useState<{ photos: string[]; index: number } | null>(null);

  // The order page links straight to the form with #write-review. Read as an
  // external store so the server render (no hash) and hydration agree.
  const hash = useSyncExternalStore(subscribeToHash, readHash, () => "");
  const formOpen = openedByTap || hash === "#write-review";

  const canReview = reviewableLines.length > 0;
  const maxCount = Math.max(1, ...Object.values(breakdown.counts));
  const fitAnswers = breakdown.fit.small + breakdown.fit.true + breakdown.fit.large;

  const listed = useMemo(() => {
    const matching = reviews.filter((review) => {
      switch (filter.kind) {
        case "photos":
          return review.images.length > 0;
        case "stars":
          return review.rating === filter.value;
        case "tag":
          return (review.tags ?? []).includes(filter.value);
        default:
          return true;
      }
    });
    const by: Record<Sort, (a: Review, b: Review) => number> = {
      relevant: (a, b) => relevance(b) - relevance(a),
      newest: (a, b) => b.createdAt.localeCompare(a.createdAt),
      highest: (a, b) => b.rating - a.rating || b.createdAt.localeCompare(a.createdAt),
      lowest: (a, b) => a.rating - b.rating || b.createdAt.localeCompare(a.createdAt),
    };
    return [...matching].sort(by[sort]);
  }, [reviews, filter, sort]);

  const visible = showAll ? listed : listed.slice(0, INITIAL_REVIEWS);
  const same = (f: Filter) => JSON.stringify(f) === JSON.stringify(filter);
  const pick = (f: Filter) => {
    setFilter(same(f) ? { kind: "all" } : f);
    setShowAll(false);
  };

  const chip = (active: boolean) =>
    `inline-flex h-8 shrink-0 items-center gap-1 rounded-full border px-3 text-[12px] font-semibold ${
      active ? "border-brand bg-brand-tint text-brand-dark" : "border-line bg-white text-ink"
    }`;

  return (
    <>
      <section
        id="reviews"
        aria-labelledby="rating-title"
        className="scroll-mt-4 rounded-2xl border border-line bg-white p-4 tab:p-6"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="rating-title" className="text-base font-extrabold text-heading tab:text-lg">
            Ratings &amp; Reviews
          </h2>
          <p className="flex items-center gap-1 text-[11.5px] font-semibold text-success">
            <BadgeCheck className="h-3.5 w-3.5" aria-hidden />
            Only verified buyers can review
          </p>
        </div>

        {breakdown.total === 0 ? (
          <p className="mt-2 text-sm text-ink-muted">No reviews yet. Be the first after your order arrives.</p>
        ) : (
          <>
            {breakdown.photos.length > 0 ? (
              <div className="mt-3">
                <p className="text-[12px] font-semibold text-ink-muted">
                  Customer photos ({breakdown.withPhotos})
                </p>
                <div className="no-scrollbar mt-1.5 flex gap-2 overflow-x-auto">
                  {breakdown.photos.map((url, i) => (
                    <button
                      key={url}
                      type="button"
                      onClick={() => setLightbox({ photos: breakdown.photos, index: i })}
                      className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-mint tab:h-20 tab:w-20"
                    >
                      <Image src={url} alt="Customer photo" fill sizes="80px" className="object-cover" />
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="mt-3 flex items-center gap-4">
              <div className="shrink-0 text-center">
                <p className="text-[40px] font-extrabold leading-none text-heading">
                  {breakdown.average.toFixed(1)}
                </p>
                <div className="mt-1 flex justify-center">
                  <Stars rating={breakdown.average} size="h-3.5 w-3.5" />
                </div>
                <p className="mt-1 text-[11px] text-ink-muted">
                  {breakdown.total} {breakdown.total === 1 ? "review" : "reviews"}
                </p>
              </div>

              <ul className="min-w-0 flex-1 space-y-1" aria-label="Rating breakdown">
                {([5, 4, 3, 2, 1] as const).map((star) => (
                  <li key={star}>
                    <button
                      type="button"
                      disabled={breakdown.counts[star] === 0}
                      onClick={() => pick({ kind: "stars", value: star })}
                      aria-pressed={same({ kind: "stars", value: star })}
                      className="flex w-full items-center gap-2 rounded text-xs disabled:cursor-default"
                    >
                      <span className="w-6 shrink-0 text-left font-semibold text-heading">
                        {star}
                        <span aria-hidden className="text-rating"> ★</span>
                      </span>
                      <span className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-brand-tint">
                        <span
                          className={`block h-full rounded-full ${same({ kind: "stars", value: star }) ? "bg-brand-dark" : "bg-brand"}`}
                          style={{ width: `${(breakdown.counts[star] / maxCount) * 100}%` }}
                        />
                      </span>
                      <span className="w-6 shrink-0 text-right text-ink-muted">{breakdown.counts[star]}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            {apparel && fitAnswers >= MIN_FIT_ANSWERS ? (
              <div className="mt-4">
                <p className="text-[12px] font-semibold text-ink-muted">How it fits</p>
                <div className="mt-1.5 grid grid-cols-3 gap-2 text-center text-[11.5px]">
                  {(["small", "true", "large"] as const).map((key) => {
                    const percent = Math.round((breakdown.fit[key] / fitAnswers) * 100);
                    return (
                      <div key={key}>
                        <div className="h-1.5 overflow-hidden rounded-full bg-brand-tint">
                          <div className="h-full rounded-full bg-brand" style={{ width: `${percent}%` }} />
                        </div>
                        <p className="mt-1 text-ink">
                          {FIT_LABELS[key]} <span className="font-bold">{percent}%</span>
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </>
        )}

        {submitted ? (
          <p role="status" className="mt-3 rounded-xl bg-mint px-3 py-2.5 text-xs font-semibold text-brand-dark">
            {submitted.pending
              ? "Thanks! Your review will appear once it has been checked."
              : submitted.points > 0
                ? `Thanks! Your review is live and you earned ${submitted.points} points.`
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
                  {reward.text > 0 ? <span className="font-semibold">· earn {reward.text}+ points</span> : null}
                </button>
              ) : (
                <ReviewForm
                  productId={productId}
                  lines={reviewableLines}
                  apparel={apparel}
                  reward={reward}
                  onSubmitted={setSubmitted}
                />
              )}
            </div>
          )
        )}
      </section>

      {reviews.length > 0 && (
        <section aria-labelledby="reviews-title" className="rounded-2xl border border-line bg-white p-4 tab:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="reviews-title" className="text-base font-extrabold text-heading">
              Reviews ({breakdown.total})
            </h2>
            <label className="flex items-center gap-1.5 text-[12px] text-ink-muted">
              Sort
              <select
                value={sort}
                onChange={(event) => setSort(event.target.value as Sort)}
                className="h-8 rounded-lg border border-line bg-white px-2 text-[12px] font-semibold text-ink"
              >
                <option value="relevant">Most relevant</option>
                <option value="newest">Newest</option>
                <option value="highest">Highest rated</option>
                <option value="lowest">Lowest rated</option>
              </select>
            </label>
          </div>

          <div className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4 tab:mx-0 tab:flex-wrap tab:px-0">
            <button type="button" onClick={() => pick({ kind: "all" })} className={chip(filter.kind === "all")}>
              All
            </button>
            {breakdown.withPhotos > 0 ? (
              <button type="button" onClick={() => pick({ kind: "photos" })} className={chip(filter.kind === "photos")}>
                With photos ({breakdown.withPhotos})
              </button>
            ) : null}
            {breakdown.tags.slice(0, 6).map((tag) => (
              <button
                key={tag.id}
                type="button"
                onClick={() => pick({ kind: "tag", value: tag.id })}
                className={chip(same({ kind: "tag", value: tag.id }))}
              >
                {tagLabel(tag.id)} ({tag.count})
              </button>
            ))}
            {([5, 4, 3, 2, 1] as const)
              .filter((star) => breakdown.counts[star] > 0)
              .map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => pick({ kind: "stars", value: star })}
                  className={chip(same({ kind: "stars", value: star }))}
                >
                  {star}★ ({breakdown.counts[star]})
                </button>
              ))}
          </div>

          {visible.length === 0 ? (
            <p className="py-6 text-center text-sm text-ink-muted">No reviews match this filter.</p>
          ) : (
            <ul className="mt-2 divide-y divide-line">
              {visible.map((review) => (
                <ReviewItem
                  key={review.id}
                  review={review}
                  onPhoto={(index) => setLightbox({ photos: review.images, index })}
                />
              ))}
            </ul>
          )}

          {listed.length > INITIAL_REVIEWS && (
            <button
              type="button"
              onClick={() => setShowAll((value) => !value)}
              aria-expanded={showAll}
              className="mt-1 min-h-[44px] w-full rounded-full bg-brand-tint text-sm font-bold text-brand-darkest transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              {showAll ? "Show fewer reviews" : `See all ${listed.length} reviews`}
            </button>
          )}
        </section>
      )}

      {lightbox ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Customer photo"
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/90"
          onClick={() => setLightbox(null)}
        >
          <button type="button" aria-label="Close" className="absolute right-3 top-3 grid h-10 w-10 place-items-center rounded-full bg-white/15 text-white">
            <X className="h-5 w-5" />
          </button>
          {lightbox.photos.length > 1 ? (
            <>
              <button
                type="button"
                aria-label="Previous photo"
                onClick={(event) => {
                  event.stopPropagation();
                  setLightbox({ ...lightbox, index: (lightbox.index - 1 + lightbox.photos.length) % lightbox.photos.length });
                }}
                className="absolute left-3 grid h-10 w-10 place-items-center rounded-full bg-white/15 text-white"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                type="button"
                aria-label="Next photo"
                onClick={(event) => {
                  event.stopPropagation();
                  setLightbox({ ...lightbox, index: (lightbox.index + 1) % lightbox.photos.length });
                }}
                className="absolute right-3 grid h-10 w-10 place-items-center rounded-full bg-white/15 text-white"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </>
          ) : null}
          <div className="relative h-[80vh] w-[92vw] max-w-3xl" onClick={(event) => event.stopPropagation()}>
            <Image
              src={lightbox.photos[lightbox.index]}
              alt="Customer photo"
              fill
              sizes="92vw"
              style={{ objectFit: "contain" }}
            />
          </div>
        </div>
      ) : null}
    </>
  );
}

function ReviewItem({ review, onPhoto }: { review: Review; onPhoto: (index: number) => void }) {
  const [helpful, setHelpful] = useState(review.helpfulCount);
  const [voted, setVoted] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <li className="py-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-heading">{maskName(review.userName)}</p>
          <p className="mt-0.5 text-[11px] text-ink-muted">
            {formatDate(review.createdAt)}
            {review.purchasedOption ? <span> · {review.purchasedOption}</span> : null}
          </p>
        </div>
        {review.incentivized ? (
          <span
            title="The reviewer received points for writing this review. Points never depend on the rating."
            className="inline-flex shrink-0 items-center gap-1 rounded-full bg-badge-bg px-2 py-0.5 text-[10.5px] font-semibold text-ink"
          >
            <Gift className="h-3 w-3 text-urgency" /> Rewarded review
          </span>
        ) : null}
      </div>

      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
        <Stars rating={review.rating} size="h-3.5 w-3.5" />
        <span className="text-[12px] font-semibold text-heading">{RATING_WORDS[review.rating]}</span>
        {review.isVerifiedPurchase && (
          <span className="flex items-center gap-1 text-[11px] font-semibold text-success">
            <BadgeCheck className="h-3.5 w-3.5" aria-hidden />
            Verified purchase
          </span>
        )}
      </div>

      {review.fit || (review.tags ?? []).length > 0 ? (
        <p className="mt-1.5 flex flex-wrap gap-1.5">
          {review.fit ? (
            <span className="rounded-full bg-brand-mist px-2 py-0.5 text-[11px] font-semibold text-brand-dark">
              {FIT_LABELS[review.fit]}
            </span>
          ) : null}
          {(review.tags ?? []).map((tag) =>
            tagLabel(tag) ? (
              <span key={tag} className="rounded-full bg-brand-mist px-2 py-0.5 text-[11px] font-semibold text-brand-dark">
                {tagLabel(tag)}
              </span>
            ) : null
          )}
        </p>
      ) : null}

      {review.body && (
        <p className="mt-1.5 whitespace-pre-line break-words text-sm leading-relaxed text-ink">{review.body}</p>
      )}

      {review.images.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-2">
          {review.images.map((url, i) => (
            <li key={url}>
              <button
                type="button"
                onClick={() => onPhoto(i)}
                className="relative block h-16 w-16 overflow-hidden rounded-lg bg-mint"
              >
                <Image src={url} alt="Review photo" fill sizes="64px" className="object-cover" />
              </button>
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

      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          disabled={voted || pending}
          onClick={() =>
            startTransition(async () => {
              const result = await voteHelpfulAction(review.id);
              if (result.ok && typeof result.count === "number") {
                setHelpful(result.count);
                setVoted(true);
              } else setNote(result.error ?? null);
            })
          }
          className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[12px] font-semibold ${
            voted ? "border-brand bg-brand-tint text-brand-dark" : "border-line text-ink-muted hover:border-brand"
          }`}
        >
          <ThumbsUp className="h-3.5 w-3.5" />
          Helpful{helpful > 0 ? ` (${helpful})` : ""}
        </button>
        {note ? <span className="text-[11px] text-ink-muted">{note}</span> : null}
      </div>
    </li>
  );
}
