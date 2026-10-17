import type { Metadata } from "next";
import Link from "next/link";
import InfoPage, { Section } from "@/components/info/InfoPage";
import { getPolicyFacts, listJoin } from "@/lib/policyFacts";
import { getSupportContact } from "@/lib/contact";
import { formatPrice } from "@/lib/format";

export const metadata: Metadata = {
  title: "Shipping & Delivery — Zupona",
  description:
    "Delivery fees, free delivery threshold, delivery times and payment on delivery for Zupona orders across Bangladesh.",
  alternates: { canonical: "/shipping" },
};

export default async function ShippingPage() {
  const [facts, contact] = await Promise.all([getPolicyFacts(), getSupportContact()]);
  const eta = `${facts.deliveryDays.min}–${facts.deliveryDays.max} days`;

  const rows = [
    { label: "Delivery area", value: "All 64 districts of Bangladesh" },
    { label: "Delivery fee", value: formatPrice(facts.deliveryFee) + " per order" },
    {
      label: "Free delivery",
      value:
        facts.freeShippingThreshold > 0
          ? `On orders over ${formatPrice(facts.freeShippingThreshold)}`
          : "On products marked “Free delivery”",
    },
    { label: "Delivery time", value: `Usually ${eta} after your order is confirmed` },
    { label: "Payment", value: listJoin(facts.paymentMethods) },
  ];

  return (
    <InfoPage
      path="/shipping"
      title="Shipping & delivery"
      updated="2026-10-17"
      intro="Everything about getting your order to your door."
    >
      <dl className="overflow-hidden rounded-2xl border border-line-soft">
        {rows.map((row, index) => (
          <div
            key={row.label}
            className={`grid grid-cols-[120px_1fr] gap-3 px-4 py-3 text-[13px] tab:grid-cols-[180px_1fr] tab:text-[14px] ${
              index % 2 === 0 ? "bg-brand-mist" : "bg-white"
            }`}
          >
            <dt className="font-semibold text-ink-muted">{row.label}</dt>
            <dd className="font-semibold text-heading">{row.value}</dd>
          </div>
        ))}
      </dl>

      <Section title="Delivery fee">
        <p>
          One delivery fee of {formatPrice(facts.deliveryFee)} is charged per order, however many
          items it holds.
          {facts.freeShippingThreshold > 0
            ? ` When the items in your order come to more than ${formatPrice(facts.freeShippingThreshold)}, delivery is free.`
            : ""}{" "}
          Some products are marked “Free delivery” on their page; an order made up only of those
          products ships free whatever its total. The cart and checkout always show the exact fee
          before you place the order.
        </p>
      </Section>

      <Section title="How long it takes">
        <p>
          Most orders arrive within {eta} after we confirm them. Remote areas, public holidays
          and bad weather can add a day or two. You can follow every step in{" "}
          <Link href="/account/orders">My Orders</Link>.
        </p>
      </Section>

      <Section title="When the courier arrives">
        <ul>
          <li>The courier calls the phone number on your order before coming, so keep it on.</li>
          <li>
            Pay the amount shown on your order. The courier should never ask for more than that.
          </li>
          <li>
            If the parcel is visibly damaged, tell the courier and{" "}
            <a href={contact.whatsappHref()} target="_blank" rel="noopener noreferrer">
              message us on WhatsApp
            </a>{" "}
            with photos.
          </li>
        </ul>
      </Section>

      <Section title="If we cannot reach you">
        <p>
          If the courier cannot reach you, the delivery can be delayed or the parcel returned to us.
          Message us as soon as you can and we will arrange it again.
        </p>
      </Section>

      <Section title="Orders from different shops">
        <p>
          An order can hold products from more than one shop on Zupona. You still pay one delivery
          fee, but the items may arrive in separate parcels.
        </p>
      </Section>
    </InfoPage>
  );
}
