"use client";

import { useEffect } from "react";

/** Registers the service worker that gives the installed app its offline page.
 *
 * Mounted from the root layout, which also wraps the admin panel -- the panel
 * is a different origin (admin.zupona.com) and has nothing to gain from an
 * offline page, so it is skipped rather than given a worker of its own.
 *
 * Registration failing is not an error worth showing anyone: the site works
 * exactly as it did before, just without the offline fallback. */
export default function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (window.location.hostname.startsWith("admin.")) return;

    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* No offline page this session. */
      });
    };

    // After load, so registering never competes with the first paint.
    if (document.readyState === "complete") {
      register();
    } else {
      window.addEventListener("load", register, { once: true });
      return () => window.removeEventListener("load", register);
    }
  }, []);

  return null;
}
