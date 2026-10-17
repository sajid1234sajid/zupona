import type { Metadata } from "next";
import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import InfoPage, { Section } from "@/components/info/InfoPage";
import { getSupportContact } from "@/lib/contact";

export const metadata: Metadata = {
  title: "Safety & Scam Alerts — Zupona",
  description:
    "Zupona never asks for advance payment to a personal bKash or Nagad number, or for your OTP. Learn how to spot fake pages and report a scam.",
  alternates: { canonical: "/safety" },
};

export default async function SafetyPage() {
  const contact = await getSupportContact();

  return (
    <InfoPage
      path="/safety"
      title="Safety & scam alerts"
      intro="Scammers sometimes pretend to be online shops. Here is how to know it is really Zupona."
    >
      <div className="flex gap-3 rounded-2xl border border-urgency/30 bg-badge-bg p-4">
        <ShieldAlert className="h-6 w-6 shrink-0 text-urgency" strokeWidth={2.2} />
        <p className="text-[13.5px] font-semibold leading-snug text-heading tab:text-[15px]">
          Zupona never asks you to send advance payment to a personal bKash or Nagad number, and
          never asks for your one-time code (OTP), password or PIN.
        </p>
      </div>

      <Section title="The real Zupona">
        <ul>
          <li>
            Our website is <strong>zupona.com</strong>. Check the address bar before you order.
          </li>
          <li>
            Our support WhatsApp is{" "}
            <a href={contact.whatsappHref()} target="_blank" rel="noopener noreferrer">
              the one on our Contact page
            </a>
            .
          </li>
          {contact.facebook ? (
            <li>
              Our only Facebook page is{" "}
              <a href={contact.facebook} target="_blank" rel="noopener noreferrer">
                this one
              </a>
              . Pages with a similar name are not us.
            </li>
          ) : null}
          <li>Every real order shows in My Orders with its number and status.</li>
        </ul>
      </Section>

      <Section title="Signs of a scam">
        <ul>
          <li>Someone asks you to pay first to “confirm” or “book” an order.</li>
          <li>Someone asks for the code we send you by SMS.</li>
          <li>A “prize”, “lottery” or “refund” message asks for a fee to release it.</li>
          <li>A courier asks for more money than the amount on your order.</li>
          <li>A page offers prices far below any real shop and only takes advance payment.</li>
        </ul>
      </Section>

      <Section title="If you think you were contacted by a scammer">
        <ul>
          <li>Do not send money and do not share any code.</li>
          <li>Check your order in <Link href="/account/orders">My Orders</Link>.</li>
          <li>
            Report it to us on{" "}
            <a
              href={contact.whatsappHref("I want to report a suspicious message or page: ")}
              target="_blank"
              rel="noopener noreferrer"
            >
              WhatsApp
            </a>{" "}
            with a screenshot, so we can warn other customers.
          </li>
        </ul>
      </Section>
    </InfoPage>
  );
}
