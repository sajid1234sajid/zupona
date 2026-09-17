"use client";

import { Minus, Plus } from "lucide-react";

/** Quantity, bounded by what is actually in stock.
 *
 * The ceiling is the selected variant's availability, so the plus button stops
 * at what can be bought rather than letting the shopper reach checkout and be
 * told no. This is a convenience, not a control: the same limit is enforced
 * again on the server, where it counts. The figure itself appears in the stats
 * row under the title only when the shop has chosen to show it. */
export default function QuantityPicker({
  quantity,
  available,
  onChange,
}: {
  quantity: number;
  available: number;
  onChange: (next: number) => void;
}) {
  const inStock = available > 0;

  return (
    <div className="flex items-center justify-between gap-3">
      <p className="text-sm font-bold text-heading">Quantity</p>

      <div className="flex h-11 items-center overflow-hidden rounded-xl border border-line bg-white">
        <button
          type="button"
          aria-label="Decrease quantity"
          disabled={quantity <= 1}
          onClick={() => onChange(Math.max(1, quantity - 1))}
          className="grid h-full w-11 place-items-center text-heading transition disabled:cursor-not-allowed disabled:opacity-35 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-inset"
        >
          <Minus className="h-4 w-4" />
        </button>

        <span aria-live="polite" className="min-w-10 text-center text-sm font-extrabold text-heading">
          {quantity}
        </span>

        <button
          type="button"
          aria-label="Increase quantity"
          disabled={!inStock || quantity >= available}
          onClick={() => onChange(Math.min(available, quantity + 1))}
          className="grid h-full w-11 place-items-center text-heading transition disabled:cursor-not-allowed disabled:opacity-35 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-inset"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
