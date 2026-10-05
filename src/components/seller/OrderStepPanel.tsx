"use client";

import { useActionState, useState } from "react";
import { CheckCircle2, Loader2, PackageCheck, Truck, XCircle } from "lucide-react";
import {
  sellerOrderStepAction,
  type OrderStepState,
} from "@/app/seller/(panel)/orders/actions";
import { Field, FormMessage, buttonStyles, fieldStyles } from "@/components/admin/ui";

/** Couriers sellers in Bangladesh actually use, offered as suggestions -- the
 * box still takes anything, including "Own delivery". */
const COURIERS = [
  "Steadfast",
  "Pathao",
  "RedX",
  "Paperfly",
  "eCourier",
  "Sundarban",
  "SA Paribahan",
  "Own delivery",
];

const STEP_COPY: Record<string, { label: string; detail: string }> = {
  confirmed: { label: "Confirm order", detail: "You have the goods and will pack them" },
  shipped: { label: "Mark shipped", detail: "Handed to the courier" },
  out_for_delivery: { label: "Out for delivery", detail: "With the rider today" },
  delivered: { label: "Mark delivered", detail: "The customer has it" },
};

interface OrderStepPanelProps {
  suborderId: string;
  steps: string[];
  courier: string | null;
  tracking: string | null;
  soleSeller: boolean;
}

/** The fulfilment controls on an order.
 *
 * Only the next sensible steps are offered, in order, with the very next one
 * as the primary button. Shipping asks for the courier right there, because a
 * parcel marked shipped with no way to follow it is the commonest complaint a
 * marketplace gets. Cancelling hides behind its own toggle and wants a reason,
 * since the customer is told it word for word. */
export default function OrderStepPanel({
  suborderId,
  steps,
  courier,
  tracking,
  soleSeller,
}: OrderStepPanelProps) {
  const [state, formAction, pending] = useActionState<OrderStepState, FormData>(
    sellerOrderStepAction,
    {}
  );
  const [cancelling, setCancelling] = useState(false);

  const forward = steps.filter((step) => step !== "cancelled");
  const canCancel = steps.includes("cancelled");
  const next = forward[0];
  const needsCourier = next === "shipped";
  // Jumping past shipping is only offered once the order has shipped.
  const skips = forward.includes("shipped") ? [] : forward.slice(1);

  return (
    <div className="space-y-4">
      <FormMessage error={state.error} success={state.success} />

      {next ? (
        <form action={formAction} className="space-y-3">
          <input type="hidden" name="suborderId" value={suborderId} />
          <input type="hidden" name="step" value={next} />

          {needsCourier || next === "out_for_delivery" || next === "delivered" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Courier" required={needsCourier}>
                <input
                  name="courier"
                  list="seller-couriers"
                  defaultValue={courier ?? ""}
                  required={needsCourier}
                  placeholder="e.g. Steadfast"
                  className={fieldStyles}
                />
              </Field>
              <Field label="Tracking / consignment no.">
                <input
                  name="tracking"
                  defaultValue={tracking ?? ""}
                  placeholder="Optional"
                  className={fieldStyles}
                />
              </Field>
              <datalist id="seller-couriers">
                {COURIERS.map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>
            </div>
          ) : null}

          <button type="submit" disabled={pending} className={`${buttonStyles.primary} w-full sm:w-auto`}>
            {pending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : next === "confirmed" ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : next === "delivered" ? (
              <PackageCheck className="h-4 w-4" />
            ) : (
              <Truck className="h-4 w-4" />
            )}
            {STEP_COPY[next]?.label ?? next}
          </button>
          <p className="text-[11px] text-neutral-400">{STEP_COPY[next]?.detail}</p>
        </form>
      ) : (
        <p className="rounded-xl bg-neutral-50 px-3.5 py-3 text-[13px] text-neutral-500">
          Nothing left to do on this order.
        </p>
      )}

      {/* Later steps, for a seller who delivers themselves and is catching the
          order up. Shipping is never skipped to: it needs the courier box. */}
      {skips.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1 border-t border-neutral-100 pt-3">
          <span className="mr-1 text-[11px] text-neutral-400">Or jump ahead:</span>
          {skips.map((step) => (
            <form key={step} action={formAction}>
              <input type="hidden" name="suborderId" value={suborderId} />
              <input type="hidden" name="step" value={step} />
              <button type="submit" disabled={pending} className={buttonStyles.ghost}>
                {STEP_COPY[step]?.label ?? step}
              </button>
            </form>
          ))}
        </div>
      ) : null}

      {!next || next !== "shipped" ? (
        <details className="rounded-xl border border-neutral-100 px-3.5 py-2.5">
          <summary className="cursor-pointer text-[13px] font-medium text-neutral-600">
            Courier details
          </summary>
          <form action={formAction} className="mt-3 grid gap-3 sm:grid-cols-2">
            <input type="hidden" name="suborderId" value={suborderId} />
            <input type="hidden" name="step" value="tracking" />
            <input
              name="courier"
              list="seller-couriers-edit"
              defaultValue={courier ?? ""}
              placeholder="Courier"
              aria-label="Courier"
              className={fieldStyles}
            />
            <input
              name="tracking"
              defaultValue={tracking ?? ""}
              placeholder="Tracking number"
              aria-label="Tracking number"
              className={fieldStyles}
            />
            <datalist id="seller-couriers-edit">
              {COURIERS.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
            <button type="submit" disabled={pending} className={`${buttonStyles.secondary} sm:col-span-2`}>
              Save courier details
            </button>
          </form>
        </details>
      ) : null}

      {canCancel ? (
        cancelling ? (
          <form action={formAction} className="space-y-3 rounded-xl border border-red-100 bg-red-50/60 p-3.5">
            <input type="hidden" name="suborderId" value={suborderId} />
            <input type="hidden" name="step" value="cancelled" />
            <Field label="Why are you cancelling?" required hint="The customer is told this.">
              <input
                name="note"
                required
                maxLength={300}
                placeholder="e.g. This size is out of stock"
                className={fieldStyles}
              />
            </Field>
            <div className="flex flex-wrap gap-2">
              <button type="submit" disabled={pending} className={buttonStyles.danger}>
                <XCircle className="h-4 w-4" />
                Cancel this order
              </button>
              <button type="button" onClick={() => setCancelling(false)} className={buttonStyles.ghost}>
                Keep it
              </button>
            </div>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setCancelling(true)}
            className="text-[12px] font-medium text-neutral-400 underline-offset-2 transition hover:text-red-600 hover:underline"
          >
            Can&rsquo;t fulfil this order?
          </button>
        )
      ) : !soleSeller && steps.length > 0 ? (
        <p className="text-[11px] leading-relaxed text-neutral-400">
          This order also has items from other sellers. To cancel your part, contact Zupona
          support.
        </p>
      ) : null}
    </div>
  );
}
