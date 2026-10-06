"use client";

import { useActionState, useState } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { applySellerAction, type SellerAuthState } from "@/app/seller/actions";
import { Field, FormMessage, fieldStyles } from "@/components/admin/ui";

interface ApplyFormProps {
  /** How the already-signed-in applicant is identified, or null when the form
   * has to create their account too. */
  signedInAs: string | null;
}

/** As short as a shop can be opened with: name, mobile, password and store
 * name, with email optional.
 *
 * It used to be ten boxes in three sections -- an introduction for the shop and
 * a whole payout account among them -- and on a phone that is where people gave
 * up. Neither is needed to review an application, so both moved to the Seller
 * Center's setup checklist (Settings and Finance), which a new seller sees on
 * their first visit. A shopper who is already signed in types one thing. */
export default function ApplyForm({ signedInAs }: ApplyFormProps) {
  const [state, formAction, pending] = useActionState<SellerAuthState, FormData>(
    applySellerAction,
    {}
  );
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form action={formAction} className="space-y-4">
      <FormMessage error={state.error} />

      {signedInAs ? (
        <p className="rounded-xl bg-neutral-50 px-3.5 py-2.5 text-[13px] text-neutral-600">
          Applying as <span className="font-semibold text-neutral-800">{signedInAs}</span>
        </p>
      ) : (
        <>
          <Field label="Your name" required>
            <input
              type="text"
              name="name"
              defaultValue={state.values?.name}
              required
              autoComplete="name"
              className={fieldStyles}
            />
          </Field>

          <Field label="Mobile number" required hint="You sign in with this number.">
            <input
              type="tel"
              name="phone"
              defaultValue={state.values?.phone}
              required
              inputMode="tel"
              autoComplete="tel"
              placeholder="01XXXXXXXXX"
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
        </>
      )}

      <Field label="Store name" required hint="Shoppers see this on every product you list.">
        <input
          type="text"
          name="storeName"
          defaultValue={state.values?.storeName}
          required
          minLength={3}
          placeholder="Dhaka Fashion House"
          className={fieldStyles}
        />
      </Field>

      {signedInAs ? null : (
        <Field label="Email address (optional)">
          <input
            type="email"
            name="email"
            defaultValue={state.values?.email}
            autoComplete="email"
            placeholder="you@example.com"
            className={fieldStyles}
          />
        </Field>
      )}

      <div className="pt-2">
        <button
          type="submit"
          disabled={pending}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand text-sm font-semibold text-white shadow-lg shadow-brand/25 transition hover:bg-brand-dark disabled:opacity-70"
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {pending ? "Opening your shop…" : "Open my shop"}
        </button>
        <p className="mt-3 text-center text-[11px] leading-relaxed text-neutral-400">
          Free to open. Zupona checks every new shop before it goes live; you add your
          payment account and products from your Seller Center.
        </p>
      </div>
    </form>
  );
}
