"use client";

import { useState } from "react";
import { Check, Copy, Ticket } from "lucide-react";
import type { OfferCoupon } from "@/types";
import { formatPrice } from "@/lib/format";

function couponValue(coupon: OfferCoupon): string {
  switch (coupon.discountType) {
    case "percent":
      return `${coupon.discountValue}%`;
    case "free_shipping":
      return "FREE";
    case "fixed":
    default:
      return formatPrice(coupon.discountValue);
  }
}

/** The coupon wallet.
 *
 * "Collect" copies the code to the clipboard and nothing more — the discount
 * is applied by `validateCoupon()` when the code is entered in the cart, and
 * pretending otherwise here would show a saving the checkout might refuse.
 * The card states the minimum spend for the same reason.
 *
 * `navigator.clipboard` is unavailable on insecure origins and can be denied,
 * so the code is always visible as text and selectable; copying is the
 * convenience, not the only way to get it.
 */
export default function CouponWallet({ coupons }: { coupons: OfferCoupon[] }) {
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [failedCode, setFailedCode] = useState<string | null>(null);

  async function copy(code: string) {
    setFailedCode(null);
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode((current) => (current === code ? null : current)), 2000);
    } catch {
      setFailedCode(code);
    }
  }

  return (
    // Wraps on a laptop, where a sideways row with no scrollbar cannot be
    // scrolled with a mouse.
    <div className="flex gap-2 overflow-x-auto px-4 pb-1 no-scrollbar tab:flex-wrap tab:gap-3 tab:overflow-visible">
      {coupons.map((coupon) => {
        const copied = copiedCode === coupon.code;
        const failed = failedCode === coupon.code;

        return (
          <div
            key={coupon.code}
            className="flex w-[210px] shrink-0 overflow-hidden rounded-xl bg-white shadow-card tab:w-[270px]"
          >
            <div className="flex w-[62px] shrink-0 flex-col items-center justify-center bg-brand-tint px-1 py-2 text-center">
              <Ticket className="h-3.5 w-3.5 text-brand" />
              <span className="mt-0.5 text-[13px] font-extrabold leading-none text-brand-dark">
                {couponValue(coupon)}
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-wide text-ink-slate">
                {coupon.discountType === "free_shipping" ? "delivery" : "off"}
              </span>
            </div>

            {/* Perforation between the value stub and the detail half. */}
            <div className="w-px border-l border-dashed border-line" />

            <div className="min-w-0 flex-1 px-2 py-2">
              <p className="truncate text-[11px] font-bold text-heading">{coupon.title}</p>
              <p className="mt-0.5 line-clamp-2 text-[9px] leading-tight text-ink-slate">
                {coupon.description}
              </p>
              <p className="mt-0.5 text-[10px] text-ink-slate">
                Min spend {formatPrice(coupon.minOrderAmount)} · {coupon.validity}
              </p>

              <button
                onClick={() => copy(coupon.code)}
                className={`mt-1.5 flex w-full items-center justify-center gap-1 rounded-md py-1 text-[10px] font-bold transition-colors ${
                  copied ? "bg-brand-tint text-brand-dark" : "bg-brand text-white"
                }`}
              >
                {copied ? (
                  <>
                    <Check className="h-3 w-3" />
                    Copied {coupon.code}
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3" />
                    {coupon.code}
                  </>
                )}
              </button>
              {failed && (
                <p className="mt-0.5 text-center text-[10px] text-ink-slate">
                  Copy blocked — type the code above at checkout.
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
