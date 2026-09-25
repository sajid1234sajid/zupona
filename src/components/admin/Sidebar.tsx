"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ChevronDown, Leaf, LogOut } from "lucide-react";
import { ICONS } from "./icons";
import { NAV_ITEMS, isActive, toAdminPath } from "./nav";
import { logOutAdminAction } from "@/app/admin/actions";
import ZuponaMark from "@/components/brand/ZuponaMark";

interface SidebarProps {
  /** Closes the mobile drawer after a navigation. Absent on the desktop rail. */
  onNavigate?: () => void;
}

/** The dark green navigation rail.
 *
 * Groups with children (Products) expand in place. The open group is derived
 * from the current path on every render rather than only on mount, so
 * navigating from a link elsewhere on the page still opens the right group. */
export default function Sidebar({ onNavigate }: SidebarProps) {
  const pathname = usePathname();

  // Which group the current route belongs to. Derived every render rather than
  // synced in an effect, so arriving on /admin/products from anywhere -- a
  // link, the back button -- already has Products open.
  const routeGroup =
    NAV_ITEMS.find((item) => item.children && isActive(pathname, item.href))?.label ?? null;

  // A manual open/close only applies to the route it was made on; navigating
  // hands control back to the route. Storing the path alongside the choice
  // expires it without an effect.
  const [override, setOverride] = useState<{ path: string; label: string | null } | null>(null);
  const openGroup = override?.path === pathname ? override.label : routeGroup;

  const setOpenGroup = (label: string | null) => setOverride({ path: pathname, label });

  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-gradient-to-b from-[#0e3220] via-[#10402a] to-[#0b2a1b] text-white">
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <Leaf className="absolute -left-6 bottom-24 h-40 w-40 rotate-[18deg] text-brand-light/10" />
        <Leaf className="absolute -left-2 bottom-4 h-24 w-24 -rotate-12 text-brand-light/[0.07]" />
        <span className="absolute -top-20 -right-16 h-48 w-48 rounded-full bg-brand-light/10 blur-3xl" />
      </div>

      <Link
        href="/admin"
        onClick={onNavigate}
        className="relative flex items-center gap-3 px-5 py-6"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white shadow-lg shadow-black/20">
          <ZuponaMark className="h-8 w-8" />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-lg font-extrabold tracking-wide">ZUPONA</span>
          <span className="block truncate text-[11px] font-medium text-white/55">Admin Panel</span>
        </span>
      </Link>

      <nav className="no-scrollbar relative flex-1 space-y-1 overflow-y-auto px-3 pb-4">
        {NAV_ITEMS.map((item) => {
          const Icon = ICONS[item.icon];
          const active = isActive(pathname, item.href);
          const expanded = openGroup === item.label;

          if (!item.children) {
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
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
          }

          return (
            <div key={item.href}>
              <button
                type="button"
                onClick={() => setOpenGroup(expanded ? null : item.label)}
                aria-expanded={expanded}
                className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition ${
                  active
                    ? "bg-brand text-white shadow-lg shadow-black/20"
                    : "text-white/70 hover:bg-white/10 hover:text-white"
                }`}
              >
                {Icon ? <Icon className="h-[18px] w-[18px] shrink-0" /> : null}
                <span className="flex-1 truncate text-left">{item.label}</span>
                <ChevronDown
                  className={`h-4 w-4 shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`}
                />
              </button>

              {expanded ? (
                <div className="mt-1 space-y-0.5 pl-4">
                  {item.children.map((child) => {
                    const childActive = toAdminPath(pathname) === child.href;
                    return (
                      <Link
                        key={child.href}
                        href={child.href}
                        onClick={onNavigate}
                        aria-current={childActive ? "page" : undefined}
                        className={`flex items-center gap-2.5 rounded-lg px-3.5 py-2 text-[13px] transition ${
                          childActive
                            ? "font-semibold text-brand-light"
                            : "text-white/55 hover:text-white"
                        }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                            childActive ? "bg-brand-light" : "bg-white/25"
                          }`}
                        />
                        <span className="truncate">{child.label}</span>
                      </Link>
                    );
                  })}
                </div>
              ) : null}
            </div>
          );
        })}
      </nav>

      <form action={logOutAdminAction} className="relative border-t border-white/10 p-3">
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
}
