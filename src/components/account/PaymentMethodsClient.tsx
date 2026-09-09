"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CreditCard, Trash2, Plus, LoaderCircle, Smartphone, Banknote } from "lucide-react";
import type { PaymentMethod } from "@/types";
import { deletePaymentMethodAction, setDefaultPaymentMethodAction } from "@/app/account/payment-methods/actions";
import PaymentMethodForm from "./PaymentMethodForm";

const ICONS = {
  card: CreditCard,
  bkash: Smartphone,
  nagad: Smartphone,
  cod: Banknote,
};

export default function PaymentMethodsClient({ methods }: { methods: PaymentMethod[] }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  if (adding) {
    return <PaymentMethodForm onDone={() => setAdding(false)} />;
  }

  function remove(id: string) {
    setPendingId(id);
    startTransition(async () => {
      await deletePaymentMethodAction(id);
      router.refresh();
      setPendingId(null);
    });
  }

  function setDefault(id: string) {
    setPendingId(id);
    startTransition(async () => {
      await setDefaultPaymentMethodAction(id);
      router.refresh();
      setPendingId(null);
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {methods.length === 0 && (
        <div className="flex flex-col items-center gap-2 rounded-2xl bg-white py-10 text-center shadow-sm">
          <CreditCard className="h-6 w-6 text-neutral-300" />
          <p className="text-sm font-semibold text-neutral-600">No payment methods yet</p>
          <p className="max-w-[220px] text-xs text-neutral-400">
            Save a card, mobile wallet, or choose cash on delivery.
          </p>
        </div>
      )}

      {methods.map((method) => {
        const Icon = ICONS[method.type];
        return (
          <div key={method.id} className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-tint text-brand">
              <Icon className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate text-sm font-semibold text-neutral-800">{method.label}</p>
                {method.isDefault && (
                  <span className="shrink-0 rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-semibold text-brand">
                    Default
                  </span>
                )}
              </div>
              {method.detail && <p className="truncate text-xs text-neutral-400">{method.detail}</p>}
              {!method.isDefault && (
                <button
                  onClick={() => setDefault(method.id)}
                  disabled={pendingId === method.id}
                  className="mt-1 text-xs font-semibold text-brand"
                >
                  Set as default
                </button>
              )}
            </div>
            <button
              aria-label="Remove payment method"
              disabled={pendingId === method.id}
              onClick={() => remove(method.id)}
              className="shrink-0 text-accent-red"
            >
              {pendingId === method.id ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
            </button>
          </div>
        );
      })}

      <button
        onClick={() => setAdding(true)}
        className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-brand/40 py-3.5 text-sm font-semibold text-brand"
      >
        <Plus className="h-4 w-4" />
        Add Payment Method
      </button>
    </div>
  );
}
