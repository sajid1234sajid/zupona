import Link from "next/link";
import { BadgeCheck, Banknote, RotateCcw, Truck } from "lucide-react";
import { getPolicyFacts, days } from "@/lib/policyFacts";
import { formatPrice } from "@/lib/format";

/** "Why shop on Zupona", in one strip: the promises a first-time shopper from
 * an ad is looking for before they trust a shop they have never heard of.
 * Each line is read from the settings that enforce it, and a promise the shop
 * has not set (a return window of 0) is not made. The whole strip leads to
 * the guarantees page. */
export default async function TrustBar() {
  const facts = await getPolicyFacts();
  const items = [
    { icon: Banknote, title: "Cash on Delivery", sub: "Pay when it arrives" },
    facts.freeShippingThreshold > 0
      ? { icon: Truck, title: "Free delivery", sub: `On orders over ${formatPrice(facts.freeShippingThreshold)}` }
      : { icon: Truck, title: "All of Bangladesh", sub: `${facts.deliveryDays.min}–${facts.deliveryDays.max} day delivery` },
    facts.returnDays > 0
      ? { icon: RotateCcw, title: `${days(facts.returnDays)} returns`, sub: "Wrong or damaged? Send it back" }
      : { icon: RotateCcw, title: "Easy returns", sub: "Wrong or damaged? We fix it" },
    { icon: BadgeCheck, title: "Verified reviews", sub: "Only from real buyers" },
  ];

  return (
    <Link
      href="/guarantees"
      prefetch={false}
      aria-label="Why shop on Zupona: see our guarantees"
      className="mx-3.5 mt-3 grid grid-cols-2 gap-x-2 gap-y-2.5 rounded-2xl bg-heading px-3 py-3 text-white tab:mx-0 tab:mt-4 tab:grid-cols-4 tab:gap-4 tab:px-6 tab:py-4"
    >
      {items.map(({ icon: Icon, title, sub }) => (
        <span key={title} className="flex min-w-0 items-center gap-2">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/10 tab:h-10 tab:w-10">
            <Icon className="h-4 w-4 text-brand-leaf tab:h-5 tab:w-5" strokeWidth={2.2} />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[12px] font-bold tab:text-[14px]">{title}</span>
            <span className="block truncate text-[10.5px] text-white/70 tab:text-[12px]">{sub}</span>
          </span>
        </span>
      ))}
    </Link>
  );
}
