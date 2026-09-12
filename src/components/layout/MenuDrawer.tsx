"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import {
  X,
  LayoutGrid,
  Tag,
  Sparkles,
  Heart,
  Package,
  Store,
  LifeBuoy,
  Leaf,
  MapPin,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import BotanicalBackdrop from "@/components/home/BotanicalBackdrop";

interface MenuLink {
  label: string;
  href: string;
  icon: LucideIcon;
}

interface MenuSection {
  title: string;
  links: MenuLink[];
}

/** The whole menu, as data.
 *
 * Static on purpose: the drawer reads nothing from the database and calls
 * nothing on open, so tapping the hamburger paints immediately whatever the
 * network is doing. Counts and badges deliberately stay in the header, which
 * already has them from the server. */
const SECTIONS: MenuSection[] = [
  {
    title: "Explore",
    links: [
      { label: "Categories", href: "/categories", icon: LayoutGrid },
      { label: "Offers", href: "/offers", icon: Tag },
      { label: "New Arrivals", href: "/new-arrivals", icon: Sparkles },
    ],
  },
  {
    title: "My Zupona",
    links: [
      { label: "Wishlist", href: "/wishlist", icon: Heart },
      { label: "Orders", href: "/account/orders", icon: Package },
    ],
  },
  {
    title: "More",
    links: [
      // No seller onboarding page exists yet, and the account page already
      // sends shoppers to this address, so both of these go to the one
      // support inbox rather than to a route that would 404.
      {
        label: "Sell on Zupona",
        href: "mailto:support@zupona.shop?subject=Selling%20on%20Zupona",
        icon: Store,
      },
      { label: "Help", href: "mailto:support@zupona.shop", icon: LifeBuoy },
    ],
  },
];

/** Anything that can hold focus inside the panel, for the tab loop. */
const FOCUSABLE = "a[href], button:not([disabled])";

/** The navigation drawer behind the header's hamburger.
 *
 * Rendered only once the shopper has opened the menu for the first time --
 * the header mounts it on demand -- so a session that never taps the
 * hamburger pays nothing for it beyond the component in the bundle. It then
 * stays mounted, which is what lets it slide out again rather than vanish.
 *
 * `open` is the parent's intent; `shown` is that intent once the panel has
 * been painted once, which is what the transition animates between. Without
 * that first frame the panel would mount already-open and simply appear. */
export default function MenuDrawer({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [ready, setReady] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  // The panel is mounted already open, so painting it once in its closed
  // position is what gives the transition somewhere to travel from. One frame,
  // once per session; every later open and close follows `open` directly.
  useEffect(() => {
    const frame = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  const shown = open && ready;

  // A drawer over a page that still scrolls underneath feels broken on a
  // phone, so the body is pinned while the menu is up and released after.
  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    returnFocusRef.current = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      // Back to the hamburger, so a keyboard user carries on where they were.
      returnFocusRef.current?.focus();
    };
  }, [open]);

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === "Escape") {
      onClose();
      return;
    }
    if (event.key !== "Tab") return;

    // Keep tabbing inside the dialog: without this the focus ring walks off
    // into the page behind the backdrop, which cannot be seen or clicked.
    const items = Array.from(
      panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []
    );
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  // Portalled to the body because the header that owns this state is a
  // sticky, z-indexed element: left inside it, the drawer would be trapped in
  // the header's stacking context and the bottom tab bar would paint on top
  // of it.
  return createPortal(
    <div
      className={`fixed inset-0 z-50 ${shown ? "" : "pointer-events-none"}`}
      aria-hidden={open ? undefined : true}
      onKeyDown={onKeyDown}
    >
      {/* Dimmed rather than blurred: a backdrop-filter over a full-page
          product grid costs a repaint on every frame of the slide, and on a
          mid-range phone that is exactly where the animation stutters. */}
      <button
        type="button"
        tabIndex={-1}
        // Hidden from assistive tech: it would otherwise read as a second
        // "Close menu" button beside the real one. Escape and the X do the
        // same job for anyone not tapping the dimmed page.
        aria-hidden="true"
        onClick={onClose}
        className={`absolute inset-0 h-full w-full bg-brand-darkest/50 transition-opacity duration-200 ease-out motion-reduce:transition-none ${
          shown ? "opacity-100" : "opacity-0"
        }`}
      />

      {/* Centred in a max-w-md column like the tab bar, so on a desktop the
          drawer slides out of the app's own left edge instead of the far side
          of a wide screen. */}
      <div className="pointer-events-none absolute inset-0 mx-auto max-w-md">
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-label="Zupona menu"
          className={`pointer-events-auto flex h-full w-[82%] max-w-[300px] flex-col overflow-y-auto overscroll-contain rounded-r-3xl bg-white shadow-[0_0_40px_rgba(0,60,40,0.28)] transition-transform duration-200 ease-out will-change-transform motion-reduce:transition-none ${
            shown ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="relative overflow-hidden bg-gradient-to-br from-brand-dark to-brand px-4 pb-4 pt-[calc(env(safe-area-inset-top)+1rem)] text-white">
            <BotanicalBackdrop
              className="pointer-events-none absolute inset-0 h-full w-full"
              tone="#ffffff"
              opacity={0.15}
              blossoms={false}
            />

            <div className="relative flex items-start justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white/15 ring-1 ring-white/25">
                  <Leaf className="h-[19px] w-[19px]" strokeWidth={2.25} />
                </span>
                <span className="min-w-0 leading-tight">
                  <span className="block text-[15px] font-extrabold tracking-tight">
                    Zupona Menu
                  </span>
                  <span className="mt-0.5 block text-[9.5px] font-medium text-white/70">
                    Trusted Online Shop
                  </span>
                </span>
              </div>

              <button
                ref={closeRef}
                type="button"
                onClick={onClose}
                aria-label="Close menu"
                className="-mr-1 -mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-full text-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                <X className="h-[18px] w-[18px]" strokeWidth={2.25} />
              </button>
            </div>
          </div>

          <nav aria-label="Zupona menu" className="flex-1 px-3 pb-4 pt-3">
            {SECTIONS.map((section, index) => (
              <div key={section.title} className={index > 0 ? "mt-4" : undefined}>
                <h2 className="px-2 pb-1.5 text-[9.5px] font-bold uppercase tracking-[0.14em] text-ink-muted">
                  {section.title}
                </h2>

                <ul>
                  {section.links.map(({ label, href, icon: Icon }) => (
                    <li key={label}>
                      <Link
                        href={href}
                        onClick={onClose}
                        className="flex min-h-11 items-center gap-3 rounded-2xl px-2 py-2 text-[13px] font-semibold text-brand-darkest transition-colors duration-150 hover:bg-brand-mist focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand active:bg-brand-tint motion-reduce:transition-none"
                      >
                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-brand-tint text-brand">
                          <Icon className="h-[15px] w-[15px]" strokeWidth={2.25} />
                        </span>
                        {label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>

          {/* The list is short by design, which leaves the foot of the panel
              bare. One muted line closes it off without adding anything to
              tap. */}
          <div className="flex items-center gap-1.5 border-t border-brand-tint px-5 py-3.5 pb-[calc(env(safe-area-inset-bottom)+0.875rem)] text-[9.5px] font-medium text-ink-muted">
            <MapPin className="h-3 w-3 shrink-0" strokeWidth={2.25} />
            Delivering across Bangladesh
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
