"use client";

import { useEffect, useState } from "react";
import { Download, EllipsisVertical, Share, SquarePlus, X } from "lucide-react";
import ZuponaMark from "@/components/brand/ZuponaMark";
import { CLOSED_KEY, INSTALLED_KEY } from "./appBannerScript";

/** The "Get the Zupona app" strip above the header, on phones only.
 *
 * Whether it shows is decided before the first paint by the inline script
 * from `appBannerScript()` (`./appBannerScript.ts`), which the root layout puts right ahead of this
 * component: it sets `data-app-banner` on <html>, and the CSS in globals.css
 * shows `.app-banner` only then, and only below the `tab` breakpoint. Left to
 * React, the strip would arrive after hydration and shove the whole page down
 * by its own height -- the layout shift every phone visitor would feel.
 *
 * Install asks the browser's own installer when it has offered one (Chrome on
 * Android, which `beforeinstallprompt` hands to the script before this file
 * has even hydrated). Where no browser installer exists -- every iPhone, and
 * Android browsers that only add a shortcut -- it opens a sheet with the two
 * taps that do it by hand. */

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

declare global {
  interface Window {
    __zuponaInstall?: InstallPromptEvent | null;
  }
  interface Navigator {
    getInstalledRelatedApps?: () => Promise<unknown[]>;
  }
}

function hide() {
  document.documentElement.removeAttribute("data-app-banner");
}

function remember(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Private mode: the strip simply comes back next visit.
  }
}

function isIos() {
  return (
    /iPhone|iPad|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

export default function AppBanner() {
  const [help, setHelp] = useState<"ios" | "android" | null>(null);

  useEffect(() => {
    const onInstalled = () => {
      remember(INSTALLED_KEY, "1");
      hide();
    };
    window.addEventListener("appinstalled", onInstalled);

    // A shopper who installed the app on another visit, or from another
    // tab, still browses in Chrome now and then. The manifest's
    // `related_applications` lets Chrome say so; when it later says the app
    // is gone, the strip is allowed back.
    navigator
      .getInstalledRelatedApps?.()
      .then((apps) => {
        if (apps.length > 0) onInstalled();
        else remember(INSTALLED_KEY, null);
      })
      .catch(() => {});

    return () => window.removeEventListener("appinstalled", onInstalled);
  }, []);

  const close = () => {
    remember(CLOSED_KEY, String(Date.now()));
    hide();
  };

  const install = async () => {
    const prompt = window.__zuponaInstall;
    if (!prompt) {
      setHelp(isIos() ? "ios" : "android");
      return;
    }
    // A prompt can be shown once; Chrome offers a fresh one if it is declined.
    window.__zuponaInstall = null;
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === "accepted") {
      remember(INSTALLED_KEY, "1");
      hide();
    }
  };

  return (
    <>
      <div
        className="app-banner items-center gap-2.5 border-b border-line bg-white py-2.5 pl-1.5 pr-3"
        role="region"
        aria-label="Get the Zupona app"
      >
        <button
          type="button"
          onClick={close}
          aria-label="Close"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-neutral-400 active:bg-neutral-100"
        >
          <X className="h-[18px] w-[18px]" strokeWidth={2} />
        </button>

        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-brand-tint bg-white shadow-sm">
          <ZuponaMark className="h-8 w-8" />
        </span>

        <span className="min-w-0 flex-1 leading-tight">
          <span className="block truncate text-[14px] font-bold text-brand-darkest">
            Zupona: Trusted Online Shop
          </span>
          <span className="mt-0.5 block truncate text-[12px] text-neutral-500">
            Shop faster with the Zupona app
          </span>
        </span>

        <button
          type="button"
          onClick={install}
          className="shrink-0 rounded-full bg-brand px-4 py-2 text-[13px] font-bold text-white active:bg-brand-dark"
        >
          Install
        </button>
      </div>

      {help && <InstallHelp platform={help} onClose={() => setHelp(null)} />}
    </>
  );
}

/** The by-hand steps, for a browser that has no installer to call. */
function InstallHelp({
  platform,
  onClose,
}: {
  platform: "ios" | "android";
  onClose: () => void;
}) {
  const steps =
    platform === "ios"
      ? [
          { icon: Share, text: "Tap the Share button in Safari's toolbar" },
          { icon: SquarePlus, text: "Choose “Add to Home Screen”, then Add" },
        ]
      : [
          { icon: EllipsisVertical, text: "Tap the browser's ⋮ menu" },
          { icon: Download, text: "Choose “Install app” or “Add to Home screen”" },
        ];

  return (
    <div
      className="fixed inset-0 z-[130] flex items-end bg-black/40 tab:hidden"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Install Zupona"
    >
      <div
        className="w-full rounded-t-2xl bg-white px-5 pb-[calc(20px+env(safe-area-inset-bottom))] pt-5"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-brand-tint">
            <ZuponaMark className="h-8 w-8" />
          </span>
          <p className="flex-1 text-[16px] font-bold text-brand-darkest">
            Add Zupona to your home screen
          </p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-8 w-8 place-items-center rounded-full text-neutral-400 active:bg-neutral-100"
          >
            <X className="h-[18px] w-[18px]" />
          </button>
        </div>

        <ol className="mt-4 space-y-3">
          {steps.map(({ icon: Icon, text }, index) => (
            <li key={text} className="flex items-center gap-3 text-[14px] text-neutral-700">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand-tint text-[13px] font-bold text-brand-darkest">
                {index + 1}
              </span>
              <Icon className="h-5 w-5 shrink-0 text-brand" />
              <span>{text}</span>
            </li>
          ))}
        </ol>

        <button
          type="button"
          onClick={onClose}
          className="mt-5 w-full rounded-full bg-brand py-3 text-[14px] font-bold text-white"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
