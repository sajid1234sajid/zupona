"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import Sidebar from "./Sidebar";
import Topbar, { type AlertItem } from "./Topbar";

interface AdminShellProps {
  adminName: string;
  adminEmail: string | null;
  avatarUrl: string | null;
  alerts: AlertItem[];
  /** Absolute origin of the shop, empty when links can stay relative. */
  storefrontUrl: string;
  children: ReactNode;
}

/** The persistent frame: a fixed rail on desktop, a slide-over drawer below
 * `lg`. The drawer closes on navigation so a tap on a link never leaves it
 * covering the page it just opened. */
export default function AdminShell({
  adminName,
  adminEmail,
  avatarUrl,
  alerts,
  storefrontUrl,
  children,
}: AdminShellProps) {
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

  return (
    <div className="flex min-h-screen w-full bg-[#f1f5f3]">
      <aside className="fixed inset-y-0 left-0 hidden w-[248px] shrink-0 lg:block">
        <Sidebar />
      </aside>

      {drawerOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => setDrawerOpen(false)}
            className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
          />
          <div className="absolute inset-y-0 left-0 w-[260px] max-w-[82vw] shadow-2xl">
            <Sidebar onNavigate={() => setDrawerOpen(false)} />
          </div>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col lg:pl-[248px]">
        <Topbar
          adminName={adminName}
          adminEmail={adminEmail}
          avatarUrl={avatarUrl}
          alerts={alerts}
          storefrontUrl={storefrontUrl}
          onOpenMenu={() => setDrawerOpen(true)}
        />
        <main className="min-w-0 flex-1 px-4 py-5 lg:px-6 lg:py-6">{children}</main>
      </div>
    </div>
  );
}
