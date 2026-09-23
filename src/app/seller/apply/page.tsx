import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BadgeCheck, Leaf, Truck, Wallet } from "lucide-react";
import { getCurrentUser } from "@/lib/session";
import { getCurrentSeller } from "@/lib/sellers";
import { sellerUrl } from "@/lib/panelUrl";
import ApplyForm from "@/components/seller/ApplyForm";
import ZuponaMark from "@/components/brand/ZuponaMark";

export const metadata: Metadata = {
  title: "Open a shop on Zupona",
  description: "Apply to sell on Zupona. List your products and reach shoppers across Bangladesh.",
};

/** What an applicant is agreeing to, said plainly before they fill anything
 * in. A seller who learns about commission after their first sale is a support
 * ticket and a bad review, so the terms lead rather than hide in a footer. */
const PROMISES = [
  {
    icon: BadgeCheck,
    title: "We check every shop",
    detail: "Zupona reviews your application before your products can go live.",
  },
  {
    icon: Truck,
    title: "You pack, we handle the rest",
    detail: "Orders reach you here. Hand the parcel over and the delivery is ours.",
  },
  {
    icon: Wallet,
    title: "Paid after commission",
    detail: "Zupona keeps a percentage of each sale; the rest is paid to your account.",
  },
];

export default async function SellerApplyPage() {
  const user = await getCurrentUser();

  // Someone who already applied is sent to read their status: the form would
  // only refuse them, and the status screen is what they actually came for.
  if (user && (await getCurrentSeller())) {
    redirect(await sellerUrl("/seller/pending"));
  }

  return (
    <div className="min-h-screen bg-[#f1f5f3]">
      <div className="relative overflow-hidden bg-gradient-to-br from-[#0e3220] via-[#10402a] to-[#071c12] px-4 pb-16 pt-10">
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          <span className="absolute -top-24 -left-16 h-72 w-72 rounded-full bg-brand-light/20 blur-3xl" />
          <Leaf className="absolute right-6 top-8 h-32 w-32 -rotate-45 text-white/[0.04]" />
        </div>

        <div className="relative mx-auto max-w-[880px] text-center">
          <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-xl shadow-black/30">
            <ZuponaMark className="h-11 w-11" />
          </span>
          <h1 className="text-2xl font-extrabold text-white lg:text-3xl">Open a shop on Zupona</h1>
          <p className="mx-auto mt-2 max-w-[520px] text-sm text-white/60">
            Tell us about your store. We review every application, and you will hear back once it
            has been checked.
          </p>
        </div>
      </div>

      {/* `relative` is load-bearing: the hero above establishes its own
          stacking context, and without one here it paints over the top of
          these cards where they overlap it. */}
      <div className="relative mx-auto -mt-10 max-w-[880px] px-4 pb-14">
        <div className="grid gap-3 sm:grid-cols-3">
          {PROMISES.map(({ icon: Icon, title, detail }) => (
            <div
              key={title}
              className="rounded-2xl border border-neutral-200/70 bg-white p-4 shadow-sm"
            >
              <Icon className="h-5 w-5 text-brand" />
              <p className="mt-2.5 text-[13px] font-semibold text-neutral-800">{title}</p>
              <p className="mt-1 text-xs leading-relaxed text-neutral-500">{detail}</p>
            </div>
          ))}
        </div>

        <div className="mt-4 rounded-2xl border border-neutral-200/70 bg-white p-5 shadow-sm lg:p-6">
          <ApplyForm signedInAs={user?.email ?? user?.name ?? null} />
        </div>

        {user ? null : (
          <p className="mt-4 text-center text-xs text-neutral-500">
            Already have a Zupona account?{" "}
            <Link href="/seller/login" className="font-semibold text-brand hover:underline">
              Sign in first
            </Link>
            , then apply.
          </p>
        )}
      </div>
    </div>
  );
}
