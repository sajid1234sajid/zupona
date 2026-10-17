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
export default function CouponForm({
  categories = [],
}: {
  /** Departments and their types, for a coupon that covers one of them. */
  categories?: { id: string; name: string }[];
}) {
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

        <Field
          label="How many codes"
          hint="1 creates the code above. More creates that many single-use codes starting with it (e.g. FBAD-7K2Q9M) for influencers or ads — download them as a spreadsheet from the list."
        >
          <input name="batchCount" type="number" min={1} max={500} defaultValue={1} className={fieldStyles} />
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

        <div className="grid grid-cols-2 gap-3">
          <Field label="Applies to" hint="Only items in this category count">
            <select name="scopeId" defaultValue="" className={fieldStyles}>
              <option value="">Everything</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Who can use it">
            <select name="audience" defaultValue="all" className={fieldStyles}>
              <option value="all">Everyone</option>
              <option value="new_customer">New customers (first order)</option>
            </select>
          </Field>
        </div>

        <label className="flex items-center gap-2 text-sm text-neutral-700">
          <input type="checkbox" name="isPublic" defaultChecked className="h-4 w-4 accent-[var(--color-brand)]" />
          Show on the Offers page for shoppers to collect
          <span className="text-xs text-neutral-400">(off: only works for whoever has the code)</span>
        </label>

        <button type="submit" disabled={pending} className={`${buttonStyles.primary} w-full`}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ticket className="h-4 w-4" />}
          {pending ? "Creating…" : "Create Coupon"}
        </button>
      </form>
    </Card>
  );
}
