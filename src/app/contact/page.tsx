import type { Metadata } from "next";
import Link from "next/link";
import { Clock, HelpCircle, Mail, MessageCircle, Package, Phone } from "lucide-react";
import InfoPage, { Section } from "@/components/info/InfoPage";
import { getSupportContact, formatWhatsapp } from "@/lib/contact";
import { getCurrentUser } from "@/lib/session";
import ContactForm from "@/components/info/ContactForm";

export const metadata: Metadata = {
  title: "Contact Zupona — WhatsApp, Phone & Email Support",
  description:
    "Reach Zupona customer support on WhatsApp for orders, delivery, returns and payments.",
  alternates: { canonical: "/contact" },
};

/** Every channel here is one the shop has set up. WhatsApp always is; phone,
 * email and Facebook appear only once Settings holds them, so this page never
 * lists an address nobody reads. */
export default async function ContactPage() {
  const [contact, user] = await Promise.all([getSupportContact(), getCurrentUser()]);

  const channels = [
    {
      icon: MessageCircle,
      title: "WhatsApp",
      detail: formatWhatsapp(contact.whatsapp),
      note: "The fastest way to reach us. Send your order number if it is about an order.",
      href: contact.whatsappHref("Hi Zupona, I need help with "),
      cta: "Chat on WhatsApp",
      external: true,
    },
    contact.phone
      ? {
          icon: Phone,
          title: "Phone",
          detail: contact.phone,
          note: "Call us about an order or a delivery.",
          href: `tel:${contact.phone.replace(/[^\d+]/g, "")}`,
          cta: "Call now",
          external: false,
        }
      : null,
    contact.email
      ? {
          icon: Mail,
          title: "Email",
          detail: contact.email,
          note: "For anything that needs photos or documents.",
          href: `mailto:${contact.email}`,
          cta: "Send an email",
          external: false,
        }
      : null,
    contact.facebook
      ? {
          icon: MessageCircle,
          title: "Facebook",
          detail: "Our official page",
          note: "Message us on Messenger. This is our only Facebook page.",
          href: contact.facebook,
          cta: "Open our page",
          external: true,
        }
      : null,
  ].filter((channel) => channel !== null);

  return (
    <InfoPage
      path="/contact"
      title="Contact us"
      intro="Questions about an order, a delivery or a product? We're here to help."
    >
      <ul className="grid grid-cols-1 gap-3 tab:grid-cols-2">
        {channels.map(({ icon: Icon, title, detail, note, href, cta, external }) => (
          <li key={title} className="flex flex-col rounded-2xl border border-line-soft p-4">
            <span className="flex items-center gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-tint text-brand">
                <Icon className="h-5 w-5" strokeWidth={2.2} />
              </span>
              <span className="min-w-0">
                <span className="block text-[14px] font-bold text-heading">{title}</span>
                <span className="block truncate text-[13px] font-semibold text-brand-dark">
                  {detail}
                </span>
              </span>
            </span>
            <span className="mt-2 flex-1 text-[12.5px] leading-snug text-ink-slate">{note}</span>
            <a
              href={href}
              {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
              className="mt-3 inline-flex h-10 items-center justify-center rounded-full bg-brand px-4 text-[13px] font-bold text-white hover:bg-brand-dark"
            >
              {cta}
            </a>
          </li>
        ))}
      </ul>

      <p className="mt-4 flex items-center gap-2 text-[12.5px] text-ink-muted">
        <Clock className="h-4 w-4 text-brand" />
        We reply to WhatsApp messages as soon as we can, usually the same day.
      </p>

      <Section title="Send us a message">
        <p>Leave your number and we&apos;ll get back to you, usually within one working day.</p>
        <div className="mt-3">
          <ContactForm defaults={{ name: user?.name ?? "", phone: user?.phone ?? "" }} />
        </div>
      </Section>

      <Section title="Before you message">
        <ul>
          <li>
            <Package className="mr-1 inline h-4 w-4 text-brand" />
            Where is my order? <Link href="/account/orders">Track it in My Orders</Link> — every
            status change shows there.
          </li>
          <li>
            <HelpCircle className="mr-1 inline h-4 w-4 text-brand" />
            Most questions are answered in the <Link href="/support">Help center</Link>.
          </li>
        </ul>
      </Section>

      <Section title="Stay safe">
        <p>
          Zupona will never ask you to send money in advance to a personal bKash or Nagad number,
          and will never ask for your one-time code (OTP). If someone does, it is not us.{" "}
          <Link href="/safety">Learn how to spot scams</Link>.
        </p>
      </Section>
    </InfoPage>
  );
}
