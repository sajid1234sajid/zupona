"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Camera, LoaderCircle, Star, X } from "lucide-react";
import Image from "@/components/ui/StoreImage";
import type { ReviewableLine } from "@/lib/reviews";
import { submitReviewAction } from "@/app/products/[slug]/actions";
import {
  FIT_LABELS,
  MAX_REVIEW_PHOTOS,
  MAX_REVIEW_TAGS,
  RATING_WORDS,
  tagsFor,
  type ReviewFit,
} from "@/lib/reviewTags";

/** Longest side a review photo is shrunk to before it leaves the phone: a
 * 12-megapixel camera shot is 4MB on mobile data and nobody can see the
 * difference at the size a review shows it. */
const PHOTO_MAX_SIDE = 1600;

async function shrink(file: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, PHOTO_MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
    return blob ?? file;
  } catch {
    return file;
  }
}

/** Stars, fit, tags, words and photos for one delivered order line.
 *
 * A shopper who received the product more than once picks which order they
 * are reviewing, because each purchase earns its own review. Only the stars
 * are required. */
export default function ReviewForm({
  productId,
  lines,
  apparel,
  reward,
  onSubmitted,
}: {
  productId: string;
  lines: ReviewableLine[];
  /** Sold in sizes, so "how did it fit" is worth asking. */
  apparel: boolean;
  /** Points on offer, from Settings; zeros mean no reward is offered. */
  reward: { text: number; photo: number };
  onSubmitted: (result: { pending: boolean; points: number }) => void;
}) {
  const router = useRouter();
  const [orderItemId, setOrderItemId] = useState(lines[0]?.orderItemId ?? "");
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [fit, setFit] = useState<ReviewFit | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [body, setBody] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function addPhotos(files: FileList | null) {
    if (!files) return;
    const room = MAX_REVIEW_PHOTOS - photos.length;
    const chosen = Array.from(files)
      .filter((file) => /^image\/(jpeg|png|webp)$/.test(file.type))
      .slice(0, room);
    if (chosen.length === 0) return;
    setError(null);
    setUploading((n) => n + chosen.length);
    for (const file of chosen) {
      try {
        const form = new FormData();
        form.append("file", new File([await shrink(file)], "review.jpg", { type: "image/jpeg" }));
        const response = await fetch("/api/reviews/upload", { method: "POST", body: form });
        const result = (await response.json()) as { url?: string; error?: string };
        if (!response.ok || !result.url) throw new Error(result.error ?? "Upload failed.");
        setPhotos((current) => [...current, result.url as string].slice(0, MAX_REVIEW_PHOTOS));
      } catch (problem) {
        setError(problem instanceof Error ? problem.message : "A photo could not be uploaded.");
      } finally {
        setUploading((n) => n - 1);
      }
    }
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (rating === 0) {
      setError("Tap a star to rate the product.");
      return;
    }
    if (uploading > 0) {
      setError("Wait for the photos to finish uploading.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await submitReviewAction({ productId, orderItemId, rating, body, fit, tags, photos });
      if (!result.ok) {
        setError(result.error ?? "Could not post your review.");
        return;
      }
      onSubmitted({ pending: Boolean(result.pending), points: result.points ?? 0 });
      router.refresh();
    });
  }

  const shown = hovered || rating;
  const rewardOn = reward.text > 0;
  const textLength = body.trim().length;

  return (
    <form onSubmit={submit} className="mt-3 space-y-4 rounded-xl border border-line bg-surface p-3.5">
      {lines.length > 1 && (
        <label className="block text-xs font-semibold text-ink-muted">
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

      {rewardOn ? (
        <p className="rounded-lg bg-badge-bg px-3 py-2 text-[12px] font-semibold text-heading">
          Earn {reward.text} points for a written review
          {reward.photo > 0 ? `, +${reward.photo} with a photo` : ""}. Points never depend on your stars.
        </p>
      ) : null}

      <div>
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
              aria-label={`${star} star${star === 1 ? "" : "s"}: ${RATING_WORDS[star]}`}
              onClick={() => {
                setRating(star);
                setError(null);
              }}
              onMouseEnter={() => setHovered(star)}
              className="grid h-11 w-11 place-items-center rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              <Star className={`h-7 w-7 ${shown >= star ? "fill-rating text-rating" : "fill-line text-line"}`} />
            </button>
          ))}
          <span className="ml-2 text-sm font-semibold text-heading">{RATING_WORDS[shown]}</span>
        </div>
      </div>

      {apparel ? (
        <fieldset>
          <legend className="text-xs font-semibold text-ink-muted">How did it fit?</legend>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {(Object.keys(FIT_LABELS) as ReviewFit[]).map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={fit === value}
                onClick={() => setFit(fit === value ? null : value)}
                className={`h-9 rounded-full border px-3.5 text-[12.5px] font-semibold ${
                  fit === value ? "border-brand bg-brand-tint text-brand-dark" : "border-line bg-white text-ink"
                }`}
              >
                {FIT_LABELS[value]}
              </button>
            ))}
          </div>
        </fieldset>
      ) : null}

      <fieldset>
        <legend className="text-xs font-semibold text-ink-muted">
          What stood out? <span className="font-normal">(up to {MAX_REVIEW_TAGS})</span>
        </legend>
        <div className="mt-1.5 flex flex-wrap gap-2">
          {tagsFor(apparel).map((tag) => {
            const selected = tags.includes(tag.id);
            const full = !selected && tags.length >= MAX_REVIEW_TAGS;
            return (
              <button
                key={tag.id}
                type="button"
                aria-pressed={selected}
                disabled={full}
                onClick={() =>
                  setTags(selected ? tags.filter((t) => t !== tag.id) : [...tags, tag.id])
                }
                className={`h-9 rounded-full border px-3.5 text-[12.5px] font-semibold disabled:opacity-40 ${
                  selected ? "border-brand bg-brand-tint text-brand-dark" : "border-line bg-white text-ink"
                }`}
              >
                {tag.label}
              </button>
            );
          })}
        </div>
      </fieldset>

      <label className="block text-xs font-semibold text-ink-muted">
        Your review <span className="font-normal">(optional)</span>
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          maxLength={1000}
          rows={4}
          placeholder="How was the quality, the size, the delivery?"
          className="mt-1 block w-full resize-y rounded-lg border border-line bg-white px-3 py-2.5 text-sm text-heading placeholder:text-ink-faint focus:border-brand focus:outline-none"
        />
        {rewardOn && textLength > 0 && textLength < 20 ? (
          <span className="mt-1 block font-normal text-ink-faint">
            {20 - textLength} more characters to earn points
          </span>
        ) : null}
      </label>

      <div>
        <p className="text-xs font-semibold text-ink-muted">
          Photos <span className="font-normal">(up to {MAX_REVIEW_PHOTOS})</span>
        </p>
        <div className="mt-1.5 flex flex-wrap gap-2">
          {photos.map((url) => (
            <span key={url} className="relative h-16 w-16 overflow-hidden rounded-lg bg-mint">
              <Image src={url} alt="" fill sizes="64px" className="object-cover" />
              <button
                type="button"
                aria-label="Remove photo"
                onClick={() => setPhotos(photos.filter((photo) => photo !== url))}
                className="absolute right-0.5 top-0.5 grid h-5 w-5 place-items-center rounded-full bg-black/60 text-white"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          {Array.from({ length: uploading }).map((_, i) => (
            <span key={`up-${i}`} className="grid h-16 w-16 place-items-center rounded-lg bg-skeleton">
              <LoaderCircle className="h-5 w-5 animate-spin text-ink-muted" />
            </span>
          ))}
          {photos.length + uploading < MAX_REVIEW_PHOTOS ? (
            <label className="grid h-16 w-16 cursor-pointer place-items-center rounded-lg border-2 border-dashed border-line bg-white text-ink-muted hover:border-brand">
              <Camera className="h-5 w-5" />
              <span className="sr-only">Add photos</span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                className="sr-only"
                onChange={(event) => {
                  void addPhotos(event.target.files);
                  event.target.value = "";
                }}
              />
            </label>
          ) : null}
        </div>
      </div>

      {error && (
        <p role="alert" className="rounded-lg bg-accent-red/10 px-3 py-2 text-xs font-semibold text-accent-red">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-full bg-brand text-sm font-extrabold text-white transition disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
      >
        {pending && <LoaderCircle className="h-4 w-4 animate-spin" />}
        Submit Review
      </button>
    </form>
  );
}
