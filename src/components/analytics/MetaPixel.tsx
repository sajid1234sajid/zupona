"use client";

/** The Meta pixel, loaded so that a shopper never pays for it.
 *
 * Meta's `fbevents.js` is around 70KB of third-party JavaScript, which on a
 * mid-range Android on mobile data is exactly the kind of weight this shop has
 * spent its life removing. So it is split in two:
 *
 *   - The stub goes up immediately. It is the few lines Meta's own snippet
 *     defines: a function that pushes every call into an array. Events fired
 *     before the real script arrives queue there and are replayed the moment
 *     it loads, so nothing is lost by waiting.
 *   - The script itself is fetched only once the page has loaded and the main
 *     thread is idle. By then the shopper has their pictures, their prices and
 *     a tab bar that answers a tap.
 *
 * The panels are excluded. `admin.zupona.com` and `seller.zupona.com` are the
 * same Worker behind the same root layout, and nobody is advertising to their
 * own staff. */

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

type Fbq = ((...args: unknown[]) => void) & {
  callMethod?: (...args: unknown[]) => void;
  queue: unknown[][];
  loaded?: boolean;
  version?: string;
};

declare global {
  interface Window {
    fbq?: Fbq;
    _fbq?: Fbq;
  }
}

const SCRIPT_SRC = "https://connect.facebook.net/en_US/fbevents.js";

/** Idle is waited for, but not forever: a shopper who leaves in four seconds
 * still counts, and a page that never goes idle would otherwise never report. */
const IDLE_TIMEOUT_MS = 2000;

let scriptRequested = false;

/** True on the admin panel and the Seller Center, by host on the real domains
 * and by path in local development where there are no subdomains. */
function isPanel(): boolean {
  const { hostname, pathname } = window.location;
  return (
    hostname.startsWith("admin.") ||
    hostname.startsWith("seller.") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/seller")
  );
}

/** Meta's queueing stub, verbatim in behaviour: calls made now are replayed
 * when the real script attaches itself to the same queue. */
function ensureStub(): Fbq {
  if (window.fbq) return window.fbq;

  const fbq = function (...args: unknown[]) {
    if (fbq.callMethod) fbq.callMethod(...args);
    else fbq.queue.push(args);
  } as Fbq;

  fbq.queue = [];
  fbq.loaded = true;
  fbq.version = "2.0";

  window.fbq = fbq;
  window._fbq = fbq;
  return fbq;
}

function loadScript(): void {
  if (scriptRequested) return;
  scriptRequested = true;

  const script = document.createElement("script");
  script.async = true;
  script.src = SCRIPT_SRC;
  document.head.appendChild(script);
}

/** Fetches the script once the page is done and the thread is free. */
function scheduleLoad(): void {
  const start = () => {
    if (typeof window.requestIdleCallback === "function") {
      window.requestIdleCallback(() => loadScript(), { timeout: IDLE_TIMEOUT_MS });
    } else {
      window.setTimeout(loadScript, 1200);
    }
  };

  if (document.readyState === "complete") start();
  else window.addEventListener("load", start, { once: true });
}

/**
 * Reports one standard event.
 *
 * Safe to call from anywhere in the browser: with no pixel configured, or on a
 * panel, there is no stub and the call is a no-op rather than an error.
 *
 * `eventId` is what lets the same sale arrive twice -- once from here, once
 * from the Worker -- and still be counted once.
 */
export function trackPixel(
  event: string,
  params?: Record<string, unknown>,
  eventId?: string
): void {
  if (typeof window === "undefined" || !window.fbq) return;
  if (eventId) window.fbq("track", event, params ?? {}, { eventID: eventId });
  else window.fbq("track", event, params ?? {});
}

export default function MetaPixel({ pixelId }: { pixelId: string }) {
  const pathname = usePathname();
  const started = useRef(false);

  useEffect(() => {
    if (started.current || isPanel()) return;
    started.current = true;

    const fbq = ensureStub();
    fbq("init", pixelId);
    fbq("track", "PageView");
    scheduleLoad();
  }, [pixelId]);

  /* A shop navigated with the router changes page without reloading, so the
   * script's own automatic PageView fires once and never again. Skipping the
   * first run keeps the initial view from being counted twice. */
  const firstPath = useRef(true);
  useEffect(() => {
    if (firstPath.current) {
      firstPath.current = false;
      return;
    }
    trackPixel("PageView");
  }, [pathname]);

  return null;
}
