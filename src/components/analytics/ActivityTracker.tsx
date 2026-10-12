"use client";

/** Tells the shop which pages a shopper sees, for Admin -> Activity.
 *
 * Built to cost nothing a shopper could notice: no library, no state, nothing
 * drawn, and the report itself waits for an idle main thread and goes out as a
 * beacon the page never waits on. Adds to the cart and orders are not sent
 * from here at all -- the server records those as it does them.
 *
 * The `zv` cookie it sets is the visitor's id. It is set at once rather than
 * with the report, because the next tap may be Add to Cart, and that server
 * action reads the same cookie to put the row under the same visitor.
 *
 * The panels share the root layout and are skipped, as the pixel skips them. */

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

const ENDPOINT = "/api/track";
const ONE_YEAR = 60 * 60 * 24 * 365;

function isPanel(): boolean {
  const { hostname, pathname } = window.location;
  return (
    hostname.startsWith("admin.") ||
    hostname.startsWith("seller.") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/seller")
  );
}

function ensureVisitorCookie(): void {
  if (/(?:^|;\s*)zv=/.test(document.cookie)) return;
  const id =
    typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  const secure = window.location.protocol === "https:" ? "; secure" : "";
  document.cookie = `zv=${id}; max-age=${ONE_YEAR}; path=/; samesite=lax${secure}`;
}

/** A reload or a back button is the same visit, not a new arrival. */
function isFreshArrival(): boolean {
  const entry = performance.getEntriesByType?.("navigation")[0] as
    | PerformanceNavigationTiming
    | undefined;
  return !entry || entry.type === "navigate";
}

function send(body: Record<string, unknown>): void {
  const data = JSON.stringify(body);
  const post = () => {
    try {
      // text/plain keeps the beacon a "simple" request with no preflight.
      if (navigator.sendBeacon?.(ENDPOINT, new Blob([data], { type: "text/plain" }))) return;
    } catch {
      // Fall through to fetch.
    }
    fetch(ENDPOINT, { method: "POST", body: data, keepalive: true }).catch(() => {});
  };

  if (typeof window.requestIdleCallback === "function") {
    window.requestIdleCallback(post, { timeout: 3000 });
  } else {
    window.setTimeout(post, 1500);
  }
}

export default function ActivityTracker() {
  const pathname = usePathname();
  const lastSent = useRef<string | null>(null);

  useEffect(() => {
    if (isPanel() || lastSent.current === pathname) return;
    const first = lastSent.current === null;
    lastSent.current = pathname;

    ensureVisitorCookie();

    const body: Record<string, unknown> = { p: pathname };
    // Where the visit came from is read once, on the page it landed on.
    if (first && isFreshArrival()) {
      const query = new URLSearchParams(window.location.search);
      body.e = 1;
      body.r = document.referrer;
      body.us = query.get("utm_source") ?? "";
      body.um = query.get("utm_medium") ?? "";
      body.uc = query.get("utm_campaign") ?? "";
      if (query.has("fbclid")) body.fb = 1;
      if (query.has("gclid")) body.g = 1;
    }
    send(body);
  }, [pathname]);

  return null;
}
