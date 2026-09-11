"use client";

import { useActionState, useState } from "react";
import { LoaderCircle, CircleAlert } from "lucide-react";
import {
  addPaymentMethodAction,
  type PaymentMethodActionState,
} from "@/app/account/payment-methods/actions";
import type { PaymentMethodType } from "@/types";
import { useRefreshOnSuccess } from "@/lib/useRefreshOnSuccess";

const TYPES: { value: PaymentMethodType; label: string }[] = [
  { value: "card", label: "Card" },
  { value: "bkash", label: "bKash" },
  { value: "nagad", label: "Nagad" },
  { value: "cod", label: "Cash on Delivery" },
];

export default function PaymentMethodForm({ onDone }: { onDone: () => void }) {
  const [type, setType] = useState<PaymentMethodType>("card");
  const [state, formAction, pending] = useActionState<PaymentMethodActionState, FormData>(
    addPaymentMethodAction,
    {}
  );
  useRefreshOnSuccess(state.success, onDone);

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-card">
      <div className="grid grid-cols-4 gap-1 rounded-full bg-brand-tint p-1">
        {TYPES.map(({ value, label }) => (
          <label key={value} className="relative">
            <input
              type="radio"
              name="type"
              value={value}
              checked={type === value}
              onChange={() => setType(value)}
              className="peer sr-only"
            />
            <span className="flex cursor-pointer items-center justify-center rounded-full px-1 py-2 text-center text-[10px] font-semibold leading-tight text-ink-slate peer-checked:bg-white peer-checked:text-brand-dark peer-checked:shadow-card">
              {label}
            </span>
          </label>
        ))}
      </div>

      {type === "card" && (
        <>
          <input
            name="cardNumber"
            placeholder="Card number"
            inputMode="numeric"
            autoComplete="cc-number"
            required
            className="rounded-xl border border-line px-4 py-3 text-sm outline-none focus:border-brand"
          />
          <div className="grid grid-cols-2 gap-3">
            <input
              name="holderName"
              placeholder="Cardholder name"
              autoComplete="cc-name"
              required
              className="rounded-xl border border-line px-4 py-3 text-sm outline-none focus:border-brand"
            />
            <input
              name="expiry"
              placeholder="MM/YY"
              autoComplete="cc-exp"
              required
              className="rounded-xl border border-line px-4 py-3 text-sm outline-none focus:border-brand"
            />
          </div>
          <p className="text-[11px] text-ink-slate">
            Only the last 4 digits are saved. We never store your full card number.
          </p>
        </>
      )}

      {(type === "bkash" || type === "nagad") && (
        <input
          name="mobileNumber"
          placeholder={`${type === "bkash" ? "bKash" : "Nagad"} account number`}
          type="tel"
          required
          className="rounded-xl border border-line px-4 py-3 text-sm outline-none focus:border-brand"
        />
      )}

      {type === "cod" && (
        <p className="rounded-xl bg-brand-tint px-4 py-3 text-xs text-ink-slate">
          Pay in cash when your order is delivered to your door.
        </p>
      )}

      <label className="flex items-center gap-2 text-xs font-medium text-ink-slate">
        <input
          type="checkbox"
          name="isDefault"
          className="h-4 w-4 rounded border-line text-brand focus:ring-brand"
        />
        Set as default payment method
      </label>

      {state.error && (
        <div className="flex items-center gap-2 rounded-xl bg-accent-red/10 px-4 py-3 text-xs font-medium text-accent-red">
          <CircleAlert className="h-4 w-4 shrink-0" />
          {state.error}
        </div>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onDone}
          className="flex-1 rounded-xl border border-line py-3 text-sm font-semibold text-ink-slate"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={pending}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand py-3 text-sm font-semibold text-white disabled:opacity-70"
        >
          {pending && <LoaderCircle className="h-4 w-4 animate-spin" />}
          Add Method
        </button>
      </div>
    </form>
  );
}
