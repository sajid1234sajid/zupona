import Link from "next/link";
import { guaranteesFrom } from "@/components/info/Guarantees";
import type { PolicyFacts } from "@/lib/policyFacts";

/** The shop's promises, small enough for the buy box: the same list the
 * guarantees page shows, so the two can never disagree. */
export default function ProductPromises({ facts }: { facts: PolicyFacts }) {
  const items = guaranteesFrom(facts).filter((item) => item.key !== "privacy");
  return (
    <section aria-labelledby="promises-title" className="rounded-2xl border border-line bg-white p-4">
      <div className="flex items-center justify-between">
        <h2 id="promises-title" className="text-sm font-bold text-heading">
          Zupona promise
        </h2>
        <Link href="/guarantees" prefetch={false} className="text-xs font-semibold text-brand">
          Details
        </Link>
      </div>
      <ul className="mt-2.5 space-y-2.5">
        {items.map(({ key, icon: Icon, title, body }) => (
          <li key={key} className="flex gap-2.5">
            <Icon className="mt-0.5 h-4 w-4 shrink-0 text-brand" strokeWidth={2.2} aria-hidden />
            <span className="min-w-0 text-[12.5px] leading-snug text-ink-slate">
              <span className="font-bold text-heading">{title}.</span> {body}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
