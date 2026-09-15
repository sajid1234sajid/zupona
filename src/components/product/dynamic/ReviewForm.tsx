"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Star } from "lucide-react";
import type { ReviewableLine } from "@/lib/reviews";
import { submitReviewAction } from "@/app/products/[slug]/actions";

const RATING_WORDS = ["", "Poor", "Fair", "Good", "Very good", "Excellent"];

/** Stars and a comment for one delivered order line.
 *
 * A shopper who received the product more than once picks which order they
 * are reviewing, because each purchase earns its own review. */
export default function ReviewForm({
  productId,
  lines,
  onSubmitted,
}: {
  productId: string;
  lines: ReviewableLine[];
  onSubmitted: (pending: boolean) => void;
}) {
  const router = useRouter();
  const [orderItemId, setOrderItemId] = useState(lines[0]?.orderItemId ?? "");
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (rating === 0) {
      setError("Tap a star to rate the product.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await submitReviewAction({ productId, orderItemId, rating, body });
      if (!result.ok) {
        setError(result.error ?? "Could not post your review.");
        return;
      }
      onSubmitted(Boolean(result.pending));
      router.refresh();
    });
  }

  const shown = hovered || rating;

  return (
    <form onSubmit={submit} className="mt-3 rounded-xl border border-line bg-surface p-3.5">
      {lines.length > 1 && (
        <label className="mb-3 block text-xs font-semibold text-ink-muted">
          Which order?
          <select
            value={orderItemId}
            onChange={(event) => setOrderItemId(event.target.value)}
            className="mt-1 block min-h-[44px] w-full rounded-lg border border-line bg-white px-3 text-sm text-heading"
          >
            {lines.map((line) => (
              <option key={line.orderItemId} value={line.orderItemId}>
                Order #{line.orderNumber}
                {line.label ? ` · ${line.label}` : ""}
              </option>
            ))}
          </select>
        </label>
      )}

      <p className="text-xs font-semibold text-ink-muted">Your rating</p>
      <div
        role="radiogroup"
        aria-label="Rating"
        className="mt-1 flex items-center gap-0.5"
        onMouseLeave={() => setHovered(0)}
      >
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            role="radio"
            aria-checked={rating === star}
            aria-label={`${star} star${star === 1 ? "" : "s"}`}
            onClick={() => {
              setRating(star);
              setError(null);
            }}
            onMouseEnter={() => setHovered(star)}
            className="grid h-11 w-11 place-items-center rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            <Star
              className={`h-7 w-7 ${shown >= star ? "fill-gold text-gold" : "fill-line text-line"}`}
            />
          </button>
        ))}
        <span className="ml-2 text-sm font-semibold text-heading">{RATING_WORDS[shown]}</span>
      </div>

      <label className="mt-3 block text-xs font-semibold text-ink-muted">
        Your review <span className="font-normal">(optional)</span>
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          maxLength={1000}
          rows={4}
          placeholder="How was the quality, the size, the delivery?"
          className="mt-1 block w-full resize-y rounded-lg border border-line bg-white px-3 py-2.5 text-sm text-heading placeholder:text-ink-faint focus:border-brand focus:outline-none"
        />
      </label>

      {error && (
        <p role="alert" className="mt-2 rounded-lg bg-accent-red/10 px-3 py-2 text-xs font-semibold text-accent-red">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-3 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-full bg-brand text-sm font-extrabold text-white transition disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
      >
        {pending && <LoaderCircle className="h-4 w-4 animate-spin" />}
        Submit Review
      </button>
    </form>
  );
}
