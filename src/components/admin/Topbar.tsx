"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Bell, ChevronDown, Menu, Search, Store, User } from "lucide-react";
import { logOutAdminAction } from "@/app/admin/actions";

export interface AlertItem {
  label: string;
  detail: string;
  href: string;
}

interface TopbarProps {
  adminName: string;
  adminEmail: string | null;
  avatarUrl: string | null;
  alerts: AlertItem[];
  storefrontUrl: string;
  onOpenMenu: () => void;
}

/** Closes a popover when the pointer or Escape lands outside it. Both menus in
 * this bar behave the same way, so the behaviour lives in one hook. */
function useDismissable(onDismiss: () => void) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) onDismiss();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onDismiss();
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [onDismiss]);

  return ref;
}

export default function Topbar({
  adminName,
  adminEmail,
  avatarUrl,
  alerts,
  storefrontUrl,
  onOpenMenu,
}: TopbarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [openMenu, setOpenMenu] = useState<"alerts" | "account" | null>(null);

  const popoverRef = useDismissable(() => setOpenMenu(null));

  return (
    <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-black/[0.06] bg-white/95 px-4 py-3 backdrop-blur lg:px-6">
      <button
        type="button"
        onClick={onOpenMenu}
        aria-label="Open navigation"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-neutral-600 transition hover:bg-neutral-100 lg:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>

      <form
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          const term = query.trim();
          router.push(term ? `/admin/search?q=${encodeURIComponent(term)}` : "/admin/search");
        }}
        className="relative min-w-0 flex-1"
      >
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
        <input
          type="search"
          name="q"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search anything (orders, products, customers…)"
          aria-label="Search the admin panel"
          className="h-10 w-full rounded-full border border-neutral-200 bg-neutral-50 pl-10 pr-4 text-sm text-neutral-800 outline-none transition placeholder:text-neutral-400 focus:border-brand focus:bg-white focus:ring-2 focus:ring-brand/15"
        />
      </form>

      <div ref={popoverRef} className="relative flex shrink-0 items-center gap-1.5">
        <a
          href={`${storefrontUrl}/`}
          title="Open the storefront"
          className="hidden h-10 w-10 items-center justify-center rounded-xl text-neutral-600 transition hover:bg-neutral-100 sm:flex"
        >
          <Store className="h-[18px] w-[18px]" />
        </a>

        <button
          type="button"
          onClick={() => setOpenMenu(openMenu === "alerts" ? null : "alerts")}
          aria-label={`Notifications${alerts.length ? ` (${alerts.length} needing attention)` : ""}`}
          aria-expanded={openMenu === "alerts"}
          className="relative flex h-10 w-10 items-center justify-center rounded-xl text-neutral-600 transition hover:bg-neutral-100"
        >
          <Bell className="h-[18px] w-[18px]" />
          {alerts.length > 0 ? (
            <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent-red px-1 text-[10px] font-bold text-white">
              {alerts.length}
            </span>
          ) : null}
        </button>

        <button
          type="button"
          onClick={() => setOpenMenu(openMenu === "account" ? null : "account")}
          aria-expanded={openMenu === "account"}
          className="flex items-center gap-2 rounded-xl py-1 pl-1 pr-2 transition hover:bg-neutral-100"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-tint text-brand-dark">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <User className="h-4 w-4" />
            )}
          </span>
          <span className="hidden text-left sm:block">
            <span className="block max-w-[9rem] truncate text-[13px] font-semibold leading-tight text-neutral-800">
              {adminName}
            </span>
            <span className="block text-[11px] leading-tight text-neutral-400">Super Admin</span>
          </span>
          <ChevronDown className="h-4 w-4 text-neutral-400" />
        </button>

        {openMenu === "alerts" ? (
          <div className="absolute right-0 top-12 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-black/[0.06] bg-white shadow-xl shadow-black/10">
            <p className="border-b border-neutral-100 px-4 py-3 text-sm font-semibold text-neutral-800">
              Needs your attention
            </p>
            {alerts.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-neutral-400">
                Nothing waiting. You&apos;re all caught up.
              </p>
            ) : (
              <ul className="max-h-80 overflow-y-auto">
                {alerts.map((alert) => (
                  <li key={alert.href + alert.label}>
                    <Link
                      href={alert.href}
                      onClick={() => setOpenMenu(null)}
                      className="block border-b border-neutral-50 px-4 py-3 transition hover:bg-brand-tint/50"
                    >
                      <span className="block text-sm font-medium text-neutral-800">
                        {alert.label}
                      </span>
                      <span className="block text-xs text-neutral-500">{alert.detail}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}

        {openMenu === "account" ? (
          <div className="absolute right-0 top-12 w-60 overflow-hidden rounded-2xl border border-black/[0.06] bg-white shadow-xl shadow-black/10">
            <div className="border-b border-neutral-100 px-4 py-3">
              <p className="truncate text-sm font-semibold text-neutral-800">{adminName}</p>
              <p className="truncate text-xs text-neutral-500">{adminEmail ?? "Administrator"}</p>
            </div>
            <Link
              href="/admin/settings"
              onClick={() => setOpenMenu(null)}
              className="block px-4 py-2.5 text-sm text-neutral-700 transition hover:bg-neutral-50"
            >
              Store settings
            </Link>
            <a
              href={`${storefrontUrl}/`}
              className="block px-4 py-2.5 text-sm text-neutral-700 transition hover:bg-neutral-50"
            >
              View storefront
            </a>
            <form action={logOutAdminAction} className="border-t border-neutral-100">
              <button
                type="submit"
                className="w-full px-4 py-2.5 text-left text-sm font-medium text-accent-red transition hover:bg-red-50"
              >
                Log out
              </button>
            </form>
          </div>
        ) : null}
      </div>
    </header>
  );
}
