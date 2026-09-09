"use client";

import { useActionState, useState } from "react";
import { Loader2, Ticket } from "lucide-react";
import { Card, CardHeader, Field, FormMessage, buttonStyles, fieldStyles, textareaStyles } from "./ui";
import { createCouponAction, type CouponFormState } from "@/app/admin/(panel)/coupons/actions";

/** The "new coupon" panel.
 *
 * The value field changes meaning with the type — a percentage, an amount, or
 * nothing at all for free shipping — so it relabels itself rather than leaving
 * an ambiguous "Value" box that quietly means something different depending on
 * a dropdown three fields up. */
export default function CouponForm() {
  const [state, formAction, pending] = useActionState<CouponFormState, FormData>(
    createCouponAction,
    {}
  );
  const [type, setType] = useState<"percent" | "fixed" | "free_shipping">("percent");

  return (
    <Card>
      <CardHeader title="Create Coupon" subtitle="Discount codes shoppers enter at checkout" />

      <form action={formAction} className="space-y-4">
        <FormMessage error={state.error} success={state.success} />

        <Field label="Code" required hint="Shoppers type this — keep it short and memorable">
          <input
            name="code"
            required
            maxLength={24}
            placeholder="SUMMER25"
            className={`${fieldStyles} font-semibold uppercase tracking-wide`}
          />
        </Field>

        <Field label="Description" hint="Shown in the offers wallet">
          <textarea
            name="description"
            rows={2}
            maxLength={140}
            placeholder="25% off your first order"
            className={textareaStyles}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Discount type" required>
            <select
              name="discountType"
              value={type}
              onChange={(event) => setType(event.target.value as typeof type)}
              className={fieldStyles}
            >
              <option value="percent">Percentage</option>
              <option value="fixed">Fixed amount</option>
              <option value="free_shipping">Free shipping</option>
            </select>
          </Field>

          <Field
            label={type === "percent" ? "Percent off" : type === "fixed" ? "Taka off" : "Value"}
            required={type !== "free_shipping"}
          >
            <input
              name="discountValue"
              type="number"
              min={type === "percent" ? 1 : 0}
              max={type === "percent" ? 100 : undefined}
              disabled={type === "free_shipping"}
              placeholder={type === "percent" ? "25" : "200"}
              className={`${fieldStyles} disabled:bg-neutral-50 disabled:text-neutral-400`}
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Minimum spend" hint="0 for no minimum">
            <input
              name="minOrderAmount"
              type="number"
              min={0}
              defaultValue={0}
              className={fieldStyles}
            />
          </Field>
          <Field label="Maximum discount" hint="Caps a percentage code">
            <input
              name="maxDiscountAmount"
              type="number"
              min={0}
              disabled={type !== "percent"}
              placeholder="No cap"
              className={`${fieldStyles} disabled:bg-neutral-50 disabled:text-neutral-400`}
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Total uses" hint="Blank for unlimited">
            <input name="usageLimit" type="number" min={0} placeholder="Unlimited" className={fieldStyles} />
          </Field>
          <Field label="Uses per customer">
            <input
              name="perUserLimit"
              type="number"
              min={1}
              defaultValue={1}
              className={fieldStyles}
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Starts" hint="Blank starts immediately">
            <input name="startsAt" type="datetime-local" className={fieldStyles} />
          </Field>
          <Field label="Ends" hint="Blank never expires">
            <input name="endsAt" type="datetime-local" className={fieldStyles} />
          </Field>
        </div>

        <button type="submit" disabled={pending} className={`${buttonStyles.primary} w-full`}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ticket className="h-4 w-4" />}
          {pending ? "Creating…" : "Create Coupon"}
        </button>
      </form>
    </Card>
  );
}
