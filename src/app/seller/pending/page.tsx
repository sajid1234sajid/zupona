import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Clock, Leaf, PauseCircle, XCircle } from "lucide-react";
import { getCurrentUser } from "@/lib/session";
import { getCurrentSeller } from "@/lib/sellers";
import { sellerUrl } from "@/lib/panelUrl";
import { formatDate } from "@/lib/format";
import { logOutSellerAction } from "@/app/seller/actions";
import ZuponaMark from "@/components/brand/ZuponaMark";
import type { SellerStatus } from "@/types";

export const metadata: Metadata = {
  title: "Application status",
  robots: { index: false, follow: false },
};

/** What each state means to the person reading it.
 *
 * A seller whose shop is refused or paused is told plainly and given the one
 * thing they can do about it. "Contact support" is the honest answer for both:
 * neither decision is one they can undo from this screen. */
const STATES: Record<Exclude<SellerStatus, "approved">, {
  icon: typeof Clock;
  tone: string;
  title: string;
  detail: string;
}> = {
  pending: {
    icon: Clock,
    tone: "bg-amber-50 text-amber-600",
    title: "Your application is being reviewed",
    detail:
      "Zupona checks every new shop before it can list products. This usually takes a day or two — you don't need to apply again.",
  },
  rejected: {
    icon: XCircle,
    tone: "bg-red-50 text-red-600",
    title: "Your application was not approved",
    detail:
      "Zupona could not approve this shop. If you think this is a mistake, contact support and they will look at it again.",
  },
  suspended: {
    icon: PauseCircle,
    tone: "bg-neutral-100 text-neutral-500",
    title: "Your shop is paused",
    detail:
      "Selling has been paused for this shop, so your products are not visible to shoppers. Contact support to find out what is needed to restart it.",
  },
};

export default async function SellerPendingPage() {
  const user = await getCurrentUser();
  if (!user) redirect(await sellerUrl("/seller/login"));

  const seller = await getCurrentSeller();
  if (!seller) redirect(await sellerUrl("/seller/apply"));
  if (seller.status === "approved") redirect(await sellerUrl("/seller"));

  const state = STATES[seller.status];
  const Icon = state.icon;

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-[#0e3220] via-[#10402a] to-[#071c12] px-4 py-10">
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <span className="absolute -top-24 -left-16 h-72 w-72 rounded-full bg-brand-light/20 blur-3xl" />
        <Leaf className="absolute right-10 top-12 h-28 w-28 -rotate-45 text-white/[0.04]" />
      </div>

      <div className="relative w-full max-w-[440px]">
        <div className="mb-6 flex flex-col items-center text-center">
          <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-xl shadow-black/30">
            <ZuponaMark className="h-11 w-11" />
          </span>
          <h1 className="text-2xl font-extrabold tracking-wide text-white">ZUPONA</h1>
          <p className="mt-1 text-sm text-white/55">Seller Center</p>
        </div>

        <div className="rounded-2xl bg-white p-6 text-center shadow-2xl shadow-black/30">
          <span
            className={`mx-auto flex h-14 w-14 items-center justify-center rounded-2xl ${state.tone}`}
          >
            <Icon className="h-7 w-7" />
          </span>

          <h2 className="mt-4 text-lg font-bold text-neutral-900">{state.title}</h2>
          <p className="mt-2 text-sm leading-relaxed text-neutral-500">{state.detail}</p>

          <dl className="mt-5 space-y-2 rounded-xl bg-neutral-50 px-4 py-3 text-left text-[13px]">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-neutral-500">Store</dt>
              <dd className="min-w-0 truncate font-semibold text-neutral-800">
                {seller.storeName}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-neutral-500">Applied</dt>
              <dd className="font-medium text-neutral-700">{formatDate(seller.createdAt)}</dd>
            </div>
          </dl>

          <form action={logOutSellerAction} className="mt-5">
            <button
              type="submit"
              className="text-[13px] font-semibold text-neutral-500 transition hover:text-brand"
            >
              Sign out
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
