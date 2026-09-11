"use client";

import { Minus, Plus } from "lucide-react";

/** Quantity, bounded by what is actually in stock.
 *
 * The ceiling is the selected variant's availability, so the plus button stops
 * at what can be bought rather than letting the shopper reach checkout and be
 * told no. This is a convenience, not a control: the same limit is enforced
 * again on the server, where it counts. */
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
    <div className="flex items-center justify-between gap-3 border-t border-line pt-4">
      <div>
        <p className="text-sm font-bold text-heading">Quantity</p>
        <p className="mt-0.5 flex items-center gap-1.5 text-[11px] font-bold">
          <span
            aria-hidden
            className={`inline-block h-2 w-2 rounded-full ${inStock ? "bg-brand" : "bg-accent-red"}`}
          />
          <span className={inStock ? "text-brand" : "text-accent-red"}>
            {inStock ? `In Stock · ${available} available` : "Out of Stock"}
          </span>
        </p>
      </div>

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

        <span aria-live="polite" className="min-w-10 text-center text-sm font-black text-heading">
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
