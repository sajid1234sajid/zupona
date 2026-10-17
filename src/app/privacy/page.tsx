import type { Metadata } from "next";
import Link from "next/link";
import InfoPage, { Section } from "@/components/info/InfoPage";
import { getSupportContact } from "@/lib/contact";

export const metadata: Metadata = {
  title: "Privacy Policy — Zupona",
  description:
    "What personal information Zupona collects, why, who it is shared with, how long it is kept and how to ask for it to be deleted.",
  alternates: { canonical: "/privacy" },
};

/** Written from what the code actually stores: the account and address
 * tables, order records, the session's device details, the `zv` visitor
 * cookie behind Admin > Activity, and the Meta pixel when one is configured.
 * A new kind of data collected means a new line here. */
export default async function PrivacyPage() {
  const contact = await getSupportContact();

  return (
    <InfoPage
      path="/privacy"
      title="Privacy policy"
      updated="2026-10-17"
      intro="This policy explains what information Zupona collects when you use zupona.com or the Zupona app, why we collect it, and the choices you have."
    >
      <Section title="What we collect">
        <ul>
          <li>
            <strong>Account details:</strong> your name, mobile number, and email if you give one.
            If you sign in with Google, we receive your name, email and profile picture from
            Google.
          </li>
          <li>
            <strong>Delivery addresses</strong> you save or enter at checkout.
          </li>
          <li>
            <strong>Orders:</strong> what you bought, prices, payment method and delivery status.
          </li>
          <li>
            <strong>Reviews and photos</strong> you post about products.
          </li>
          <li>
            <strong>Device and usage information:</strong> the browser and device you sign in from
            (to show you your active sessions and protect your account), and which products are
            viewed, added to cart and bought on this browser. A cookie named <code>zv</code> links
            those visits together.
          </li>
          <li>
            <strong>Advertising cookies:</strong> when our Meta (Facebook) pixel is active, Meta
            sets cookies that tell it which ad brought you here and whether you bought something.
          </li>
        </ul>
        <p>We do not collect or store card numbers or your bKash/Nagad PIN.</p>
      </Section>

      <Section title="Why we use it">
        <ul>
          <li>To take, deliver and support your orders, and to contact you about them.</li>
          <li>To verify your mobile number with a one-time code and keep your account secure.</li>
          <li>To show your order history, wishlist, points and recently viewed products.</li>
          <li>To understand what customers look for, and improve the shop.</li>
          <li>To measure our advertising and show our ads to people likely to want them.</li>
          <li>To prevent fraud and fake orders.</li>
        </ul>
      </Section>

      <Section title="Who we share it with">
        <ul>
          <li>
            <strong>Delivery partners</strong> receive your name, phone number and address so they
            can deliver your order.
          </li>
          <li>
            <strong>Sellers on Zupona</strong> receive the details they need to prepare and send
            the items you bought from their shop.
          </li>
          <li>
            <strong>Payment providers</strong> receive what they need to process a payment, when
            you pay online.
          </li>
          <li>
            <strong>SMS providers</strong> receive your number to send verification codes and order
            updates.
          </li>
          <li>
            <strong>Meta</strong> receives advertising events (for example “viewed a product” or
            “made a purchase”) when the pixel is active.
          </li>
          <li>Authorities, when the law of Bangladesh requires it.</li>
        </ul>
        <p>
          <strong>We never sell your personal information.</strong>
        </p>
      </Section>

      <Section title="How long we keep it">
        <p>
          We keep your account information while your account is open. Order records are kept for as
          long as we need them for accounting, tax and legal reasons, even after an account is
          closed. Verification codes are stored only as a one-way hash and expire within minutes.
        </p>
      </Section>

      <Section title="Your choices and rights">
        <ul>
          <li>
            See and edit your profile and addresses in <Link href="/account">My Account</Link>.
          </li>
          <li>
            See the devices signed in to your account, and sign them out, in{" "}
            <Link href="/account/security">Profile &amp; Security</Link>.
          </li>
          <li>
            Ask for a copy of your information, or for your account to be deleted, by{" "}
            <a href={contact.whatsappHref("I'd like to ask about my personal data")} target="_blank" rel="noopener noreferrer">
              messaging us on WhatsApp
            </a>
            {contact.email ? (
              <>
                {" "}
                or emailing <a href={`mailto:${contact.email}`}>{contact.email}</a>
              </>
            ) : null}
            . We will confirm it is you before acting on the request.
          </li>
          <li>You can clear or block cookies in your browser settings at any time.</li>
        </ul>
      </Section>

      <Section title="Security">
        <p>
          Passwords and verification codes are stored hashed, never in plain text. Our site is
          served only over an encrypted (HTTPS) connection.
        </p>
      </Section>

      <Section title="Children">
        <p>
          Zupona is not meant for children under 18 to buy on their own. We do not knowingly collect
          personal information from children.
        </p>
      </Section>

      <Section title="Changes to this policy">
        <p>
          When this policy changes, we update the date at the top of this page. Significant changes
          will also be announced on the site.
        </p>
      </Section>
    </InfoPage>
  );
}
