"use client";

/** Re-reads a server-rendered page on a timer, so the activity feed moves on
 * its own while the owner watches it. Paused while the tab is hidden: a feed
 * nobody is looking at is not worth a query every few seconds. */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function LiveRefresh({ seconds = 20 }: { seconds?: number }) {
  const router = useRouter();
  const [on, setOn] = useState(true);

  useEffect(() => {
    if (!on) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, seconds * 1000);
    return () => window.clearInterval(timer);
  }, [on, seconds, router]);

  return (
    <button
      type="button"
      onClick={() => setOn((value) => !value)}
      className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-semibold transition ${
        on
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-neutral-200 bg-white text-neutral-500"
      }`}
      aria-pressed={on}
    >
      <span className={`h-2 w-2 rounded-full ${on ? "animate-pulse bg-emerald-500" : "bg-neutral-300"}`} />
      {on ? "Live" : "Paused"}
    </button>
  );
}
