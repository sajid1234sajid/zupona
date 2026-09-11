"use client";

import {
  ArrowRight,
  Banknote,
  CircleAlert,
  CreditCard,
  Landmark,
  Lock,
  LoaderCircle,
  ShieldCheck,
} from "lucide-react";
import { paymentOptions, type PaymentMethodId } from "@/lib/checkout";
import OrderSummary, { type SummaryLine } from "./OrderSummary";
import VerificationCard from "./VerificationCard";

const PAYMENT_ICONS: Record<PaymentMethodId, typeof Banknote> = {
  cod: Banknote,
  online: CreditCard,
  bank: Landmark,
};

/** Wallet/card marks shown under the online-payment option. */
const WALLET_MARKS = [
  { label: "bKash", className: "text-[#e2136e]" },
  { label: "Nagad", className: "text-[#ec1c24]" },
  { label: "Rocket", className: "text-[#8c3494]" },
  { label: "VISA", className: "text-[#1a1f71]" },
  { label: "Mastercard", className: "text-[#eb001b]" },
];

interface StepPaymentProps {
  paymentMethod: PaymentMethodId;
  onPaymentMethodChange: (id: PaymentMethodId) => void;
  phone: string;
  phoneVerified: boolean;
  code: string;
  onCodeChange: (code: string) => void;
  onResend: () => void;
  resending: boolean;
  demoCode: string | null;
  resendAt: number;
  lines: SummaryLine[];
  subtotal: number;
  deliveryFee: number;
  pending: boolean;
  error?: string;
}

export default function StepPayment({
  paymentMethod,
  onPaymentMethodChange,
  phone,
  phoneVerified,
  code,
  onCodeChange,
  onResend,
  resending,
  demoCode,
  resendAt,
  lines,
  subtotal,
  deliveryFee,
  pending,
  error,
}: StepPaymentProps) {
  const total = subtotal + deliveryFee;

  return (
    <div className="flex flex-col gap-3 px-4 pb-4">
      <section className="rounded-2xl border border-line-soft bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand">
            <CreditCard className="h-4 w-4 text-white" />
          </span>
          <div>
            <h2 className="text-sm font-bold text-ink-strong">Payment method</h2>
            <p className="text-[10px] text-ink-slate">Choose your preferred payment method</p>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          {paymentOptions.map((option) => {
            const Icon = PAYMENT_ICONS[option.id];
            const selected = paymentMethod === option.id;

            return (
              <label
                key={option.id}
                className={`flex cursor-pointer items-start gap-2.5 rounded-xl border p-3 transition-colors ${
                  selected ? "border-brand bg-brand-tint/50" : "border-line bg-white"
                }`}
              >
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                    selected ? "bg-brand text-white" : "bg-brand-mist text-ink-slate"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                </span>

                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-xs font-bold text-ink-strong">{option.name}</span>
                    {option.badge && (
                      <span className="shrink-0 rounded-md bg-brand-tint px-1.5 py-0.5 text-[9px] font-bold text-brand-dark">
                        {option.badge}
                      </span>
                    )}
                  </span>
                  <span className="mt-0.5 block text-[10px] leading-tight text-ink-slate">
                    {option.tagline}
                  </span>

                  {option.id === "online" && (
                    <span className="mt-1.5 flex flex-wrap items-center gap-1">
                      {WALLET_MARKS.map((mark) => (
                        <span
                          key={mark.label}
                          className={`rounded border border-line bg-white px-1.5 py-0.5 text-[8px] font-bold ${mark.className}`}
                        >
                          {mark.label}
                        </span>
                      ))}
                    </span>
                  )}

                  {option.id === "bank" && option.note && (
                    <span className="mt-1.5 flex items-center gap-1 text-[9px] font-medium text-ink-slate">
                      <Landmark className="h-3 w-3" />
                      {option.note}
                    </span>
                  )}
                </span>

                <input
                  type="radio"
                  name="paymentMethod"
                  checked={selected}
                  onChange={() => onPaymentMethodChange(option.id)}
                  className="mt-1 h-4 w-4 shrink-0 accent-brand"
                />
              </label>
            );
          })}
        </div>

        <div className="mt-3 rounded-xl border border-brand/25 bg-brand-tint/70 p-3">
          <VerificationCard
            bare
            phone={phone}
            code={code}
            onCodeChange={onCodeChange}
            resendAt={resendAt}
            onResend={onResend}
            resending={resending}
            verified={phoneVerified}
            demoCode={demoCode}
          />
        </div>
      </section>

      <OrderSummary
        lines={lines}
        subtotal={subtotal}
        deliveryFee={deliveryFee}
        total={total}
        subtitle="Review your items and final amount"
      />

      {error && (
        <div className="flex items-center gap-2 rounded-xl bg-accent-red/10 px-4 py-3 text-xs font-medium text-accent-red">
          <CircleAlert className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        className="flex items-center justify-center gap-2 rounded-full btn-brand py-3.5 text-sm font-bold text-white shadow-lg shadow-brand/25 disabled:opacity-60"
      >
        {pending ? (
          <LoaderCircle className="h-4 w-4 animate-spin" />
        ) : (
          <>
            <Lock className="h-4 w-4" />
            Pay Now
            <ArrowRight className="h-4 w-4" />
          </>
        )}
      </button>

      <p className="flex items-center justify-center gap-1.5 text-[10px] font-medium text-ink-slate">
        <ShieldCheck className="h-3 w-3 text-brand" />
        100% Secure Payment
        <span className="mx-1 h-3 w-px bg-line" />
        Your data is protected
      </p>
    </div>
  );
}
