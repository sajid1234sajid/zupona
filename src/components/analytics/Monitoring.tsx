"use client";

/** Two quiet reporters for the storefront:
 *
 *  - Speed. One page view in four measures its Core Web Vitals with the
 *    browser's own PerformanceObserver (no library) and sends them once, as
 *    the page is hidden, to /api/vitals. Admin > Reports > Speed reads them.
 *  - Errors. With error reporting switched on in Settings, uncaught errors and
 *    rejected promises go to /api/report-error, which forwards them to Sentry.
 *
 * Neither runs on the admin panel or the Seller Center. */

import { useEffect } from "react";

const SAMPLE_RATE = 0.25;

function pageKind(path: string): string {
  if (path === "/") return "home";
  if (path.startsWith("/products/") || path.startsWith("/product/")) return "product";
  if (path.startsWith("/category") || path.startsWith("/categories") || path.startsWith("/best-sellers") || path.startsWith("/new-arrivals")) return "category";
  if (path.startsWith("/search")) return "search";
  if (path.startsWith("/cart")) return "cart";
  if (path.startsWith("/checkout")) return "checkout";
  if (path.startsWith("/offers")) return "offers";
  if (path.startsWith("/account") || path.startsWith("/wishlist")) return "account";
  return "other";
}

function isPanel(): boolean {
  const { hostname, pathname } = window.location;
  return hostname.startsWith("admin.") || hostname.startsWith("seller.") || pathname.startsWith("/admin") || pathname.startsWith("/seller");
}

function observe(type: string, callback: (entries: PerformanceEntryList) => void, extra: Record<string, unknown> = {}) {
  try {
    const observer = new PerformanceObserver((list) => callback(list.getEntries()));
    observer.observe({ type, buffered: true, ...extra } as PerformanceObserverInit);
    return observer;
  } catch {
    return null;
  }
}

function measureVitals() {
  const metrics: Record<string, number> = {};
  observe("paint", (entries) => {
    for (const entry of entries) if (entry.name === "first-contentful-paint") metrics.FCP = entry.startTime;
  });
  observe("largest-contentful-paint", (entries) => {
    const last = entries[entries.length - 1];
    if (last) metrics.LCP = last.startTime;
  });
  // CLS: the worst burst of shifts (gaps under 1s, at most 5s long), as the metric defines it.
  let session = 0;
  let sessionStart = 0;
  let previous = 0;
  observe("layout-shift", (entries) => {
    for (const entry of entries as (PerformanceEntry & { value: number; hadRecentInput: boolean })[]) {
      if (entry.hadRecentInput) continue;
      if (session && (entry.startTime - previous > 1000 || entry.startTime - sessionStart > 5000)) session = 0;
      if (!session) sessionStart = entry.startTime;
      session += entry.value;
      previous = entry.startTime;
      metrics.CLS = Math.max(metrics.CLS ?? 0, session);
    }
  });
  // INP, approximately: the slowest interaction seen.
  observe(
    "event",
    (entries) => {
      for (const entry of entries as (PerformanceEntry & { interactionId?: number })[]) {
        if (entry.interactionId) metrics.INP = Math.max(metrics.INP ?? 0, entry.duration);
      }
    },
    { durationThreshold: 40 }
  );
  const navigation = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
  if (navigation) metrics.TTFB = navigation.responseStart;

  let sent = false;
  const send = () => {
    if (sent || document.visibilityState !== "hidden") return;
    sent = true;
    const payload = JSON.stringify({
      page: pageKind(window.location.pathname),
      device: window.matchMedia("(min-width: 700px)").matches ? "desktop" : "mobile",
      metrics,
    });
    navigator.sendBeacon?.("/api/vitals", new Blob([payload], { type: "application/json" }));
    window.gtag?.("event", "web_vitals", { ...metrics, page_kind: pageKind(window.location.pathname) });
  };
  document.addEventListener("visibilitychange", send);
}

function reportErrors() {
  let sent = 0;
  const report = (message: string, type: string, stack?: string) => {
    // A page stuck in a loop reports a handful, not thousands.
    if (sent >= 5 || !message) return;
    sent += 1;
    navigator.sendBeacon?.(
      "/api/report-error",
      new Blob([JSON.stringify({ message, type, stack, url: window.location.href })], { type: "application/json" })
    );
  };
  window.addEventListener("error", (event) => {
    const error = event.error as Error | undefined;
    // Errors from other sites' scripts arrive as a bare "Script error." with nothing to act on.
    if (!error && event.message === "Script error.") return;
    report(error?.message ?? event.message, error?.name ?? "Error", error?.stack);
  });
  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason as Error | string | undefined;
    report(typeof reason === "string" ? reason : (reason?.message ?? "Unhandled rejection"), "UnhandledRejection", typeof reason === "string" ? undefined : reason?.stack);
  });
}

export default function Monitoring({ reportErrors: errorsOn }: { reportErrors: boolean }) {
  useEffect(() => {
    if (isPanel()) return;
    if (errorsOn) reportErrors();
    if (typeof PerformanceObserver !== "undefined" && Math.random() < SAMPLE_RATE) measureVitals();
  }, [errorsOn]);
  return null;
}
