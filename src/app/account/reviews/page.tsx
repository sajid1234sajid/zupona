import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, Gift, PenLine, Star } from "lucide-react";
import Image from "@/components/ui/StoreImage";
import DesktopHeader from "@/components/layout/DesktopHeader";
import { requireUser } from "@/lib/session";
import { getMyReviews } from "@/lib/reviews";
import { getShopSettings } from "@/lib/shopSettings";
import { formatDate } from "@/lib/format";
import { RATING_WORDS } from "@/lib/reviewTags";

export const metadata: Metadata = { title: "My reviews — Zupona", robots: { index: false } };

/** What the shopper can still review, and what they already have.
 *
 * "To review" is every delivered order line without a review, newest first,
 * each linking straight to the form on its product page. */
export default async function MyReviewsPage({ searchParams }: PageProps<"/account/reviews">) {
  const user = await requireUser();
  const params = await searchParams;
  const tab = (Array.isArray(params.tab) ? params.tab[0] : params.tab) === "reviewed" ? "reviewed" : "to-review";
  const [{ toReview, reviewed }, settings] = await Promise.all([getMyReviews(user.id), getShopSettings()]);

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-brand-mist pb-10 tab:max-w-none tab:pb-12">
      <DesktopHeader />
      <header className="flex items-center gap-3 border-b border-line-soft bg-white px-4 py-3 tab:mx-auto tab:mt-6 tab:w-full tab:max-w-2xl tab:rounded-2xl tab:border">
        <Link href="/account" aria-label="Back to account">
          <ChevronLeft className="h-5 w-5 text-ink" />
        </Link>
        <h1 className="text-base font-bold text-heading">My reviews</h1>
      </header>

      <main className="flex-1 px-4 pt-4 tab:mx-auto tab:w-full tab:max-w-2xl tab:px-0">
        {settings.reviewPoints > 0 ? (
          <p className="mb-3 flex items-center gap-2 rounded-xl bg-badge-bg px-3 py-2 text-[12.5px] font-semibold text-heading">
            <Gift className="h-4 w-4 text-urgency" />
            Earn {settings.reviewPoints} points for each written review
            {settings.reviewPhotoPoints > 0 ? `, +${settings.reviewPhotoPoints} with a photo` : ""}.
          </p>
        ) : null}

        <div role="tablist" className="flex gap-1 rounded-xl bg-white p-1">
          {[
            { id: "to-review", label: `To review (${toReview.length})`, href: "/account/reviews" },
            { id: "reviewed", label: `Reviewed (${reviewed.length})`, href: "/account/reviews?tab=reviewed" },
          ].map((item) => (
            <Link
              key={item.id}
              role="tab"
              aria-selected={tab === item.id}
              href={item.href}
              className={`flex-1 rounded-lg py-2 text-center text-[13px] font-semibold ${
                tab === item.id ? "bg-brand text-white" : "text-ink-muted"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </div>

        {tab === "to-review" ? (
          toReview.length === 0 ? (
            <p className="mt-8 text-center text-[13px] text-ink-slate">
              Nothing to review right now. Items appear here once they are delivered.
            </p>
          ) : (
            <ul className="mt-3 flex flex-col gap-2">
              {toReview.map((task) => (
                <li key={task.orderItemId} className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-card">
                  <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-brand-mist">
                    {task.image ? <Image src={task.image} alt="" fill sizes="56px" className="object-cover" /> : null}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-2 block text-[13px] font-semibold text-heading">{task.name}</span>
                    <span className="block text-[11px] text-ink-muted">
                      Order {task.orderNumber}
                      {task.label ? ` · ${task.label}` : ""}
                    </span>
                  </span>
                  {task.slug ? (
                    <Link
                      href={`/products/${task.slug}#write-review`}
                      className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-brand px-3.5 text-[12px] font-bold text-white"
                    >
                      <PenLine className="h-3.5 w-3.5" /> Review
                    </Link>
                  ) : (
                    <span className="text-[11px] text-ink-faint">No longer sold</span>
                  )}
                </li>
              ))}
            </ul>
          )
        ) : reviewed.length === 0 ? (
          <p className="mt-8 text-center text-[13px] text-ink-slate">You haven&apos;t written any reviews yet.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {reviewed.map((review) => (
              <li key={review.id} className="rounded-2xl bg-white p-3 shadow-card">
                <div className="flex items-center gap-3">
                  <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-brand-mist">
                    {review.productImage ? (
                      <Image src={review.productImage} alt="" fill sizes="48px" className="object-cover" />
                    ) : null}
                  </span>
                  <span className="min-w-0 flex-1">
                    {review.productSlug ? (
                      <Link href={`/products/${review.productSlug}#reviews`} className="line-clamp-1 text-[13px] font-semibold text-heading hover:text-brand">
                        {review.productName}
                      </Link>
                    ) : (
                      <span className="line-clamp-1 text-[13px] font-semibold text-heading">{review.productName}</span>
                    )}
                    <span className="mt-0.5 flex items-center gap-1 text-[11.5px] text-ink-muted">
                      <Star className="h-3.5 w-3.5 fill-rating text-rating" />
                      {review.rating} · {RATING_WORDS[review.rating]} · {formatDate(review.createdAt)}
                    </span>
                  </span>
                </div>
                {review.body ? <p className="mt-2 line-clamp-3 text-[13px] text-ink">{review.body}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
