"use client";

import { useState } from "react";
import { Check, Share2 } from "lucide-react";

/** Share, using whatever the device actually has.
 *
 * `navigator.share` opens the phone's own sheet, which is what a shopper
 * expects and the only way to reach WhatsApp from a browser. Where it does not
 * exist -- most desktops -- the link is copied instead and a toast says so.
 * Both can fail (an insecure origin, a denied permission, a cancelled sheet),
 * and none of those is an error worth showing: a cancelled share is a shopper
 * changing their mind. */
export default function ShareButton({ title }: { title: string }) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = window.location.href;

    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ title, text: `Check out ${title} on Zupona`, url });
        return;
      }
      await navigator.clipboard?.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Cancelled, or the clipboard was refused. Nothing to report.
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={share}
        aria-label={`Share ${title}`}
        className="grid h-10 w-10 place-items-center rounded-full bg-white text-heading shadow-md transition hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
      >
        <Share2 className="h-[18px] w-[18px]" />
      </button>

      {copied && (
        <div
          role="status"
          className="fixed bottom-36 left-1/2 z-[120] flex -translate-x-1/2 items-center gap-2 rounded-full bg-brand-darkest/95 px-4 py-2.5 text-xs font-bold text-white shadow-lg"
        >
          Link copied
          <Check className="h-4 w-4" />
        </div>
      )}
    </>
  );
}
