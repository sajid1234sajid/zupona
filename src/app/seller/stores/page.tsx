import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ArrowRight, Leaf, Store } from "lucide-react";
import { getCurrentUser } from "@/lib/session";
import { listSellers } from "@/lib/sellers";
import { sellerUrl, storefrontOrigin } from "@/lib/panelUrl";
import { formatDate } from "@/lib/format";
import { StatusPill } from "@/components/admin/ui";
import { logOutSellerAction, viewStoreAction } from "@/app/seller/actions";
import ZuponaMark from "@/components/brand/ZuponaMark";

export const metadata: Metadata = {
  title: "Choose a store",
  robots: { index: false, follow: false },
};

/** The admin's way into the Seller Center.
 *
 * A seller never sees this: they have one store and the panel opens straight
 * onto it. An admin owns none, so this is where they pick whose shop to work
 * on -- which is what makes the Seller Center usable for support, since the
 * fastest way to understand a merchant's problem is to stand where they do.
 *
 * Every store is listed, including ones still waiting on a decision: an
 * application nobody can open yet is exactly the one an admin is most often
 * asked about. */
export default async function SellerStorePickerPage() {
  const user = await getCurrentUser();
  if (!user) redirect(await sellerUrl("/seller/login"));

  // A seller reaching this URL is simply sent back to their own shop; there is
  // nothing here for them to choose between.
  if (user.role !== "admin") redirect(await sellerUrl("/seller"));

  const [stores, storefront] = await Promise.all([listSellers(undefined, 100), storefrontOrigin()]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-[#0e3220] via-[#10402a] to-[#071c12] px-4 py-10">
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <span className="absolute -top-24 -left-16 h-72 w-72 rounded-full bg-brand-light/20 blur-3xl" />
        <Leaf className="absolute right-10 top-12 h-28 w-28 -rotate-45 text-white/[0.04]" />
      </div>

      <div className="relative mx-auto w-full max-w-[620px]">
        <div className="mb-6 flex flex-col items-center text-center">
          <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-xl shadow-black/30">
            <ZuponaMark className="h-11 w-11" />
          </span>
          <h1 className="text-2xl font-extrabold tracking-wide text-white">ZUPONA</h1>
          <p className="mt-1 text-sm text-white/55">Seller Center · signed in as admin</p>
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-2xl shadow-black/30 lg:p-6">
          <h2 className="text-lg font-bold text-neutral-900">Choose a store to work on</h2>
          <p className="mb-5 mt-1 text-sm text-neutral-500">
            You will see the Seller Center exactly as that shop&apos;s owner sees it.
          </p>

          {stores.length === 0 ? (
            <div className="rounded-xl bg-neutral-50 px-4 py-10 text-center">
              <Store className="mx-auto h-6 w-6 text-neutral-300" />
              <p className="mt-2.5 text-sm font-semibold text-neutral-700">No stores yet</p>
              <p className="mt-1 text-sm text-neutral-400">
                Shops appear here once someone applies through{" "}
                <span className="font-mono text-[13px]">/sell</span>.
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {stores.map((store) => (
                <li key={store.id}>
                  <form action={viewStoreAction}>
                    <input type="hidden" name="sellerId" value={store.id} />
                    <button
                      type="submit"
                      className="flex w-full items-center gap-3 rounded-xl border border-neutral-200 px-4 py-3 text-left transition hover:border-brand hover:bg-brand/[0.03]"
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/10">
                        <Store className="h-[18px] w-[18px] text-brand" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="truncate text-sm font-semibold text-neutral-800">
                            {store.storeName}
                          </span>
                          <StatusPill status={store.status} />
                        </span>
                        <span className="mt-0.5 block truncate text-[11px] text-neutral-400">
                          /{store.slug} · applied {formatDate(store.createdAt)} ·{" "}
                          {store.commissionRate}% commission
                        </span>
                      </span>
                      <ArrowRight className="h-4 w-4 shrink-0 text-neutral-300" />
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-5 flex items-center justify-between gap-3 border-t border-neutral-100 pt-4">
            <a
              href={`${storefront}/admin/distributors`}
              className="text-[13px] font-semibold text-brand hover:underline"
            >
              Approve or reject in the admin panel
            </a>
            <form action={logOutSellerAction}>
              <button
                type="submit"
                className="text-[13px] font-semibold text-neutral-400 transition hover:text-neutral-700"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
