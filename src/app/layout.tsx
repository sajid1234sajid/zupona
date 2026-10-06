import type { Metadata, Viewport } from "next";
import { Poppins } from "next/font/google";
import ServiceWorkerRegistration from "@/components/app/ServiceWorkerRegistration";
import MetaPixel from "@/components/analytics/MetaPixel";
import { getShopSettings } from "@/lib/shopSettings";
import { SITE_URL, shareMetadata } from "@/lib/shareCard";
import "./globals.css";

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

/* The display serif that used to be loaded here is gone. `--font-serif` in
 * globals.css is a system stack now; the note there says why. */

/** `manifest` is what makes the shop installable.
 *
 * On a phone it turns zupona.com into a home-screen app, and the Android APK
 * built by `.github/workflows/android-apk.yml` is a wrapper around this same
 * manifest -- its name, colours and icons all come from here, so the installed
 * app and the site can never describe themselves differently.
 *
 * `metadataBase` and the share card are what a link preview is built from --
 * see `src/lib/shareCard.ts` for why every page must name its own picture.
 * No `url` here: a page inheriting it would tell Facebook it *is* the home
 * page, and every shared link would preview as the home page. */
const SITE_TITLE = "Zupona — Trusted Online Shop";
const SITE_DESCRIPTION =
  "Zupona | Bangladesh's trusted online shopping platform for fashion, electronics, beauty and more.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  ...shareMetadata({ title: SITE_TITLE, description: SITE_DESCRIPTION }),
  applicationName: "Zupona",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Zupona", statusBarStyle: "default" },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon-192.png", type: "image/png", sizes: "192x192" },
      { url: "/icon-512.png", type: "image/png", sizes: "512x512" },
    ],
    apple: "/apple-touch-icon.png",
  },
};

/** The shop is designed mobile-first and must scale from a 320px phone up.
 *
 * `viewportFit: "cover"` lets the layout reach under the iOS home indicator,
 * which is why the tab bar pads itself with `env(safe-area-inset-bottom)`.
 * The theme colour is the brand green, so the browser chrome matches. */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#037e5b",
};

/* The pixel id is read here rather than on each page because a page view is
 * a thing every page has. It comes from the settings read the storefront
 * already makes, which is served from KV at the edge, and the layout renders
 * alongside the page rather than before it, so the wait is not added to the
 * page's own. An unconfigured shop renders nothing at all: no component, no
 * stub, no script.
 *
 * The read cannot be allowed to fail the render. This is the root layout, so
 * whatever it throws takes down every page on the storefront -- including
 * `/offline`, which is the one page that exists precisely for when things are
 * unreachable. A settings read that fails costs the shop its pixel until the
 * next request; it must never cost the shop its pages. */
export default async function RootLayout({ children }: LayoutProps<"/">) {
  let facebookPixelId: string | null = null;
  try {
    ({ facebookPixelId } = await getShopSettings());
  } catch (error) {
    console.error("shop settings unreadable in root layout", error);
  }

  return (
    <html
      lang="en"
      className={`${poppins.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-white">
        {children}
        <ServiceWorkerRegistration />
        {facebookPixelId ? <MetaPixel pixelId={facebookPixelId} /> : null}
      </body>
    </html>
  );
}
