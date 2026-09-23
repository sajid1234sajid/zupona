import type { Metadata } from "next";
import {
  ArrowRight,
  BadgeCheck,
  ClipboardList,
  Leaf,
  PackageCheck,
  Store,
  Truck,
  Wallet,
} from "lucide-react";
import ProductHeader from "@/components/layout/ProductHeader";
import DesktopHeader from "@/components/layout/DesktopHeader";
import BottomNav from "@/components/layout/BottomNav";

export const metadata: Metadata = {
  title: "Sell on Zupona",
  description:
    "Open a shop on Zupona and reach shoppers across Bangladesh. List your products, pack the orders, and get paid after commission.",
};

/** The four steps, in the order they happen to a seller.
 *
 * Written as the seller's own actions rather than the platform's ("you pack",
 * not "orders are fulfilled"), because someone deciding whether to sell here
 * is working out what the work actually is. */
const STEPS = [
  {
    icon: ClipboardList,
    title: "Apply",
    detail: "Tell us your store name, what you sell and where your money should go.",
  },
  {
    icon: BadgeCheck,
    title: "Get approved",
    detail: "Zupona reviews every shop. Once approved, you can list your products.",
  },
  {
    icon: PackageCheck,
    title: "Pack your orders",
    detail: "Orders land in your Seller Center. Pack them and hand them to the courier.",
  },
  {
    icon: Wallet,
    title: "Get paid",
    detail: "Zupona takes its commission and pays the rest into your bKash, Nagad or bank.",
  },
];

const REASONS = [
  {
    icon: Store,
    title: "A shop of your own",
    detail:
      "Your store gets its own page, your own name on every product, and your own dashboard to run it from.",
  },
  {
    icon: Truck,
    title: "Delivery is handled",
    detail:
      "You do not need a courier contract. Pack the parcel and hand it over — Zupona takes it from there.",
  },
  {
    icon: Wallet,
    title: "No fee to join",
    detail:
      "Opening a shop costs nothing. Zupona only earns when you sell, as a percentage of each order.",
  },
];

export default function SellOnZuponaPage() {
  return (
    // The same shell every storefront page wears. A visitor who followed "Sell
    // on Zupona" out of the menu still has the shop's header and tab bar to get
    // back with -- without them this page is a dead end on a phone.
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-white pb-20 tab:max-w-none tab:pb-12">
      <div className="tab:hidden">
        <ProductHeader />
      </div>
      <DesktopHeader />

      <main className="flex-1">
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#0e3220] via-[#10402a] to-[#071c12] px-4 py-14 lg:py-20">
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          <span className="absolute -top-24 -left-20 h-72 w-72 rounded-full bg-brand-light/20 blur-3xl" />
          <span className="absolute -bottom-28 -right-24 h-80 w-80 rounded-full bg-brand/20 blur-3xl" />
          <Leaf className="absolute right-6 top-10 h-36 w-36 -rotate-45 text-white/[0.04]" />
          <Leaf className="absolute -left-4 bottom-4 h-28 w-28 rotate-12 text-white/[0.04]" />
        </div>

        <div className="relative mx-auto max-w-[720px] text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-white/70">
            <Store className="h-3.5 w-3.5" />
            Zupona Seller Center
          </span>

          <h1 className="mt-4 text-3xl font-extrabold leading-tight text-white lg:text-[40px]">
            Sell your products on Zupona
          </h1>
          <p className="mx-auto mt-3 max-w-[520px] text-sm leading-relaxed text-white/65 lg:text-base">
            Open a shop, list what you sell, and reach shoppers across Bangladesh. It costs nothing
            to start — Zupona earns only when you do.
          </p>

          {/* Plain anchors, not `Link`: these leave the storefront for
              seller.zupona.com, and a client-side navigation would have to
              follow a cross-origin redirect in the middle of an RSC fetch. */}
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <a
              href="/seller/apply"
              className="inline-flex h-12 items-center gap-2 rounded-xl bg-white px-6 text-sm font-bold text-[#0e3220] shadow-lg shadow-black/20 transition hover:bg-white/90"
            >
              Open a shop
              <ArrowRight className="h-4 w-4" />
            </a>
            <a
              href="/seller/login"
              className="inline-flex h-12 items-center rounded-xl border border-white/20 px-6 text-sm font-semibold text-white/80 transition hover:border-white/40 hover:text-white"
            >
              I already sell here
            </a>
          </div>
        </div>
      </section>

      {/* Why */}
      <section className="mx-auto max-w-[980px] px-4 py-12 lg:py-16">
        <h2 className="text-center text-xl font-bold text-neutral-900 lg:text-2xl">
          Why sell on Zupona
        </h2>

        <div className="mt-7 grid gap-4 sm:grid-cols-3">
          {REASONS.map(({ icon: Icon, title, detail }) => (
            <div
              key={title}
              className="rounded-2xl border border-neutral-200/80 bg-white p-5 shadow-sm"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand/10">
                <Icon className="h-5 w-5 text-brand" />
              </span>
              <h3 className="mt-3.5 text-[15px] font-bold text-neutral-800">{title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-neutral-500">{detail}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="bg-[#f1f5f3] px-4 py-12 lg:py-16">
        <div className="mx-auto max-w-[980px]">
          <h2 className="text-center text-xl font-bold text-neutral-900 lg:text-2xl">
            How it works
          </h2>
          <p className="mx-auto mt-2 max-w-[460px] text-center text-sm text-neutral-500">
            Four steps from applying to being paid.
          </p>

          <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map(({ icon: Icon, title, detail }, index) => (
              <li
                key={title}
                className="relative rounded-2xl border border-neutral-200/80 bg-white p-5 shadow-sm"
              >
                <span className="absolute right-4 top-4 text-2xl font-extrabold text-neutral-100">
                  {index + 1}
                </span>
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand/10">
                  <Icon className="h-5 w-5 text-brand" />
                </span>
                <h3 className="mt-3.5 text-[15px] font-bold text-neutral-800">{title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-neutral-500">{detail}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* What it costs -- said plainly rather than buried, because a seller who
          discovers commission after their first sale is a support ticket. */}
      <section className="mx-auto max-w-[720px] px-4 py-12 lg:py-16">
        <div className="rounded-2xl border border-neutral-200/80 bg-white p-6 shadow-sm lg:p-8">
          <h2 className="text-xl font-bold text-neutral-900">What it costs</h2>
          <dl className="mt-5 divide-y divide-neutral-100 text-sm">
            <div className="flex items-start justify-between gap-4 py-3">
              <dt className="text-neutral-500">Opening a shop</dt>
              <dd className="shrink-0 font-semibold text-brand">Free</dd>
            </div>
            <div className="flex items-start justify-between gap-4 py-3">
              <dt className="text-neutral-500">Listing your products</dt>
              <dd className="shrink-0 font-semibold text-brand">Free</dd>
            </div>
            <div className="flex items-start justify-between gap-4 py-3">
              <dt className="text-neutral-500">
                Commission on a sale
                <span className="mt-0.5 block text-xs text-neutral-400">
                  Deducted from each order before you are paid. Your rate is shown in your Seller
                  Center.
                </span>
              </dt>
              <dd className="shrink-0 font-semibold text-neutral-800">A percentage</dd>
            </div>
          </dl>
        </div>

        <div className="mt-8 text-center">
          <a
            href="/seller/apply"
            className="inline-flex h-12 items-center gap-2 rounded-xl bg-brand px-6 text-sm font-bold text-white shadow-lg shadow-brand/25 transition hover:bg-brand-dark"
          >
            Open a shop
            <ArrowRight className="h-4 w-4" />
          </a>
          <p className="mt-3 text-xs text-neutral-400">
            Takes a few minutes. Zupona reviews every application.
          </p>
        </div>
      </section>
      </main>

      <BottomNav />
    </div>
  );
}
