import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import DesktopHeader from "@/components/layout/DesktopHeader";
import CouponCard from "@/components/offers/CouponCard";
import AddCouponForm from "./AddCouponForm";
import { requireUser } from "@/lib/session";
import { walletCoupons } from "@/lib/couponWallet";

export const metadata: Metadata = { title: "My coupons — Zupona", robots: { index: false } };

const TABS = [
  { id: "unused", label: "Unused" },
  { id: "used", label: "Used" },
  { id: "expired", label: "Expired" },
] as const;

/** The shopper's coupon wallet: what they collected, by whether it can still
 * be used, and a box to add one by its code. */
export default async function MyCouponsPage({ searchParams }: PageProps<"/account/coupons">) {
  const user = await requireUser();
  const params = await searchParams;
  const raw = Array.isArray(params.tab) ? params.tab[0] : params.tab;
  const tab = TABS.find((entry) => entry.id === raw)?.id ?? "unused";
  const coupons = await walletCoupons(user.id);
  const shown = coupons.filter((coupon) => coupon.state === tab);

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-brand-mist pb-10 tab:max-w-none tab:pb-12">
      <DesktopHeader />
      <header className="flex items-center gap-3 border-b border-line-soft bg-white px-4 py-3 tab:mx-auto tab:mt-6 tab:w-full tab:max-w-2xl tab:rounded-2xl tab:border">
        <Link href="/account" aria-label="Back to account">
          <ChevronLeft className="h-5 w-5 text-ink" />
        </Link>
        <h1 className="text-base font-bold text-heading">My coupons</h1>
        <Link href="/offers" className="ml-auto text-[12px] font-semibold text-brand">
          Get more ›
        </Link>
      </header>
      <main className="flex-1 px-4 pt-4 tab:mx-auto tab:w-full tab:max-w-2xl tab:px-0">
        <AddCouponForm />

        <div role="tablist" className="mt-3 flex gap-1 rounded-xl bg-white p-1">
          {TABS.map((entry) => {
            const count = coupons.filter((coupon) => coupon.state === entry.id).length;
            return (
              <Link
                key={entry.id}
                role="tab"
                aria-selected={tab === entry.id}
                href={entry.id === "unused" ? "/account/coupons" : `/account/coupons?tab=${entry.id}`}
                className={`flex-1 rounded-lg py-2 text-center text-[13px] font-semibold ${
                  tab === entry.id ? "bg-brand text-white" : "text-ink-muted"
                }`}
              >
                {entry.label} ({count})
              </Link>
            );
          })}
        </div>

        {shown.length === 0 ? (
          <p className="mt-8 text-center text-[13px] text-ink-slate">
            {tab === "unused" ? (
              <>
                No coupons yet. <Link href="/offers" className="font-semibold text-brand">Collect some on Offers</Link>.
              </>
            ) : (
              "Nothing here."
            )}
          </p>
        ) : (
          <div className="mt-3 flex flex-col gap-2">
            {shown.map((coupon) => (
              <CouponCard key={coupon.id} coupon={coupon} mode="wallet" />
            ))}
          </div>
        )}
        <p className="mt-4 text-[11.5px] text-ink-faint">
          Apply a coupon at checkout. Its conditions are checked when you use it.
        </p>
      </main>
    </div>
  );
}
