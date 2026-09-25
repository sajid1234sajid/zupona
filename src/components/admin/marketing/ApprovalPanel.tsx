"use client";

/** The one screen where money becomes possible.
 *
 * The budget is sent back with the decision and checked against what the
 * campaign actually holds, so an approval can only ever apply to the plan the
 * operator was looking at. If the plan changed underneath them, the action
 * refuses and says so rather than treating their "yes" as covering the new
 * figure.
 *
 * Approving does not publish. It records a decision; publishing is a separate,
 * deliberate step. The copy says so, because a button that quietly did both
 * would make the distinction meaningless. */

import { useActionState } from "react";
import { CircleCheck, CircleX, Loader, ShieldCheck } from "lucide-react";
import {
  decideCampaignAction,
  type ApprovalState,
} from "@/app/admin/(panel)/marketing/ai/actions";
import { formatPrice } from "@/lib/format";
import { buttonStyles, fieldStyles } from "@/components/admin/ui";

export default function ApprovalPanel({
  campaignId,
  budgetTotal,
  creativeCount,
  days,
  isDemo,
}: {
  campaignId: string;
  budgetTotal: number;
  creativeCount: number;
  days: number | null;
  isDemo: boolean;
}) {
  const [state, formAction, pending] = useActionState<ApprovalState, FormData>(
    decideCampaignAction,
    {}
  );

  if (state.success) {
    return (
      <p className="flex items-start gap-2.5 rounded-xl border border-brand/40 bg-brand-tint/50 px-3.5 py-3 text-[13px] text-neutral-700">
        <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
        {state.success}
      </p>
    );
  }

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="campaignId" value={campaignId} />
      <input type="hidden" name="shownBudget" value={budgetTotal} />

      <div className="rounded-xl border border-neutral-100 bg-neutral-50/60 p-3.5">
        <p className="flex items-center gap-2 text-[13px] font-semibold text-neutral-800">
          <ShieldCheck className="h-4 w-4 text-brand" />
          Campaign ready
        </p>
        <dl className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[12.5px]">
          <dt className="text-neutral-400">Budget</dt>
          <dd className="text-right font-semibold text-neutral-800">
            {formatPrice(budgetTotal)}
          </dd>
          <dt className="text-neutral-400">Duration</dt>
          <dd className="text-right text-neutral-700">{days ? `${days} days` : "—"}</dd>
          <dt className="text-neutral-400">Creatives</dt>
          <dd className="text-right text-neutral-700">{creativeCount}</dd>
        </dl>
        <p className="mt-2.5 border-t border-neutral-200 pt-2.5 text-[11px] text-neutral-500">
          {isDemo
            ? "This is a demo campaign. Approving it records your decision and spends nothing, because there is nothing behind it to spend."
            : "Approving records your decision. Publishing to Meta is a separate step, so nothing is spent by this button."}
        </p>
      </div>

      <label className="block">
        <span className="mb-1 block text-[11px] font-medium text-neutral-500">
          Note (optional)
        </span>
        <input
          name="note"
          maxLength={400}
          placeholder="Why you approved or rejected this"
          className={fieldStyles}
        />
      </label>

      {state.error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-700">
          {state.error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          name="decision"
          value="approved"
          disabled={pending}
          className={buttonStyles.primary}
        >
          {pending ? <Loader className="h-4 w-4 animate-spin" /> : <CircleCheck className="h-4 w-4" />}
          Approve
        </button>
        <button
          type="submit"
          name="decision"
          value="rejected"
          disabled={pending}
          className={buttonStyles.secondary}
        >
          <CircleX className="h-4 w-4" />
          Reject
        </button>
      </div>
    </form>
  );
}
