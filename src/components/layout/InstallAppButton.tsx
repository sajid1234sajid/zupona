"use client";

import { useState } from "react";
import { Download } from "lucide-react";

/** "Install the app" in the footer.
 *
 * Uses the browser's own installer when it has offered one -- the inline
 * script from `appBannerScript()` keeps that offer on `window.__zuponaInstall`
 * for the phone strip, and the same offer works here on a laptop's Chrome or
 * Edge. Where no installer exists (Safari, Firefox) it says where the browser
 * keeps the option instead of doing nothing. */
export default function InstallAppButton() {
  const [hint, setHint] = useState(false);

  const install = async () => {
    const prompt = window.__zuponaInstall;
    if (!prompt) {
      setHint(true);
      return;
    }
    window.__zuponaInstall = null;
    await prompt.prompt();
  };

  return (
    <div>
      <button
        type="button"
        onClick={install}
        className="inline-flex items-center gap-2 rounded-full border border-white/70 px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-white hover:text-heading"
      >
        <Download className="h-4 w-4" strokeWidth={2.2} />
        Install the Zupona app
      </button>
      {hint ? (
        <p className="mt-2 max-w-[260px] text-[11.5px] leading-snug text-white/60">
          On a phone: Share or ⋮ menu → Add to Home Screen. On a computer: the install icon at
          the right of the address bar.
        </p>
      ) : null}
    </div>
  );
}
