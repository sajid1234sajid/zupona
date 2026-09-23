import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Leaf, Store } from "lucide-react";
import { getCurrentUser } from "@/lib/session";
import { sellerUrl } from "@/lib/panelUrl";
import SellerLoginForm from "@/components/seller/SellerLoginForm";
import ZuponaMark from "@/components/brand/ZuponaMark";

export const metadata: Metadata = {
  title: "Seller sign in",
  // A sign-in form has nothing to offer a search result.
  robots: { index: false, follow: false },
};

export default async function SellerLoginPage() {
  // Anyone already carrying a session skips the form. Where they end up is the
  // panel layout's decision -- dashboard, application form or status screen --
  // so this only has to get them through the door.
  const user = await getCurrentUser();
  if (user) redirect(await sellerUrl("/seller"));

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-[#0e3220] via-[#10402a] to-[#071c12] px-4 py-10">
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <span className="absolute -top-24 -left-16 h-72 w-72 rounded-full bg-brand-light/20 blur-3xl" />
        <span className="absolute -bottom-28 -right-20 h-80 w-80 rounded-full bg-brand/20 blur-3xl" />
        <Leaf className="absolute left-8 bottom-10 h-40 w-40 rotate-12 text-white/[0.04]" />
        <Leaf className="absolute right-10 top-12 h-28 w-28 -rotate-45 text-white/[0.04]" />
      </div>

      <div className="relative w-full max-w-[400px]">
        <div className="mb-6 flex flex-col items-center text-center">
          <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-xl shadow-black/30">
            <ZuponaMark className="h-11 w-11" />
          </span>
          <h1 className="text-2xl font-extrabold tracking-wide text-white">ZUPONA</h1>
          <p className="mt-1 text-sm text-white/55">Seller Center</p>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-2xl shadow-black/30">
          <h2 className="text-lg font-bold text-neutral-900">Sign in to your shop</h2>
          <p className="mb-5 mt-1 text-sm text-neutral-500">
            Manage your products, orders and earnings on Zupona.
          </p>

          <SellerLoginForm />

          <p className="mt-5 flex items-start gap-2 rounded-xl bg-neutral-50 px-3.5 py-2.5 text-[11px] leading-relaxed text-neutral-500">
            <Store className="mt-px h-3.5 w-3.5 shrink-0 text-brand" />
            <span>
              Don&apos;t sell on Zupona yet?{" "}
              <Link href="/seller/apply" className="font-semibold text-brand hover:underline">
                Open a shop
              </Link>{" "}
              — it takes a few minutes.
            </span>
          </p>
        </div>

        <p className="mt-5 text-center text-xs text-white/35">
          © {new Date().getFullYear()} Zupona · All rights reserved
        </p>
      </div>
    </div>
  );
}
