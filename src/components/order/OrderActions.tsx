"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileText, LoaderCircle, MessageCircle, PackageOpen, PenLine, RotateCcw, Truck, X } from "lucide-react";
import { buyAgainAction, cancelMyOrderAction } from "@/app/account/orders/actions";
import { CANCEL_REASONS } from "@/lib/cancelReasons";

/** What a shopper can do with an order, by where it is:
 *  - placed or confirmed: cancel (with a reason) or ask for help;
 *  - shipped: track it or ask for help;
 *  - delivered: review, return, buy again, open the invoice;
 *  - cancelled: buy again. */
export default function OrderActions({
  orderId,
  status,
  supportHref,
  showTrack = true,
}: {
  orderId: string;
  status: string;
  supportHref: string;
  showTrack?: boolean;
}) {
  const router = useRouter();
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState<string>(CANCEL_REASONS[0]);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const button =
    "inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-xl border px-3 text-[12px] font-bold";
  const primary = `${button} border-brand bg-white text-brand-darkest`;
  const quiet = `${button} border-line bg-white text-ink`;

  const canCancel = status === "placed" || status === "confirmed";
  const shipped = status === "shipped" || status === "out_for_delivery";
  const delivered = status === "delivered";
  const cancelled = status === "cancelled";

  function buyAgain() {
    setMessage(null);
    startTransition(async () => {
      const result = await buyAgainAction(orderId);
      if (result.added > 0) {
        router.push("/cart");
        return;
      }
      setMessage(
        result.skipped.length > 0
          ? `${result.skipped.join(", ")} can't be bought right now.`
          : "Nothing could be added."
      );
    });
  }

  return (
    <div className="mt-3">
      {cancelling ? (
        <div className="rounded-xl border border-line p-3">
          <label className="block text-[12px] font-semibold text-ink-muted">
            Why are you cancelling?
            <select
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              className="mt-1 block h-10 w-full rounded-lg border border-line bg-white px-2 text-[13px] text-ink"
            >
              {CANCEL_REASONS.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
          </label>
          <div className="mt-2.5 flex gap-2">
            <button type="button" onClick={() => setCancelling(false)} className={quiet}>
              Keep order
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const result = await cancelMyOrderAction(orderId, reason);
                  if (!result.ok) {
                    setMessage(result.error ?? "Could not cancel.");
                    return;
                  }
                  setCancelling(false);
                  router.refresh();
                })
              }
              className={`${button} border-accent-red bg-accent-red text-white`}
            >
              {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
              Cancel order
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {showTrack && !cancelled ? (
            <Link href={`/account/orders/${orderId}`} className={primary}>
              <Truck className="h-4 w-4" /> {delivered ? "Details" : "Track"}
            </Link>
          ) : null}
          {canCancel ? (
            <button type="button" onClick={() => setCancelling(true)} className={quiet}>
              <X className="h-4 w-4" /> Cancel
            </button>
          ) : null}
          {canCancel || shipped ? (
            <a href={supportHref} target="_blank" rel="noopener noreferrer" className={quiet}>
              <MessageCircle className="h-4 w-4" /> Help
            </a>
          ) : null}
          {delivered ? (
            <>
              <Link href="/account/reviews" className={quiet}>
                <PenLine className="h-4 w-4" /> Review
              </Link>
              <Link href={`/account/orders/${orderId}/return`} className={quiet}>
                <PackageOpen className="h-4 w-4" /> Return
              </Link>
              <Link href={`/account/orders/${orderId}/invoice`} className={quiet}>
                <FileText className="h-4 w-4" /> Invoice
              </Link>
            </>
          ) : null}
          {delivered || cancelled ? (
            <button type="button" onClick={buyAgain} disabled={pending} className={primary}>
              {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
              Buy again
            </button>
          ) : null}
        </div>
      )}
      {message ? <p className="mt-2 text-[12px] font-semibold text-accent-red">{message}</p> : null}
    </div>
  );
}
