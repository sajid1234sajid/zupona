import type { Metadata } from "next";
import { RotateCcw, RefreshCw, Wallet, MessageCircle } from "lucide-react";
import Link from "next/link";
import InfoPage from "@/components/info/InfoPage";
import { getShopSettings } from "@/lib/shopSettings";
import { getSupportContact, formatWhatsapp } from "@/lib/contact";

export const metadata: Metadata = {
  title: "Return & Refund Policy — Zupona",
  description:
    "How returns, exchanges and refunds work on Zupona: what's eligible, the time window, and how to start one.",
  alternates: { canonical: "/returns-policy" },
};

/** The one page every product links to instead of each repeating its own
 * summary. Return and exchange windows come from the same shop settings the
 * product page already reads (`site_settings.return_days` /
 * `exchange_days`), so this never states a window the admin has not actually
 * configured -- a shop that has not set one yet gets a case-by-case promise
 * instead of an invented number of days. */
export default async function ReturnsPolicyPage() {
  const [settings, contact] = await Promise.all([getShopSettings(), getSupportContact()]);

  // WhatsApp always; phone and email only once Settings holds them. The old
  // fallback was an address at zupona.shop, a domain that does not exist.
  const contactLine = [
    `WhatsApp ${formatWhatsapp(contact.whatsapp)}`,
    contact.phone,
    contact.email,
  ]
    .filter(Boolean)
    .join(", ");

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
    <InfoPage
      path="/returns-policy"
      title="Return & refund policy"
      intro="The short version of what happens if something isn't right with an order."
    >
      <div className="space-y-5">
        {sections.map(({ icon: Icon, title, body }) => (
          <div key={title} className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-tint text-brand">
              <Icon className="h-[18px] w-[18px]" strokeWidth={2.25} />
            </span>
            <div>
              <h2 className="text-sm font-bold text-heading tab:text-[15px]">{title}</h2>
              <p className="mt-0.5 text-[13px] leading-relaxed text-ink-slate tab:text-[14px]">{body}</p>
            </div>
          </div>
        ))}
      </div>

      <a
        href={contact.whatsappHref("Hi Zupona, I want to return an item. Order number: ")}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-6 inline-flex h-11 items-center gap-2 rounded-full bg-brand px-5 text-[13.5px] font-bold text-white hover:bg-brand-dark"
      >
        <MessageCircle className="h-4 w-4" />
        Start a return on WhatsApp
      </a>

      <p className="mt-6 text-[11.5px] text-ink-faint">
        Items marked non-returnable on their product page, and items that come back used or
        without their original packaging, are not eligible for return or exchange. See also our{" "}
        <Link href="/guarantees" className="underline">
          guarantees
        </Link>
        .
      </p>
    </InfoPage>
  );
}
