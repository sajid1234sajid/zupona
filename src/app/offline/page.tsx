import type { Metadata } from "next";
import Link from "next/link";
import { WifiOff, RefreshCw } from "lucide-react";
import ZuponaMark from "@/components/brand/ZuponaMark";

export const metadata: Metadata = {
  title: "You are offline — Zupona",
  description: "Zupona needs a connection to show the shop.",
};

/** What the installed app shows when a page cannot be reached.
 *
 * The service worker caches this page at install time and serves it instead of
 * the browser's own error, which is the difference between an app that looks
 * broken and one that looks like it is waiting. It deliberately loads no data:
 * a page that queries the catalogue could not be rendered from the cache in
 * the one situation it exists for. */
export default function OfflinePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-brand-mist px-6 text-center">
      <ZuponaMark className="h-14 w-14" />

      <div className="mt-8 flex h-16 w-16 items-center justify-center rounded-full bg-brand-tint">
        <WifiOff className="h-8 w-8 text-brand-dark" aria-hidden />
      </div>

      <h1 className="mt-6 text-xl font-bold text-brand-darkest">
        You are offline
      </h1>
      <p className="mt-2 max-w-xs text-sm text-ink-muted">
        Zupona needs a connection to load the shop. Check your mobile data or
        Wi-Fi, then try again.
      </p>

      {/* A plain link rather than a reload button: this page is a client-free
       * server component, and following a link re-runs the request the same
       * way a retry would. */}
      <Link
        href="/"
        className="btn-brand mt-8 inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-white"
      >
        <RefreshCw className="h-4 w-4" aria-hidden />
        Try again
      </Link>
    </div>
  );
}
