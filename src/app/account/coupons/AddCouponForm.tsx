"use client";

import { useActionState } from "react";
import { LoaderCircle } from "lucide-react";
import { addCouponCodeAction, type CollectResult } from "./actions";

export default function AddCouponForm() {
  const [state, action, pending] = useActionState<CollectResult, FormData>(addCouponCodeAction, { ok: false });
  return (
    <form action={action}>
      <div className="flex gap-2">
        <input
          name="code"
          placeholder="Enter coupon code"
          aria-label="Coupon code"
          autoCapitalize="characters"
          className="h-11 min-w-0 flex-1 rounded-xl border border-line bg-white px-3 text-[13px] font-semibold uppercase outline-none placeholder:font-normal placeholder:normal-case focus:border-brand"
        />
        <button type="submit" disabled={pending} className="h-11 shrink-0 rounded-xl bg-brand px-4 text-[13px] font-bold text-white disabled:opacity-60">
          {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : "Apply"}
        </button>
      </div>
      {state.error ? <p className="mt-1.5 text-[12px] font-semibold text-accent-red">{state.error}</p> : null}
      {state.ok ? <p className="mt-1.5 text-[12px] font-semibold text-success">Added to your coupons.</p> : null}
    </form>
  );
}
