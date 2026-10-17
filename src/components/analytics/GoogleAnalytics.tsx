"use client";

/** Google Analytics 4, loaded the way the Meta pixel is: a queue now, the
 * script only once the page has loaded and the thread is idle, so it costs
 * the shopper nothing they can feel. Off on the admin panel and Seller Center.
 * Shop events reach it through `trackPixel`, which sends each one to both. */

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

function isPanel(): boolean {
  const { hostname, pathname } = window.location;
  return hostname.startsWith("admin.") || hostname.startsWith("seller.") || pathname.startsWith("/admin") || pathname.startsWith("/seller");
}

export default function GoogleAnalytics({ measurementId }: { measurementId: string }) {
  const pathname = usePathname();
  const started = useRef(false);
  const firstPath = useRef(true);

  useEffect(() => {
    if (started.current || isPanel()) return;
    started.current = true;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function gtag() {
      // gtag.js reads the arguments object itself, not an array.
      // eslint-disable-next-line prefer-rest-params
      window.dataLayer!.push(arguments);
    };
    window.gtag("js", new Date());
    window.gtag("config", measurementId, { send_page_view: true });

    const load = () => {
      const script = document.createElement("script");
      script.async = true;
      script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
      document.head.appendChild(script);
    };
    const start = () =>
      typeof window.requestIdleCallback === "function"
        ? window.requestIdleCallback(load, { timeout: 2000 })
        : window.setTimeout(load, 1200);
    if (document.readyState === "complete") start();
    else window.addEventListener("load", start, { once: true });
  }, [measurementId]);

  // In-app navigations are page views too; the first one is sent by config.
  useEffect(() => {
    if (firstPath.current) {
      firstPath.current = false;
      return;
    }
    window.gtag?.("event", "page_view", { page_path: pathname });
  }, [pathname]);

  return null;
}
