import type { Metadata } from "next";
import Link from "next/link";
import InfoPage, { Section } from "@/components/info/InfoPage";
import { getPolicyFacts, listJoin } from "@/lib/policyFacts";

export const metadata: Metadata = {
  title: "Terms of Use — Zupona",
  description:
    "The terms that apply when you shop on Zupona: accounts, prices, orders, Cash on Delivery, delivery, returns, reviews and marketplace sellers.",
  alternates: { canonical: "/terms" },
};

export default async function TermsPage() {
  const facts = await getPolicyFacts();

  return (
    <InfoPage
      path="/terms"
      title="Terms of use"
      updated="2026-10-17"
      intro="By using zupona.com or the Zupona app, you agree to these terms. Please read them along with our privacy policy and return policy."
    >
      <Section title="1. Your account">
        <ul>
          <li>You must give your real name and a mobile number you own.</li>
          <li>Keep your password and one-time codes private. Zupona will never ask for them.</li>
          <li>
            You are responsible for orders placed from your account. Tell us at once if you think
            someone else has used it.
          </li>
          <li>We may suspend an account used for fraud, fake orders or abuse.</li>
        </ul>
      </Section>

      <Section title="2. Products and prices">
        <ul>
          <li>
            We try to describe every product accurately, with real photos. Small differences in
            colour can come from your screen.
          </li>
          <li>All prices are in Bangladeshi Taka (৳).</li>
          <li>
            If a product is listed at a clearly wrong price because of a mistake, we may cancel the
            order and tell you before it ships. You will never be charged more than the price you
            saw when you ordered.
          </li>
        </ul>
      </Section>

      <Section title="3. Orders">
        <ul>
          <li>
            Placing an order is an offer to buy. The order is accepted when we confirm it, which you
            can see in <Link href="/account/orders">My Orders</Link>.
          </li>
          <li>
            We may cancel an order if the item is out of stock, the address cannot be reached, or
            the order looks fraudulent. If you paid online, you get a full refund.
          </li>
          <li>You can ask us to cancel an order any time before it is shipped.</li>
        </ul>
      </Section>

      <Section title="4. Payment">
        <p>
          We accept {listJoin(facts.paymentMethods)}. With Cash on Delivery, you pay the courier the
          amount shown on your order when it arrives. Repeatedly refusing parcels without a reason
          may lead us to ask for advance payment on future orders.
        </p>
      </Section>

      <Section title="5. Delivery">
        <p>
          We deliver across Bangladesh. Fees and times are explained on our{" "}
          <Link href="/shipping">Shipping &amp; delivery</Link> page. Delivery times are estimates,
          not guarantees, and can be affected by holidays, weather and events outside our control.
        </p>
      </Section>

      <Section title="6. Returns and refunds">
        <p>
          Returns, exchanges and refunds follow our{" "}
          <Link href="/returns-policy">Return &amp; refund policy</Link>. Nothing in these terms
          takes away your rights under the Consumer Rights Protection Act, 2009.
        </p>
      </Section>

      <Section title="7. Reviews">
        <ul>
          <li>Only customers whose order was delivered can review that product.</li>
          <li>
            Reviews must be honest and about the product. We may remove reviews that contain
            abuse, personal information, links or advertising.
          </li>
          <li>We never edit what a customer wrote.</li>
        </ul>
      </Section>

      <Section title="8. Marketplace sellers">
        <p>
          Some products on Zupona are sold by independent shops. The product page says who the
          seller is. Sellers must follow our rules and the law, and Zupona handles your order,
          delivery and support the same way whoever the seller is.
        </p>
      </Section>

      <Section title="9. Points and coupons">
        <p>
          Points and coupons have no cash value, cannot be transferred, and may have conditions or
          expiry dates shown where you get them. We may withdraw points or coupons obtained through
          fraud or abuse.
        </p>
      </Section>

      <Section title="10. Our responsibility">
        <p>
          We are responsible for delivering what you ordered as described. We are not responsible
          for losses that were not foreseeable, or for delays caused by events outside our control.
          Our total responsibility for an order is limited to the amount paid for it, except where
          the law does not allow such a limit.
        </p>
      </Section>

      <Section title="11. Governing law">
        <p>
          These terms are governed by the laws of Bangladesh, including the Digital Commerce
          Operation Guidelines, 2021. Disputes will be handled by the courts of Bangladesh.
        </p>
      </Section>

      <Section title="12. Changes">
        <p>
          We may update these terms. The date at the top shows the latest version, and the version
          in force when you placed an order applies to that order.
        </p>
      </Section>

      <p className="mt-8 text-[12px] text-ink-faint">
        Questions about these terms? <Link href="/contact">Contact us</Link>.
      </p>
    </InfoPage>
  );
}
