"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ChevronRight, LoaderCircle, Ticket } from "lucide-react";
import type { WalletCoupon } from "@/lib/couponWallet";
import { collectCouponAction } from "@/app/account/coupons/actions";

/** One coupon as a ticket: what it is worth, its condition, when it ends,
 * and Collect -- or, once collected, "Use now". In the wallet it shows its
 * state instead. */
export default function CouponCard({
  coupon,
  mode = "offer",
}: {
  coupon: WalletCoupon;
  mode?: "offer" | "wallet";
}) {
  const router = useRouter();
  const [collected, setCollected] = useState(coupon.collected);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const daysLeft = coupon.daysLeft;
  const dim = mode === "wallet" && coupon.state !== "unused";

  return (
    <div className={`flex min-w-0 overflow-hidden rounded-xl border border-urgency/20 bg-badge-bg ${dim ? "opacity-60" : ""}`}>
      <div className="flex w-[92px] shrink-0 flex-col items-center justify-center border-r border-dashed border-urgency/30 px-2 py-3 text-center">
        <Ticket className="h-4 w-4 text-urgency" />
        <span className="mt-1 text-[15px] font-extrabold leading-tight text-urgency">{coupon.title}</span>
      </div>
      <div className="flex min-w-0 flex-1 flex-col justify-between gap-1.5 p-3">
        <div className="min-w-0">
          <p className="truncate text-[12.5px] font-semibold text-heading">{coupon.condition}</p>
          <p className="mt-0.5 flex flex-wrap gap-x-2 text-[11px] text-ink-muted">
            <span className="font-mono font-bold text-ink">{coupon.code}</span>
            {coupon.audience === "new_customer" ? <span>New customers only</span> : null}
            {daysLeft !== null && daysLeft >= 0 && coupon.state === "unused" ? (
              <span className={daysLeft <= 2 ? "font-semibold text-urgency" : ""}>
                {daysLeft === 0 ? "Ends today" : `Ends in ${daysLeft}d`}
              </span>
            ) : null}
          </p>
        </div>
        {mode === "wallet" ? (
          coupon.state === "unused" ? (
            <Link href={coupon.useHref} className="inline-flex items-center gap-0.5 text-[12px] font-bold text-brand">
              Use now <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          ) : (
            <span className="text-[11.5px] font-semibold text-ink-muted">
              {coupon.state === "used" ? "Used" : "Expired"}
            </span>
          )
        ) : collected ? (
          <Link href={coupon.useHref} className="inline-flex items-center gap-1 text-[12px] font-bold text-brand">
            <Check className="h-3.5 w-3.5" /> Collected · Use now <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        ) : (
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await collectCouponAction(coupon.id);
                if (result.signIn) {
                  router.push("/account/login");
                  return;
                }
                if (!result.ok) setError(result.error ?? "Could not collect.");
                else setCollected(true);
              })
            }
            className="inline-flex h-8 w-fit items-center gap-1.5 rounded-full bg-urgency px-4 text-[12px] font-bold text-white disabled:opacity-60"
          >
            {pending ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : null}
            Collect
          </button>
        )}
        {error ? <p className="text-[11px] font-semibold text-accent-red">{error}</p> : null}
      </div>
    </div>
  );
}
