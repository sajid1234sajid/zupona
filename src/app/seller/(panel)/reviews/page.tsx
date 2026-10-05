import Link from "next/link";
import { notFound } from "next/navigation";
import { BadgeCheck, Star } from "lucide-react";
import { getCurrentSeller } from "@/lib/sellers";
import {
  SELLER_PAGE_SIZE,
  getSellerReviewStats,
  listSellerReviews,
  type ReviewFilter,
} from "@/lib/sellerCenter";
import { formatRelative } from "@/lib/format";
import { resizedSrc } from "@/lib/image";
import { RatingBars } from "@/components/admin/charts";
import { Card, CardHeader, EmptyState, PageHeader, Pagination, Thumb } from "@/components/admin/ui";
import { Tabs, one } from "@/components/seller/ui";
import ReviewReplyForm from "@/components/seller/ReviewReplyForm";

export const metadata = { title: "Reviews" };

const FILTERS: { key: ReviewFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "unreplied", label: "Not replied" },
  { key: "low", label: "3 stars or less" },
];

function Stars({ rating }: { rating: number }) {
  return (
    <span className="flex items-center gap-0.5" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`h-3.5 w-3.5 ${star <= rating ? "fill-accent-orange text-accent-orange" : "text-neutral-200"}`}
        />
      ))}
    </span>
  );
}

export default async function SellerReviewsPage(props: PageProps<"/seller/reviews">) {
  const seller = await getCurrentSeller();
  if (!seller) notFound();

  const searchParams = await props.searchParams;
  const filter = (FILTERS.find((entry) => entry.key === one(searchParams.filter))?.key ?? "all") as ReviewFilter;
  const page = Math.max(1, Number(one(searchParams.page) ?? 1) || 1);

  const [reviews, stats] = await Promise.all([
    listSellerReviews(seller.id, { filter, page }),
    getSellerReviewStats(seller.id),
  ]);

  return (
    <>
      <PageHeader
        title="Reviews"
        subtitle="What customers say about your products — and your answers"
        breadcrumb={["Reviews"]}
      />

      <div className="grid gap-5 xl:grid-cols-12">
        <div className="min-w-0 xl:col-span-4">
          <Card>
            <CardHeader title="Your rating" subtitle="Across every product in your store" />
            <div className="mb-4 flex items-end gap-3">
              <span className="text-4xl font-extrabold text-neutral-900">
                {stats.total ? stats.average.toFixed(1) : "—"}
              </span>
              <div className="pb-1">
                <Stars rating={Math.round(stats.average)} />
                <p className="mt-0.5 text-[12px] text-neutral-400">
                  {stats.total} review{stats.total === 1 ? "" : "s"}
                </p>
              </div>
            </div>
            <RatingBars counts={stats.counts} total={stats.total} />
            {stats.unreplied > 0 ? (
              <p className="mt-4 rounded-xl bg-amber-50 px-3.5 py-2.5 text-[12px] text-amber-800">
                {stats.unreplied} review{stats.unreplied === 1 ? " is" : "s are"} waiting for your
                reply. A quick, polite answer — especially to an unhappy customer — wins the next
                buyer.
              </p>
            ) : null}
          </Card>
        </div>

        <div className="min-w-0 xl:col-span-8">
          <Tabs
            current={filter}
            items={FILTERS.map((entry) => ({
              key: entry.key,
              label: entry.label,
              count: entry.key === "unreplied" ? stats.unreplied : entry.key === "all" ? stats.total : undefined,
              href: entry.key === "all" ? "/seller/reviews" : `/seller/reviews?filter=${entry.key}`,
              urgent: entry.key === "unreplied",
            }))}
          />

          <Card>
            {reviews.rows.length === 0 ? (
              <EmptyState
                title={stats.total === 0 ? "No reviews yet" : "Nothing here"}
                detail={
                  stats.total === 0
                    ? "Customers can review a product after it is delivered to them."
                    : "No reviews match this filter."
                }
              />
            ) : (
              <>
                <ul className="divide-y divide-neutral-100">
                  {reviews.rows.map((review) => (
                    <li key={review.id} className="py-4 first:pt-0">
                      <Link
                        href={`/seller/products/${review.productId}`}
                        className="mb-2.5 flex items-center gap-2 text-[12px] text-neutral-500 hover:text-brand"
                      >
                        <Thumb
                          src={review.productImage ? resizedSrc(review.productImage, 64) : null}
                          alt=""
                          size={28}
                        />
                        <span className="truncate">{review.productName}</span>
                      </Link>

                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <Stars rating={review.rating} />
                        <span className="text-[13px] font-semibold text-neutral-800">
                          {review.customerName}
                        </span>
                        {review.verified ? (
                          <span className="flex items-center gap-0.5 text-[11px] font-medium text-emerald-600">
                            <BadgeCheck className="h-3.5 w-3.5" />
                            Verified purchase
                          </span>
                        ) : null}
                        <span className="text-[11px] text-neutral-400">
                          {formatRelative(review.createdAt)}
                        </span>
                      </div>

                      {review.title ? (
                        <p className="mt-1.5 text-[14px] font-semibold text-neutral-800">{review.title}</p>
                      ) : null}
                      {review.body ? (
                        <p className="mt-1 whitespace-pre-line text-[13px] leading-relaxed text-neutral-600">
                          {review.body}
                        </p>
                      ) : null}

                      {review.reply ? (
                        <div className="mt-3 rounded-xl border-l-2 border-brand bg-brand-tint/40 px-3.5 py-2.5">
                          <p className="text-[11px] font-semibold text-brand-dark">Your reply</p>
                          <p className="mt-0.5 whitespace-pre-line text-[13px] text-neutral-700">
                            {review.reply}
                          </p>
                        </div>
                      ) : null}

                      <div className="mt-2.5">
                        <ReviewReplyForm reviewId={review.id} reply={review.reply} />
                      </div>
                    </li>
                  ))}
                </ul>
                <Pagination
                  base="/seller/reviews"
                  params={{ filter: filter === "all" ? undefined : filter }}
                  page={page}
                  total={reviews.total}
                  pageSize={SELLER_PAGE_SIZE}
                  noun="reviews"
                />
              </>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
