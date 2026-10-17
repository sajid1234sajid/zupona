import type { ReactNode } from "react";
import { Flame, Trophy } from "lucide-react";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { listStoreProducts } from "@/lib/storefront";
import { toSummary } from "@/lib/summary";
import Price from "@/components/ui/Price";
import RatingStars from "@/components/ui/RatingStars";
import Badge, { type BadgeKind } from "@/components/ui/Badge";
import Countdown from "@/components/ui/Countdown";
import ProductCard from "@/components/home/ProductCard";

export const metadata = { title: "UI components", robots: { index: false, follow: false } };

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-white p-5">
      <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-ink-muted">{title}</h2>
      <div className="flex flex-wrap items-center gap-4">{children}</div>
    </section>
  );
}

const BADGES: { kind: BadgeKind; text: string }[] = [
  { kind: "label", text: "Best Seller" },
  { kind: "seasonal", text: "Puja Sale" },
  { kind: "lowStock", text: "Only 3 left" },
  { kind: "rank", text: "#1 best seller in Shirts" },
  { kind: "freeDelivery", text: "Free delivery" },
  { kind: "verified", text: "Verified purchase" },
  { kind: "sold", text: "120+ sold" },
];

function anHourFromNow(): string {
  return new Date(Date.now() + 60 * 60 * 1000).toISOString();
}

/** Every shared storefront component and its variants on one page, for
 * checking a change to one of them everywhere at once. Admins only. */
export default async function DevUiPage() {
  // Anyone else gets a plain 404: the page's existence is nobody's business.
  await requireAdmin().catch(() => notFound());
  const sample = (await listStoreProducts({ sort: "popular", limit: 4 })).map(toSummary);
  const inAnHour = anHourFromNow();

  return (
    <main className="mx-auto max-w-5xl space-y-4 bg-surface p-6">
      <h1 className="text-2xl font-extrabold text-heading">UI components</h1>

      <Block title="Price — card / sheet / pdp / cart">
        <Price price={1099} compareAt={1499} size="card" />
        <Price price={1099} compareAt={1499} size="sheet" />
        <Price price={1099} compareAt={1499} size="pdp" />
        <Price price={1099} compareAt={1499} size="cart" />
        <Price price={799} size="pdp" />
      </Block>

      <Block title="RatingStars — xs / sm / md, half steps, empty">
        <RatingStars value={4.5} count={128} size="xs" />
        <RatingStars value={3.5} count={12} size="sm" />
        <RatingStars value={5} count={1} size="md" showValue />
        <RatingStars value={0} count={0} size="md" empty="No reviews yet" />
        <span className="text-xs text-ink-muted">(a card with no reviews draws nothing)</span>
      </Block>

      <Block title="Badge">
        {BADGES.map((badge) => (
          <Badge key={badge.kind} kind={badge.kind}>
            {badge.kind === "lowStock" ? <Flame className="h-3.5 w-3.5" /> : null}
            {badge.kind === "rank" ? <Trophy className="h-3.5 w-3.5 text-rating" /> : null}
            {badge.text}
          </Badge>
        ))}
        <Badge kind="label" size="xs">
          Card tag
        </Badge>
      </Block>

      <Block title="Countdown">
        <Countdown endsAt={inAnHour} />
      </Block>

      <Block title="Colour tokens">
        {["bg-price", "bg-price-was", "bg-discount", "bg-urgency", "bg-success", "bg-rating", "bg-badge-bg", "bg-trustbar-bg", "bg-skeleton", "bg-brand", "bg-brand-tint"].map((token) => (
          <span key={token} className="flex flex-col items-center gap-1 text-[10px] text-ink-muted">
            <span className={`h-10 w-10 rounded-lg border border-line ${token}`} />
            {token.replace("bg-", "")}
          </span>
        ))}
      </Block>

      <section className="rounded-2xl border border-line bg-white p-5">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-ink-muted">ProductCard</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {sample.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
          {sample[0] ? <ProductCard product={{ ...sample[0], id: `${sample[0].id}-c`, campaign: "Puja Sale" }} /> : null}
        </div>
      </section>
    </main>
  );
}
