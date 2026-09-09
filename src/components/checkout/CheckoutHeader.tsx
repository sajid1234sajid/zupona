"use client";

import { ChevronLeft, Leaf, Lock } from "lucide-react";

interface CheckoutHeaderProps {
  /** Omitted on the first step, where there is nothing to go back to in-flow. */
  onBack?: () => void;
  /** Step 3 spells out the reassurance line under "Secure Checkout". */
  secureNote?: string;
}

export default function CheckoutHeader({ onBack, secureNote }: CheckoutHeaderProps) {
  return (
    <header className="relative flex items-center gap-2 px-4 pb-3 pt-4">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          aria-label="Go back"
          className="-ml-1 shrink-0 rounded-full p-1 text-brand-darkest active:bg-brand-tint"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
      )}

      <div className="flex min-w-0 items-center gap-2">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-darkest">
          <Leaf className="h-5 w-5 text-brand-light" />
        </span>
        <div className="min-w-0 leading-tight">
          <p className="text-base font-extrabold text-brand-darkest">Zupona</p>
          <p className="truncate text-[10px] font-medium text-brand">Trusted Online Shop</p>
        </div>
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-1.5 text-right">
        <Lock className="h-3.5 w-3.5 text-brand-darkest" />
        <div className="leading-tight">
          <p className="text-[11px] font-bold text-brand-darkest">Secure Checkout</p>
          {secureNote && <p className="text-[9px] text-neutral-400">{secureNote}</p>}
        </div>
      </div>
    </header>
  );
}
