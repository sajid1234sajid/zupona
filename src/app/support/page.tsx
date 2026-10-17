import type { Metadata } from "next";
import Link from "next/link";
import { Mail, MessageCircle, Package, Phone, RotateCcw, Truck, XCircle } from "lucide-react";
import InfoPage from "@/components/info/InfoPage";
import SupportCenter, { type ResolvedTopic } from "@/components/info/SupportCenter";
import JsonLd from "@/components/seo/JsonLd";
import { FAQ_TOPICS } from "@/data/faqs";
import { getPolicyFacts } from "@/lib/policyFacts";
import { getSupportContact } from "@/lib/contact";

export const metadata: Metadata = {
  title: "Help Center — Zupona",
  description:
    "Answers about orders, delivery, Cash on Delivery, returns, your account and points. Search the Zupona help center or chat with us on WhatsApp.",
  alternates: { canonical: "/support" },
};

const QUICK_ACTIONS = [
  { label: "Track my order", href: "/account/orders", icon: Truck },
  { label: "Delivery fees", href: "/shipping", icon: Package },
  { label: "Return an item", href: "/returns-policy", icon: RotateCcw },
  { label: "Cancel an order", href: "#cancel", icon: XCircle },
];

export default async function SupportPage() {
  const [facts, contact] = await Promise.all([getPolicyFacts(), getSupportContact()]);

  // Answers are resolved here, against today's settings, so the browser gets
  // plain text to search and the structured data says exactly the same thing.
  const topics: ResolvedTopic[] = FAQ_TOPICS.map((topic) => ({
    id: topic.id,
    title: topic.title,
    items: topic.items.map((item) => ({ q: item.q, a: item.a(facts) })),
  }));

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: topics.flatMap((topic) =>
      topic.items.map((item) => ({
        "@type": "Question",
        name: item.q,
        acceptedAnswer: { "@type": "Answer", text: item.a },
      }))
    ),
  };

  const cancelHref = contact.whatsappHref("Hi Zupona, I want to cancel my order. Order number: ");

  return (
    <InfoPage path="/support" title="Help center" wide>
      <JsonLd data={faqSchema} />

      <ul className="mb-5 grid grid-cols-2 gap-2 tab:grid-cols-4 tab:gap-3">
        {QUICK_ACTIONS.map(({ label, href, icon: Icon }) => {
          const className =
            "flex h-full items-center gap-2.5 rounded-2xl border border-line-soft bg-white p-3 text-[13px] font-semibold text-heading hover:border-brand hover:bg-brand-mist";
          const body = (
            <>
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-tint text-brand">
                <Icon className="h-[18px] w-[18px]" strokeWidth={2.2} />
              </span>
              {label}
            </>
          );
          return (
            <li key={label}>
              {href === "#cancel" ? (
                <a href={cancelHref} target="_blank" rel="noopener noreferrer" className={className}>
                  {body}
                </a>
              ) : (
                <Link href={href} prefetch={false} className={className}>
                  {body}
                </Link>
              )}
            </li>
          );
        })}
      </ul>

      <SupportCenter topics={topics} />

      <section className="mt-8 rounded-2xl bg-brand-mist p-5 tab:p-6">
        <h2 className="text-[16px] font-bold text-heading">Still need help?</h2>
        <p className="mt-1 text-[13px] text-ink-slate">
          Message us with your order number and we&apos;ll sort it out.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <a
            href={contact.whatsappHref("Hi Zupona, I need help with ")}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-10 items-center gap-2 rounded-full bg-brand px-4 text-[13px] font-bold text-white hover:bg-brand-dark"
          >
            <MessageCircle className="h-4 w-4" /> WhatsApp
          </a>
          {contact.phone ? (
            <a
              href={`tel:${contact.phone.replace(/[^\d+]/g, "")}`}
              className="inline-flex h-10 items-center gap-2 rounded-full border border-brand px-4 text-[13px] font-bold text-brand-dark hover:bg-white"
            >
              <Phone className="h-4 w-4" /> Call
            </a>
          ) : null}
          {contact.email ? (
            <a
              href={`mailto:${contact.email}`}
              className="inline-flex h-10 items-center gap-2 rounded-full border border-brand px-4 text-[13px] font-bold text-brand-dark hover:bg-white"
            >
              <Mail className="h-4 w-4" /> Email
            </a>
          ) : null}
          {contact.facebook ? (
            <a
              href={contact.facebook}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-10 items-center gap-2 rounded-full border border-brand px-4 text-[13px] font-bold text-brand-dark hover:bg-white"
            >
              <MessageCircle className="h-4 w-4" /> Messenger
            </a>
          ) : null}
        </div>
      </section>
    </InfoPage>
  );
}
