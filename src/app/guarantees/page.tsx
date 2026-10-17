import type { Metadata } from "next";
import Link from "next/link";
import InfoPage, { Section } from "@/components/info/InfoPage";
import GuaranteeList, { guaranteesFrom } from "@/components/info/Guarantees";
import { getPolicyFacts } from "@/lib/policyFacts";

export const metadata: Metadata = {
  title: "Our Guarantees — Zupona",
  description:
    "Cash on Delivery, easy returns for wrong or damaged items, delivery across Bangladesh, verified reviews and data privacy.",
  alternates: { canonical: "/guarantees" },
};

export default async function GuaranteesPage() {
  const facts = await getPolicyFacts();

  return (
    <InfoPage
      path="/guarantees"
      title="Our guarantees"
      intro="Every order on Zupona comes with these promises, whichever shop it is from."
    >
      <GuaranteeList items={guaranteesFrom(facts)} />

      <Section title="If something goes wrong">
        <p>
          Tell us as soon as you can — <Link href="/contact">contact us</Link> with your order number
          and, for a damaged or wrong item, a photo. You can follow your order in{" "}
          <Link href="/account/orders">My Orders</Link>.
        </p>
      </Section>
    </InfoPage>
  );
}
