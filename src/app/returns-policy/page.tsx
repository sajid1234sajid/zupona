import type { Metadata } from "next";
import { RotateCcw, RefreshCw, Wallet, MessageCircle } from "lucide-react";
import ProductHeader from "@/components/layout/ProductHeader";
import DesktopHeader from "@/components/layout/DesktopHeader";
import BottomNav from "@/components/layout/BottomNav";
import { getShopSettings } from "@/lib/shopSettings";

export const metadata: Metadata = {
  title: "Return & Refund Policy — Zupona",
  description:
    "How returns, exchanges and refunds work on Zupona: what's eligible, the time window, and how to start one.",
};

/** The one page every product links to instead of each repeating its own
 * summary. Return and exchange windows come from the same shop settings the
 * product page already reads (`site_settings.return_days` /
 * `exchange_days`), so this never states a window the admin has not actually
 * configured -- a shop that has not set one yet gets a case-by-case promise
 * instead of an invented number of days. */
export default async function ReturnsPolicyPage() {
  const settings = await getShopSettings();

  const contactLine =
    settings.supportEmail && settings.supportPhone
      ? `${settings.supportEmail} or ${settings.supportPhone}`
      : settings.supportEmail || settings.supportPhone || "support@zupona.shop";

  const sections = [
    {
      icon: RotateCcw,
      title: "Returns",
      body:
        settings.returnDays > 0
          ? `You can request a return within ${settings.returnDays} day${settings.returnDays === 1 ? "" : "s"} of delivery, on items that are unused, in their original packaging, and not marked non-returnable on the product page.`
          : "If an item arrives damaged, wrong, or not as described, contact us as soon as you notice it and we'll make it right.",
    },
    {
      icon: RefreshCw,
      title: "Exchanges",
      body:
        settings.exchangeDays > 0
          ? `Exchanges for a different size or variant are accepted within ${settings.exchangeDays} day${settings.exchangeDays === 1 ? "" : "s"} of delivery, subject to stock.`
          : "Ask us about swapping for a different size or variant -- approval depends on stock and the condition of the item.",
    },
    {
      icon: Wallet,
      title: "Refunds",
      body:
        "Once a returned item reaches us and passes a quick check, the refund goes to your original payment method, or as store credit for a Cash on Delivery order, within a few business days.",
    },
    {
      icon: MessageCircle,
      title: "How to start one",
      body: `Contact us with your order number at ${contactLine} and we'll walk you through the next step.`,
    },
  ];

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-white pb-[68px] tab:max-w-none tab:pb-12">
      <div className="tab:hidden">
        <ProductHeader />
      </div>
      <DesktopHeader />
      <main className="flex-1 px-4 pt-4 tab:mx-auto tab:w-full tab:max-w-shell tab:px-6 tab:pt-6">
        <h1 className="text-lg font-bold text-heading tab:text-2xl">Return &amp; Refund Policy</h1>
        <p className="mt-1 max-w-prose text-xs text-ink-slate tab:text-sm">
          The short version of what happens if something isn&apos;t right with an order.
        </p>

        <div className="mt-5 max-w-prose space-y-5">
          {sections.map(({ icon: Icon, title, body }) => (
            <div key={title} className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-tint text-brand">
                <Icon className="h-[18px] w-[18px]" strokeWidth={2.25} />
              </span>
              <div>
                <h2 className="text-sm font-bold text-heading">{title}</h2>
                <p className="mt-0.5 text-[13px] leading-relaxed text-ink-slate">{body}</p>
              </div>
            </div>
          ))}
        </div>

        <p className="mt-6 max-w-prose text-[11px] text-ink-faint">
          Items marked non-returnable on their product page, and items that come back used or
          without their original packaging, are not eligible for return or exchange.
        </p>
      </main>
      <BottomNav />
    </div>
  );
}
