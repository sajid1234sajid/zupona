"use client";

import { useState } from "react";
import { HandCoins } from "lucide-react";
import { formatPrice } from "@/lib/format";
import { recordPayoutAction } from "@/app/admin/(panel)/distributors/actions";

/** Records a payout to a store, after the admin has actually sent the money.
 *
 * Two steps on purpose: the first press shows where the money should go and
 * asks for the transfer reference, the second records it. A payout written by
 * a stray tap would tell a seller they had been paid when they had not. */
export default function PayoutButton({
  sellerId,
  storeName,
  amount,
  account,
}: {
  sellerId: string;
  storeName: string;
  amount: number;
  account: string;
}) {
  const [open, setOpen] = useState(false);

  if (amount <= 0) return <span className="text-[12px] text-neutral-300">—</span>;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 whitespace-nowrap rounded-lg border border-emerald-200 px-2 py-1.5 text-[12px] font-semibold text-emerald-700 transition hover:bg-emerald-50"
      >
        <HandCoins className="h-3.5 w-3.5" />
        {formatPrice(amount)}
      </button>
    );
  }

  return (
    <form
      action={recordPayoutAction}
      onSubmit={(event) => {
        if (!window.confirm(`Record that ${formatPrice(amount)} has been sent to ${storeName}?`)) {
          event.preventDefault();
        }
      }}
      className="w-56 space-y-1.5 rounded-xl border border-emerald-200 bg-emerald-50/60 p-2.5 text-left"
    >
      <input type="hidden" name="sellerId" value={sellerId} />
      <p className="text-[11px] text-neutral-500">
        Send <span className="font-bold text-neutral-800">{formatPrice(amount)}</span> to
      </p>
      <p className="break-words text-[12px] font-semibold text-neutral-800">{account}</p>
      <input
        name="reference"
        placeholder="TrxID / slip no."
        aria-label="Transfer reference"
        className="h-8 w-full rounded-lg border border-neutral-200 bg-white px-2 text-[12px] outline-none focus:border-brand"
      />
      <div className="flex gap-1.5">
        <button
          type="submit"
          className="flex-1 rounded-lg bg-brand px-2 py-1.5 text-[12px] font-semibold text-white hover:bg-brand-dark"
        >
          Mark as paid
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg px-2 py-1.5 text-[12px] font-semibold text-neutral-500 hover:bg-white"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
