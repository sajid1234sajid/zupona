"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Camera, Check, LoaderCircle, Minus, Plus, X } from "lucide-react";
import Image from "@/components/ui/StoreImage";
import { formatPrice } from "@/lib/format";
import { shrinkPhoto } from "@/lib/shrinkPhoto";
import { requestReturnAction } from "@/app/account/orders/[id]/return/actions";
import {
  MAX_RETURN_PHOTOS,
  REFUND_METHODS,
  RESOLUTIONS,
  RETURN_REASONS,
  type RefundMethod,
  type ReturnReason,
  type ReturnResolution,
} from "@/lib/returnOptions";
import type { ReturnableLine } from "@/lib/returns";

/** Items and how many, why, photos, and how to settle it. Only what is
 * needed is asked: photos when the reason needs proof, the refund account
 * only for a refund. */
export default function ReturnForm({
  orderId,
  lines,
  changedMindAllowed,
}: {
  orderId: string;
  lines: ReturnableLine[];
  changedMindAllowed: boolean;
}) {
  const router = useRouter();
  const [quantities, setQuantities] = useState<Record<string, number>>(() =>
    lines.length === 1 ? { [lines[0].orderItemId]: lines[0].remaining } : {}
  );
  const [reason, setReason] = useState<ReturnReason | null>(null);
  const [detail, setDetail] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(0);
  const [resolution, setResolution] = useState<ReturnResolution>("refund");
  const [refundMethod, setRefundMethod] = useState<RefundMethod>("bkash");
  const [refundAccount, setRefundAccount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const reasons = RETURN_REASONS.filter((entry) => entry.id !== "changed_mind" || changedMindAllowed);
  const chosenReason = RETURN_REASONS.find((entry) => entry.id === reason);
  const chosen = lines.filter((line) => (quantities[line.orderItemId] ?? 0) > 0);
  const value = chosen.reduce((sum, line) => sum + line.price * (quantities[line.orderItemId] ?? 0), 0);
  const method = REFUND_METHODS.find((entry) => entry.id === refundMethod);

  function setQuantity(line: ReturnableLine, quantity: number) {
    setQuantities((current) => ({ ...current, [line.orderItemId]: Math.max(0, Math.min(line.remaining, quantity)) }));
  }

  async function addPhotos(files: FileList | null) {
    if (!files) return;
    const room = MAX_RETURN_PHOTOS - photos.length - uploading;
    const picked = Array.from(files)
      .filter((file) => /^image\/(jpeg|png|webp)$/.test(file.type))
      .slice(0, room);
    if (picked.length === 0) return;
    setError(null);
    setUploading((n) => n + picked.length);
    for (const file of picked) {
      try {
        const form = new FormData();
        form.append("file", new File([await shrinkPhoto(file)], "return.jpg", { type: "image/jpeg" }));
        const response = await fetch("/api/returns/upload", { method: "POST", body: form });
        const result = (await response.json()) as { url?: string; error?: string };
        if (!response.ok || !result.url) throw new Error(result.error ?? "Upload failed.");
        setPhotos((current) => [...current, result.url as string].slice(0, MAX_RETURN_PHOTOS));
      } catch (problem) {
        setError(problem instanceof Error ? problem.message : "A photo could not be uploaded.");
      } finally {
        setUploading((n) => n - 1);
      }
    }
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (chosen.length === 0) return setError("Choose the item you want to return.");
    if (!reason) return setError("Choose why you're returning it.");
    if (chosenReason?.photoRequired && photos.length === 0) return setError("Add a photo that shows the problem.");
    if (uploading > 0) return setError("Wait for the photos to finish uploading.");
    if (resolution === "refund" && !refundAccount.trim()) return setError("Enter where the refund should go.");
    setError(null);
    startTransition(async () => {
      const result = await requestReturnAction({
        orderId,
        items: chosen.map((line) => ({ orderItemId: line.orderItemId, quantity: quantities[line.orderItemId] })),
        reason,
        detail,
        photos,
        resolution,
        refundMethod: resolution === "refund" ? refundMethod : null,
        refundAccount: resolution === "refund" ? refundAccount : null,
      });
      if (!result.ok) {
        setError(result.error ?? "Could not send your request.");
        return;
      }
      router.push("/account/returns?sent=1");
    });
  }

  const card = "rounded-2xl bg-white p-4 shadow-card";
  const heading = "text-sm font-bold text-heading";
  const chip = (on: boolean) =>
    `min-h-10 rounded-xl border px-3 text-left text-[12.5px] font-semibold ${
      on ? "border-brand bg-brand-tint text-brand-dark" : "border-line bg-white text-ink"
    }`;

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <section className={card}>
        <h2 className={heading}>1. What are you returning?</h2>
        <ul className="mt-3 flex flex-col gap-3">
          {lines.map((line) => {
            const quantity = quantities[line.orderItemId] ?? 0;
            return (
              <li key={line.orderItemId} className="flex items-center gap-3">
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={quantity > 0}
                  aria-label={`Return ${line.name}`}
                  onClick={() => setQuantity(line, quantity > 0 ? 0 : 1)}
                  className={`grid h-6 w-6 shrink-0 place-items-center rounded-md border-2 ${
                    quantity > 0 ? "border-brand bg-brand text-white" : "border-line bg-white"
                  }`}
                >
                  {quantity > 0 ? <Check className="h-4 w-4" /> : null}
                </button>
                <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-brand-mist">
                  <Image src={line.image} alt="" fill sizes="56px" className="object-cover" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-[13px] font-semibold text-heading">{line.name}</p>
                  <p className="text-xs text-ink-slate">
                    {line.color ? `${line.color} · ` : ""}
                    {formatPrice(line.price)} each
                  </p>
                </div>
                {line.remaining > 1 && quantity > 0 ? (
                  <div className="flex shrink-0 items-center rounded-full border border-line">
                    <button
                      type="button"
                      aria-label="One fewer"
                      onClick={() => setQuantity(line, quantity - 1)}
                      className="grid h-8 w-8 place-items-center"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <span className="w-5 text-center text-sm font-bold" aria-live="polite">
                      {quantity}
                    </span>
                    <button
                      type="button"
                      aria-label="One more"
                      disabled={quantity >= line.remaining}
                      onClick={() => setQuantity(line, quantity + 1)}
                      className="grid h-8 w-8 place-items-center disabled:opacity-30"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      </section>

      <section className={card}>
        <h2 className={heading}>2. Why?</h2>
        <div className="mt-3 grid grid-cols-1 gap-2 tab:grid-cols-2">
          {reasons.map((entry) => (
            <button
              key={entry.id}
              type="button"
              aria-pressed={reason === entry.id}
              onClick={() => setReason(entry.id)}
              className={chip(reason === entry.id)}
            >
              {entry.label}
            </button>
          ))}
        </div>
        {chosenReason ? (
          <p className="mt-2 text-[12px] text-ink-slate">
            {chosenReason.ourFault
              ? "Pickup is free, because the mistake was ours."
              : "The courier charge for the pickup may be taken off your refund."}
          </p>
        ) : null}
        <label className="mt-3 block text-xs font-semibold text-ink-muted">
          Tell us more <span className="font-normal">(optional)</span>
          <textarea
            value={detail}
            onChange={(event) => setDetail(event.target.value)}
            maxLength={1000}
            rows={3}
            placeholder="What's wrong with it?"
            className="mt-1 block w-full resize-y rounded-lg border border-line bg-white px-3 py-2.5 text-sm text-heading placeholder:text-ink-faint focus:border-brand focus:outline-none"
          />
        </label>
      </section>

      <section className={card}>
        <h2 className={heading}>
          3. Photos{" "}
          <span className="text-xs font-normal text-ink-slate">
            {chosenReason?.photoRequired ? "(needed for this reason)" : "(optional)"}
          </span>
        </h2>
        <div className="mt-3 flex flex-wrap gap-2">
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
          {photos.length + uploading < MAX_RETURN_PHOTOS ? (
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
      </section>

      <section className={card}>
        <h2 className={heading}>4. What would you like?</h2>
        <div className="mt-3 flex flex-col gap-2">
          {RESOLUTIONS.map((entry) => (
            <button
              key={entry.id}
              type="button"
              aria-pressed={resolution === entry.id}
              onClick={() => setResolution(entry.id)}
              className={`${chip(resolution === entry.id)} py-2`}
            >
              <span className="block">{entry.label}</span>
              <span className="block text-[11.5px] font-normal text-ink-slate">{entry.detail}</span>
            </button>
          ))}
        </div>
        {resolution === "refund" ? (
          <div className="mt-3 grid grid-cols-1 gap-2 tab:grid-cols-[160px_1fr]">
            <label className="block text-xs font-semibold text-ink-muted">
              Refund to
              <select
                value={refundMethod}
                onChange={(event) => setRefundMethod(event.target.value as RefundMethod)}
                className="mt-1 block h-11 w-full rounded-lg border border-line bg-white px-2 text-sm text-heading"
              >
                {REFUND_METHODS.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-semibold text-ink-muted">
              {refundMethod === "bank" ? "Bank account" : "Number"}
              <input
                value={refundAccount}
                onChange={(event) => setRefundAccount(event.target.value)}
                inputMode={refundMethod === "bank" ? "text" : "tel"}
                maxLength={200}
                placeholder={method?.placeholder}
                className="mt-1 block h-11 w-full rounded-lg border border-line bg-white px-3 text-sm text-heading placeholder:text-ink-faint focus:border-brand focus:outline-none"
              />
            </label>
          </div>
        ) : null}
      </section>

      {error ? (
        <p role="alert" className="rounded-lg bg-accent-red/10 px-3 py-2 text-xs font-semibold text-accent-red">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-full bg-brand text-sm font-extrabold text-white disabled:opacity-60"
      >
        {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
        Send return request{value > 0 ? ` · ${formatPrice(value)}` : ""}
      </button>
      <p className="text-center text-[11.5px] text-ink-slate">
        We reply within 2 working days. Keep the item with its tags and packaging until it&apos;s collected.
      </p>
    </form>
  );
}
