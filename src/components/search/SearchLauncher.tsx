"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Search } from "lucide-react";

/** The sheet is fetched the first time search is tapped, not with the page.
 *
 * Measured on the built worker: imported normally it added about 4 KB of
 * JavaScript and five requests to every page that carries a header, for a
 * panel most visits never open. Loaded this way the page pays for the button
 * alone -- whose icon those pages already had -- and the sheet arrives with
 * the tap. `ssr: false` because it can only render in a browser: it portals
 * itself into `document.body`. */
const SearchSheet = dynamic(() => import("./SearchSheet"), { ssr: false });

/** The control that opens the search sheet, in the three shapes the headers
 * need: a bare icon on the product/cart/category header, the wide pill on the
 * account header, and the laptop header's full-width field.
 *
 * Before this, each of those was either a button with no handler or a link to
 * the home page -- a search that either did nothing or threw the shopper back
 * to another page to start again. They all open the same sheet now.
 *
 * The sheet is only put into the page once search has actually been asked for,
 * and stays from then on so opening it again is instant. A visit that never
 * taps search renders none of its markup and makes no request. */
export default function SearchLauncher({
  variant = "icon",
}: {
  variant?: "icon" | "pill" | "wide";
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  function launch() {
    setMounted(true);
    setOpen(true);
  }

  const common = {
    type: "button" as const,
    onClick: launch,
    "aria-haspopup": "dialog" as const,
    "aria-expanded": open,
  };

  return (
    <>
      {variant === "icon" && (
        <button
          {...common}
          aria-label="Search products"
          className="grid h-9 w-9 place-items-center rounded-full text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          <Search className="h-5 w-5" strokeWidth={2.1} />
        </button>
      )}

      {variant === "pill" && (
        <button
          {...common}
          aria-label="Search products"
          // Fluid: this is what gives way first when the viewport narrows.
          className="flex h-10 min-w-0 flex-1 items-center gap-1.5 rounded-full bg-brand-mist px-3 text-left text-ink-muted ring-1 ring-brand-tint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          <Search className="h-4 w-4 shrink-0" strokeWidth={2.25} />
          <span className="truncate text-[11px]">Search products</span>
        </button>
      )}

      {variant === "wide" && (
        <button
          {...common}
          aria-label="Search products"
          className="flex h-11 w-full min-w-0 items-center gap-2 rounded-full bg-brand-mist px-4 text-left text-sm text-ink-faint ring-1 ring-line transition-colors hover:ring-brand/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          <Search className="h-4 w-4 shrink-0 text-ink-muted" strokeWidth={2.25} />
          <span className="truncate">Search for products, brands and more...</span>
        </button>
      )}

      {mounted && <SearchSheet open={open} onClose={() => setOpen(false)} />}
    </>
  );
}
