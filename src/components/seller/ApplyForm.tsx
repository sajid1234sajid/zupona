"use client";

import { useActionState, useState } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { applySellerAction, type SellerAuthState } from "@/app/seller/actions";
import { Field, FormMessage, fieldStyles, textareaStyles } from "@/components/admin/ui";

interface ApplyFormProps {
  /** How the already-signed-in applicant is identified, or null when the form
   * has to create their account too. */
  signedInAs: string | null;
}

/** Where the money goes. `bank` asks for a different kind of number from the
 * two mobile wallets, so the hint follows the choice rather than trying to
 * describe all three at once. */
const PAYOUT_METHODS = [
  { value: "bkash", label: "bKash", hint: "The bKash number your earnings should be sent to." },
  { value: "nagad", label: "Nagad", hint: "The Nagad number your earnings should be sent to." },
  { value: "bank", label: "Bank account", hint: "Your account number at the bank." },
] as const;

export default function ApplyForm({ signedInAs }: ApplyFormProps) {
  const [state, formAction, pending] = useActionState<SellerAuthState, FormData>(
    applySellerAction,
    {}
  );
  const [payoutMethod, setPayoutMethod] = useState<string>("bkash");
  const [showPassword, setShowPassword] = useState(false);

  const method = PAYOUT_METHODS.find((entry) => entry.value === payoutMethod);

  return (
    <form action={formAction} className="space-y-6">
      <FormMessage error={state.error} />

      {signedInAs ? (
        <p className="rounded-xl bg-neutral-50 px-3.5 py-2.5 text-[13px] text-neutral-600">
          Applying as <span className="font-semibold text-neutral-800">{signedInAs}</span>
        </p>
      ) : (
        <section>
          <h2 className="text-[15px] font-bold text-neutral-800">Your account</h2>
          <p className="mb-4 mt-0.5 text-xs text-neutral-400">
            This is how you will sign in to manage your shop.
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Your name" required>
              <input type="text" name="name" required className={fieldStyles} />
            </Field>

            <Field label="Mobile number" required hint="We use this to reach you about orders.">
              <input
                type="tel"
                name="phone"
                required
                inputMode="tel"
                placeholder="01XXXXXXXXX"
                className={fieldStyles}
              />
            </Field>

            <Field label="Email address" required>
              <input
                type="email"
                name="email"
                required
                autoComplete="email"
                className={fieldStyles}
              />
            </Field>

            <Field label="Password" required hint="At least 8 characters.">
              <span className="relative block">
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  className={`${fieldStyles} pr-11`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-600"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </span>
            </Field>
          </div>
        </section>
      )}

      <section>
        <h2 className="text-[15px] font-bold text-neutral-800">Your store</h2>
        <p className="mb-4 mt-0.5 text-xs text-neutral-400">
          Shoppers see this name on every product you list.
        </p>

        <div className="space-y-4">
          <Field label="Store name" required hint="Your store's web address is made from this.">
            <input
              type="text"
              name="storeName"
              required
              minLength={3}
              placeholder="Dhaka Fashion House"
              className={fieldStyles}
            />
          </Field>

          <Field label="What do you sell?" hint="A short introduction for your shop page.">
            <textarea name="description" rows={4} className={textareaStyles} />
          </Field>
        </div>
      </section>

      <section>
        <h2 className="text-[15px] font-bold text-neutral-800">Getting paid</h2>
        <p className="mb-4 mt-0.5 text-xs text-neutral-400">
          Zupona holds the money from your sales and pays it to this account.
        </p>

        <div className="space-y-4">
          <Field label="Payment method" required>
            <div className="grid gap-2 sm:grid-cols-3">
              {PAYOUT_METHODS.map((entry) => (
                <label
                  key={entry.value}
                  className={`flex cursor-pointer items-center justify-center rounded-xl border px-3 py-2.5 text-sm font-medium transition ${
                    payoutMethod === entry.value
                      ? "border-brand bg-brand/5 text-brand"
                      : "border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300"
                  }`}
                >
                  <input
                    type="radio"
                    name="payoutMethod"
                    value={entry.value}
                    checked={payoutMethod === entry.value}
                    onChange={() => setPayoutMethod(entry.value)}
                    className="sr-only"
                  />
                  {entry.label}
                </label>
              ))}
            </div>
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Account holder's name" required>
              <input type="text" name="accountName" required className={fieldStyles} />
            </Field>

            <Field
              label={payoutMethod === "bank" ? "Account number" : "Mobile number"}
              required
              hint={method?.hint}
            >
              <input
                type="text"
                name="accountNumber"
                required
                inputMode={payoutMethod === "bank" ? "text" : "tel"}
                className={fieldStyles}
              />
            </Field>
          </div>
        </div>
      </section>

      <div className="border-t border-neutral-100 pt-5">
        <button
          type="submit"
          disabled={pending}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand text-sm font-semibold text-white shadow-lg shadow-brand/25 transition hover:bg-brand-dark disabled:opacity-70"
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {pending ? "Sending your application…" : "Send application"}
        </button>
        <p className="mt-3 text-center text-[11px] text-neutral-400">
          Zupona reviews every application. You will be told once yours has been decided.
        </p>
      </div>
    </form>
  );
}
