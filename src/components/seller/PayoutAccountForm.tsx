"use client";

import { useActionState, useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { updatePayoutAccountAction, type StoreFormState } from "@/app/seller/actions";
import { Field, FormMessage, buttonStyles, fieldStyles } from "@/components/admin/ui";

interface PayoutAccountFormProps {
  method: string | null;
  accountName: string;
  accountNumber: string;
  bankName: string;
  branch: string;
  /** An admin working on the store has no password for it. */
  asAdmin: boolean;
}

const METHODS = [
  { value: "bkash", label: "bKash" },
  { value: "nagad", label: "Nagad" },
  { value: "bank", label: "Bank account" },
];

export default function PayoutAccountForm(props: PayoutAccountFormProps) {
  const [state, formAction, pending] = useActionState<StoreFormState, FormData>(
    updatePayoutAccountAction,
    {}
  );
  const [method, setMethod] = useState(props.method ?? "bkash");
  const wallet = method !== "bank";

  return (
    <form action={formAction} className="space-y-4">
      <FormMessage error={state.error} success={state.success} />

      <div className="grid grid-cols-3 gap-2">
        {METHODS.map((option) => (
          <label
            key={option.value}
            className="flex cursor-pointer items-center justify-center rounded-xl border border-neutral-200 px-2 py-2.5 text-[13px] font-semibold text-neutral-600 transition has-[:checked]:border-brand has-[:checked]:bg-brand-tint/40 has-[:checked]:text-brand-dark"
          >
            <input
              type="radio"
              name="payoutMethod"
              value={option.value}
              checked={method === option.value}
              onChange={() => setMethod(option.value)}
              className="sr-only"
            />
            {option.label}
          </label>
        ))}
      </div>

      <Field label="Account holder's name" required>
        <input name="accountName" required defaultValue={props.accountName} className={fieldStyles} />
      </Field>

      <Field
        label={wallet ? `${method === "nagad" ? "Nagad" : "bKash"} number` : "Account number"}
        required
        hint={wallet ? "The personal or merchant number earnings are sent to" : undefined}
      >
        <input
          name="accountNumber"
          required
          inputMode={wallet ? "tel" : "text"}
          defaultValue={props.accountNumber}
          placeholder={wallet ? "01XXXXXXXXX" : ""}
          className={fieldStyles}
        />
      </Field>

      {!wallet ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Bank" required>
            <input name="bankName" required defaultValue={props.bankName} className={fieldStyles} />
          </Field>
          <Field label="Branch">
            <input name="branch" defaultValue={props.branch} className={fieldStyles} />
          </Field>
        </div>
      ) : null}

      {props.asAdmin ? (
        <p className="rounded-xl bg-amber-50 px-3.5 py-2.5 text-[12px] text-amber-800">
          You are changing this store&rsquo;s payout account as a Zupona admin. It is recorded in
          the audit log under your name.
        </p>
      ) : (
        <Field label="Your password" required hint="Asked every time, because this decides where your money goes.">
          <input
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className={fieldStyles}
          />
        </Field>
      )}

      <button type="submit" disabled={pending} className={buttonStyles.primary}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
        Save payout account
      </button>
    </form>
  );
}
