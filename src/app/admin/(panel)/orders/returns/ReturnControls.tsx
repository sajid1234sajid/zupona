"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { buttonStyles, fieldStyles } from "@/components/admin/ui";
import { RETURN_STATUS_LABELS, type ReturnResolution, type ReturnStatus } from "@/lib/returnOptions";
import { advanceReturnAction } from "./actions";

/** The next step for one request: what it becomes, a note the customer
 * reads, the amount when money is settled, and whether the item goes back
 * on the shelf when it arrives. */
export default function ReturnControls({
  id,
  next,
  resolution,
  amount,
  most,
}: {
  id: string;
  next: ReturnStatus[];
  resolution: ReturnResolution;
  amount: number;
  most: number;
}) {
  const router = useRouter();
  // Settling defaults to what the customer asked for.
  const preferred: ReturnStatus =
    next.find((status) => status === (resolution === "refund" ? "refunded" : resolution === "exchange" ? "exchanged" : "store_credit")) ??
    next[0];
  const [status, setStatus] = useState<ReturnStatus>(preferred);
  const [note, setNote] = useState("");
  const [refund, setRefund] = useState(String(amount));
  const [restock, setRestock] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const money = status === "refunded" || status === "store_credit";

  return (
    <div className="mt-3 flex flex-col gap-2 border-t border-neutral-100 pt-3">
      <div className="flex flex-wrap gap-2">
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value as ReturnStatus)}
          className={`${fieldStyles} !h-10 w-auto`}
          aria-label="Next step"
        >
          {next.map((option) => (
            <option key={option} value={option}>
              {RETURN_STATUS_LABELS[option]}
            </option>
          ))}
        </select>
        {money ? (
          <label className="flex items-center gap-1.5 text-xs text-neutral-500">
            ৳
            <input
              type="number"
              min={0}
              max={most}
              value={refund}
              onChange={(event) => setRefund(event.target.value)}
              className={`${fieldStyles} !h-10 w-28`}
              aria-label="Amount"
            />
          </label>
        ) : null}
        {status === "received" ? (
          <label className="flex items-center gap-1.5 text-xs font-medium text-neutral-600">
            <input type="checkbox" checked={restock} onChange={(event) => setRestock(event.target.checked)} />
            Put back in stock
          </label>
        ) : null}
      </div>
      <input
        value={note}
        onChange={(event) => setNote(event.target.value)}
        maxLength={500}
        placeholder={status === "rejected" ? "Why (the customer reads this)" : "Note for the customer (optional)"}
        className={`${fieldStyles} !h-10`}
      />
      {error ? <p className="text-xs font-semibold text-red-600">{error}</p> : null}
      <button
        type="button"
        disabled={pending || (status === "rejected" && !note.trim())}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const result = await advanceReturnAction({
              id,
              status,
              note,
              refundAmount: money ? Number(refund) : null,
              restock: status === "received" && restock,
            });
            if (!result.ok) {
              setError(result.error ?? "Could not update.");
              return;
            }
            setNote("");
            router.refresh();
          })
        }
        className={`${status === "rejected" ? buttonStyles.danger : buttonStyles.primary} !py-2`}
      >
        {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
        Mark {RETURN_STATUS_LABELS[status].toLowerCase()}
      </button>
    </div>
  );
}
