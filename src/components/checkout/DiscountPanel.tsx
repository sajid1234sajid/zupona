"use client";

import { useState } from "react";
import { LoaderCircle, Star, Ticket, X } from "lucide-react";
import type { CheckoutQuote } from "@/app/checkout/actions";
import { formatPrice } from "@/lib/format";

/** Coupon and points, on the payment step.
 *
 * The coupon field applies a code by asking the server for a new quote; a
 * refused code is shown with the server's own reason ("Add ৳350 more to use
 * this coupon"). Points are a switch: "Use 400 pts (−৳100)", greyed with the
 * reason when they cannot be used. A guest sees only the coupon. */
export default function DiscountPanel({
  quote,
  couponCode,
  usePoints,
  busy,
  onApplyCoupon,
  onRemoveCoupon,
  onTogglePoints,
}: {
  quote: CheckoutQuote | null;
  couponCode: string;
  usePoints: boolean;
  busy: boolean;
  onApplyCoupon: (code: string) => void;
  onRemoveCoupon: () => void;
  onTogglePoints: (on: boolean) => void;
}) {
  const [draft, setDraft] = useState(couponCode);
  const applied = quote?.couponCode && !quote.couponError ? quote.couponCode : null;
  const points = quote?.points ?? null;

  return (
    <section className="rounded-2xl border border-line bg-white p-4 shadow-card">
      <h2 className="flex items-center gap-2 text-[15px] font-bold text-ink-strong">
        <Ticket className="h-4 w-4 text-brand" /> Discounts
      </h2>

      {applied ? (
        <div className="mt-3 flex items-center justify-between gap-2 rounded-xl bg-brand-tint px-3 py-2.5">
          <span className="text-[13px] font-semibold text-brand-dark">
            {applied} applied ·{" "}
            {quote?.freeShippingCoupon ? "Free delivery" : `−${formatPrice(quote?.couponDiscount ?? 0)}`}
          </span>
          <button
            type="button"
            onClick={() => {
              setDraft("");
              onRemoveCoupon();
            }}
            aria-label="Remove coupon"
            className="grid h-7 w-7 place-items-center rounded-full text-brand-dark hover:bg-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div className="mt-3">
          <div className="flex gap-2">
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value.toUpperCase())}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  if (draft.trim()) onApplyCoupon(draft.trim());
                }
              }}
              placeholder="Have a coupon code?"
              aria-label="Coupon code"
              autoCapitalize="characters"
              className="h-11 min-w-0 flex-1 rounded-xl border border-line px-3 text-[13px] font-semibold uppercase tracking-wide outline-none placeholder:font-normal placeholder:normal-case placeholder:tracking-normal focus:border-brand"
            />
            <button
              type="button"
              disabled={!draft.trim() || busy}
              onClick={() => onApplyCoupon(draft.trim())}
              className="h-11 shrink-0 rounded-xl bg-brand px-4 text-[13px] font-bold text-white disabled:opacity-50"
            >
              {busy && couponCode ? <LoaderCircle className="h-4 w-4 animate-spin" /> : "Apply"}
            </button>
          </div>
          {quote?.wallet && quote.wallet.length > 0 ? (
            <div className="mt-2">
              <p className="text-[11.5px] font-semibold text-ink-muted">Your coupons ({quote.wallet.length})</p>
              <div className="no-scrollbar mt-1 flex gap-2 overflow-x-auto">
                {quote.wallet.map((coupon) => (
                  <button
                    key={coupon.code}
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setDraft(coupon.code);
                      onApplyCoupon(coupon.code);
                    }}
                    className="shrink-0 rounded-lg border border-urgency/30 bg-badge-bg px-2.5 py-1.5 text-left"
                  >
                    <span className="block text-[12px] font-bold text-urgency">{coupon.title}</span>
                    <span className="block text-[10.5px] text-ink-muted">{coupon.condition}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          {couponCode && quote?.couponError ? (
            <p role="alert" className="mt-1.5 text-[12px] font-semibold text-accent-red">
              {quote.couponError}
            </p>
          ) : null}
        </div>
      )}

      {points ? (
        <label
          className={`mt-3 flex items-center gap-3 rounded-xl border px-3 py-2.5 ${
            points.blocked ? "border-line bg-surface opacity-70" : "cursor-pointer border-line"
          }`}
        >
          <Star className="h-5 w-5 shrink-0 fill-rating text-rating" />
          <span className="min-w-0 flex-1">
            <span className="block text-[13px] font-semibold text-ink-strong">
              {points.blocked
                ? `You have ${points.balance.toLocaleString("en-US")} points`
                : `Use ${points.usable.toLocaleString("en-US")} points (−${formatPrice(points.usableDiscount)})`}
            </span>
            <span className="block text-[11.5px] text-ink-slate">
              {points.blocked ?? `Balance ${points.balance.toLocaleString("en-US")} points`}
            </span>
          </span>
          <input
            type="checkbox"
            role="switch"
            checked={usePoints && !points.blocked}
            disabled={Boolean(points.blocked) || busy}
            onChange={(event) => onTogglePoints(event.target.checked)}
            className="h-5 w-5 accent-[var(--color-brand)]"
          />
        </label>
      ) : null}
    </section>
  );
}
