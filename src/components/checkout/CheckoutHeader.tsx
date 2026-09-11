"use client";

import { ChevronLeft, Lock } from "lucide-react";
import ZuponaMark from "@/components/brand/ZuponaMark";

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
        <ZuponaMark className="h-10 w-10 shrink-0" />
        <div className="min-w-0 leading-tight">
          <p className="text-[21px] font-extrabold leading-none text-brand-darkest">Zupona</p>
          <p className="truncate text-[11px] font-medium text-brand">Trusted Online Shop</p>
        </div>
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-1.5 text-right">
        <Lock className="h-4 w-4 text-brand-darkest" />
        <div className="leading-tight">
          <p className="text-[12px] font-bold text-brand-darkest">Secure Checkout</p>
          {secureNote && <p className="text-[9px] text-ink-slate">{secureNote}</p>}
        </div>
      </div>
    </header>
  );
}
