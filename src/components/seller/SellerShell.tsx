"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ExternalLink, Leaf, LogOut, Menu, ShieldCheck } from "lucide-react";
import { ICONS } from "@/components/admin/icons";
import { SELLER_NAV, isSellerSectionActive } from "./nav";
import { logOutSellerAction } from "@/app/seller/actions";
import ZuponaMark from "@/components/brand/ZuponaMark";

interface SellerShellProps {
  storeName: string;
  storeStatus: string;
  ownerName: string;
  /** Absolute origin of the shop, empty when links can stay relative. */
  storefrontUrl: string;
  /** True when a platform admin is working on a shop they do not own. */
  asAdmin: boolean;
  children: ReactNode;
}

/** The Seller Center's frame.
 *
 * Deliberately the same rail, the same green and the same proportions as the
 * admin panel, because they are one product to look at even though they are
 * two audiences. What it leaves out is the admin topbar's global search and
 * alert feed: a seller has one store to look after, and a search across a
 * marketplace they cannot see would only return things they are not allowed
 * to open. */
export default function SellerShell({
  storeName,
  storeStatus,
  ownerName,
  storefrontUrl,
  asAdmin,
  children,
}: SellerShellProps) {
  const pathname = usePathname();

  // The drawer remembers which route it was opened on, so a navigation closes
  // it by making that record stale -- no effect chasing the pathname, and no
  // frame where the drawer still covers the page it just opened.
  const [drawer, setDrawer] = useState({ open: false, path: pathname });
  const drawerOpen = drawer.open && drawer.path === pathname;
  const setDrawerOpen = (open: boolean) => setDrawer({ open, path: pathname });

  // A drawer over a still-scrollable page reads as broken on touch devices.
  useEffect(() => {
    document.body.style.overflow = drawerOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [drawerOpen]);

  const rail = (
    <div className="relative flex h-full flex-col overflow-hidden bg-gradient-to-b from-[#0e3220] via-[#10402a] to-[#0b2a1b] text-white">
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <Leaf className="absolute -left-6 bottom-24 h-40 w-40 rotate-[18deg] text-brand-light/10" />
        <Leaf className="absolute -left-2 bottom-4 h-24 w-24 -rotate-12 text-brand-light/[0.07]" />
        <span className="absolute -top-20 -right-16 h-48 w-48 rounded-full bg-brand-light/10 blur-3xl" />
      </div>

      <Link
        href="/seller"
        onClick={() => setDrawerOpen(false)}
        className="relative flex items-center gap-3 px-5 py-6"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white shadow-lg shadow-black/20">
          <ZuponaMark className="h-8 w-8" />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-lg font-extrabold tracking-wide">ZUPONA</span>
          <span className="block truncate text-[11px] font-medium text-white/55">Seller Center</span>
        </span>
      </Link>

      <nav className="no-scrollbar relative flex-1 space-y-1 overflow-y-auto px-3 pb-4">
        {SELLER_NAV.map((item) => {
          const Icon = ICONS[item.icon];
          const active = isSellerSectionActive(pathname, item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setDrawerOpen(false)}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition ${
                active
                  ? "bg-brand text-white shadow-lg shadow-black/20"
                  : "text-white/70 hover:bg-white/10 hover:text-white"
              }`}
            >
              {Icon ? <Icon className="h-[18px] w-[18px] shrink-0" /> : null}
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <form action={logOutSellerAction} className="relative border-t border-white/10 p-3">
        <button
          type="submit"
          className="flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium text-white/70 transition hover:bg-white/10 hover:text-white"
        >
          <LogOut className="h-[18px] w-[18px] shrink-0" />
          Logout
        </button>
      </form>
    </div>
  );

  return (
    <div className="flex min-h-screen w-full bg-[#f1f5f3]">
      <aside className="fixed inset-y-0 left-0 hidden w-[248px] shrink-0 lg:block">{rail}</aside>

      {drawerOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => setDrawerOpen(false)}
            className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
          />
          <div className="absolute inset-y-0 left-0 w-[260px] max-w-[82vw] shadow-2xl">{rail}</div>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col lg:pl-[248px]">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-neutral-200/70 bg-white/90 px-4 backdrop-blur lg:px-6">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open navigation"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-neutral-500 transition hover:bg-neutral-100 lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-neutral-900">{storeName}</p>
            <p className="truncate text-[11px] text-neutral-500">{ownerName}</p>
          </div>

          <a
            href={`${storefrontUrl}/`}
            target="_blank"
            rel="noreferrer"
            className="flex h-10 shrink-0 items-center gap-2 rounded-xl border border-neutral-200 px-3 text-[13px] font-medium text-neutral-600 transition hover:border-brand/40 hover:text-brand"
          >
            <ExternalLink className="h-4 w-4" />
            <span className="hidden sm:inline">Storefront</span>
          </a>
        </header>

        {asAdmin ? (
          // Deliberately loud, and on every screen rather than only the first.
          // An admin editing a shop they do not own should never be in any
          // doubt about whose data is in front of them.
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-[13px] text-amber-800 lg:px-6">
            <ShieldCheck className="h-4 w-4 shrink-0" />
            <span>
              Viewing <span className="font-semibold">{storeName}</span> as a Zupona admin
              {storeStatus === "approved" ? null : (
                <span className="font-semibold"> · this shop is {storeStatus}</span>
              )}
            </span>
            <Link
              href="/seller/stores"
              className="font-semibold underline underline-offset-2 hover:text-amber-900"
            >
              Switch store
            </Link>
          </div>
        ) : null}

        <main className="min-w-0 flex-1 px-4 py-5 lg:px-6 lg:py-6">{children}</main>
      </div>
    </div>
  );
}
