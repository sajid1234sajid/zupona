import Link from "next/link";
import { BadgeCheck, Banknote, Lock, RotateCcw, Truck } from "lucide-react";
import type { PolicyFacts } from "@/lib/policyFacts";
import { days } from "@/lib/policyFacts";
import { formatPrice } from "@/lib/format";

export interface Guarantee {
  key: string;
  icon: typeof Banknote;
  title: string;
  body: string;
  href?: string;
}

/** The promises the shop keeps, built from the settings that enforce them.
 *
 * Only what is already true goes in: Cash on Delivery is how every order can
 * be paid, reviews are limited to delivered orders in code, and the return
 * line quotes the window from Settings or, with none set, the case-by-case
 * promise the returns page makes. A delivery-time refund promise is left out
 * until the owner decides on one. One source, so the guarantees page and any
 * block reusing it on the product page, cart or orders can never disagree. */
export function guaranteesFrom(facts: PolicyFacts): Guarantee[] {
  return [
    {
      key: "cod",
      icon: Banknote,
      title: "Cash on Delivery",
      body: "Pay only when your parcel arrives. No advance payment needed.",
    },
    {
      key: "returns",
      icon: RotateCcw,
      title: facts.returnDays > 0 ? `${days(facts.returnDays)} easy returns` : "Wrong or damaged? We fix it",
      body:
        facts.returnDays > 0
          ? `Return an item within ${days(facts.returnDays)} of delivery if it is damaged, wrong or not as described.`
          : "If an item arrives damaged, wrong or not as described, tell us and we'll make it right.",
      href: "/returns-policy",
    },
    {
      key: "delivery",
      icon: Truck,
      title: "Delivery across Bangladesh",
      body:
        facts.freeShippingThreshold > 0
          ? `Usually ${facts.deliveryDays.min}–${facts.deliveryDays.max} days. Free over ${formatPrice(facts.freeShippingThreshold)}.`
          : `Usually ${facts.deliveryDays.min}–${facts.deliveryDays.max} days, to all 64 districts.`,
      href: "/shipping",
    },
    {
      key: "reviews",
      icon: BadgeCheck,
      title: "Verified reviews only",
      body: "Only customers who received the product can review it.",
    },
    {
      key: "privacy",
      icon: Lock,
      title: "Your data is safe",
      body: "We never sell your personal information.",
      href: "/privacy",
    },
  ];
}

export default function GuaranteeList({ items }: { items: Guarantee[] }) {
  return (
    <ul className="grid grid-cols-1 gap-3 tab:grid-cols-2">
      {items.map(({ key, icon: Icon, title, body, href }) => (
        <li key={key} className="flex gap-3 rounded-2xl border border-line-soft bg-white p-4">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-tint text-brand">
            <Icon className="h-5 w-5" strokeWidth={2.2} />
          </span>
          <span className="min-w-0">
            <span className="block text-[14px] font-bold text-heading">{title}</span>
            <span className="mt-0.5 block text-[12.5px] leading-snug text-ink-slate">{body}</span>
            {href ? (
              <Link href={href} prefetch={false} className="mt-1 inline-block text-[12px] font-semibold text-brand hover:underline">
                Learn more
              </Link>
            ) : null}
          </span>
        </li>
      ))}
    </ul>
  );
}
