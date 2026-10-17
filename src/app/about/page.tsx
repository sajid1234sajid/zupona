import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, Banknote, MessageCircle, ShieldCheck, Store, Truck } from "lucide-react";
import InfoPage, { Section } from "@/components/info/InfoPage";
import { getPolicyFacts, listJoin } from "@/lib/policyFacts";
import { getSupportContact, formatWhatsapp } from "@/lib/contact";
import { formatPrice } from "@/lib/format";

export const metadata: Metadata = {
  title: "About Zupona — Trusted Online Shopping in Bangladesh",
  description:
    "Who Zupona is, what we sell, how products and sellers are checked, and how to reach us. Cash on Delivery across Bangladesh.",
  alternates: { canonical: "/about" },
};

export default async function AboutPage() {
  const [facts, contact] = await Promise.all([getPolicyFacts(), getSupportContact()]);

  const pillars = [
    {
      icon: Banknote,
      title: "Pay when it arrives",
      body: `${listJoin(facts.paymentMethods)}. You never have to pay before you see your parcel.`,
    },
    {
      icon: Truck,
      title: "Delivery across Bangladesh",
      body:
        facts.freeShippingThreshold > 0
          ? `${facts.deliveryDays.min}–${facts.deliveryDays.max} days, free on orders over ${formatPrice(facts.freeShippingThreshold)}.`
          : `Usually ${facts.deliveryDays.min}–${facts.deliveryDays.max} days, to every district.`,
    },
    {
      icon: BadgeCheck,
      title: "Reviews from real buyers",
      body: "Only a customer who received the product can review it.",
    },
    {
      icon: ShieldCheck,
      title: "Checked sellers",
      body: "Every shop on Zupona is approved by us before it can sell.",
    },
  ];

  return (
    <InfoPage
      path="/about"
      title="About Zupona"
      intro="Zupona is an online marketplace for Bangladesh, built so that shopping online feels as safe as shopping at a shop you know."
    >
      <ul className="grid grid-cols-1 gap-3 tab:grid-cols-2">
        {pillars.map(({ icon: Icon, title, body }) => (
          <li key={title} className="flex gap-3 rounded-2xl border border-line-soft bg-brand-mist p-4">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand text-white">
              <Icon className="h-5 w-5" strokeWidth={2.2} />
            </span>
            <span>
              <span className="block text-[14px] font-bold text-heading">{title}</span>
              <span className="mt-0.5 block text-[12.5px] leading-snug text-ink-slate">{body}</span>
            </span>
          </li>
        ))}
      </ul>

      <Section title="Our mission">
        <p>
          Many people in Bangladesh have been let down by online shops: a product that looks
          nothing like its photo, a parcel that never comes, a page that asks for money in advance
          and disappears. Zupona exists to be the opposite. We show the real price, deliver to your
          door, and let you pay when the parcel is in your hands.
        </p>
      </Section>

      <Section title="What we sell">
        <p>
          Fashion for men, women and children, electronics, health and beauty, and everyday
          essentials. Zupona sells some products itself and is also a marketplace, so independent
          Bangladeshi shops can list their products here too. Each product page says who sells it.
        </p>
        <p>
          <Link href="/categories">Browse all categories</Link>
        </p>
      </Section>

      <Section title="How we check products and sellers">
        <ul>
          <li>A shop has to apply and be approved before it can sell on Zupona.</li>
          {facts.sellerProductsReviewed ? (
            <li>A new product from a seller is reviewed by our team before it appears in the shop.</li>
          ) : null}
          <li>
            Ratings come only from customers whose order was delivered, so nobody can post a review
            of something they never bought.
          </li>
          <li>
            If something arrives damaged, wrong or not as described, our{" "}
            <Link href="/returns-policy">return policy</Link> covers it.
          </li>
        </ul>
      </Section>

      <Section title="Sell on Zupona">
        <p>
          Run a shop? <Link href="/sell">Open a shop on Zupona</Link> and reach customers across
          the country.
        </p>
      </Section>

      <Section title="Talk to us">
        <p className="flex flex-wrap items-center gap-2">
          <MessageCircle className="h-4 w-4 text-brand" />
          <a href={contact.whatsappHref()} target="_blank" rel="noopener noreferrer">
            WhatsApp {formatWhatsapp(contact.whatsapp)}
          </a>
          <span className="text-ink-faint">·</span>
          <Store className="h-4 w-4 text-brand" />
          <Link href="/contact">All the ways to reach us</Link>
        </p>
      </Section>
    </InfoPage>
  );
}
