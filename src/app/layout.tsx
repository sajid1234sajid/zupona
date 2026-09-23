import type { Metadata, Viewport } from "next";
import { Poppins } from "next/font/google";
import ServiceWorkerRegistration from "@/components/app/ServiceWorkerRegistration";
import MetaPixel from "@/components/analytics/MetaPixel";
import { getShopSettings } from "@/lib/shopSettings";
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
 * app and the site can never describe themselves differently. */
export const metadata: Metadata = {
  title: "Zupona — Trusted Online Shop",
  description:
    "Zupona | Bangladesh's trusted online shopping platform for fashion, electronics, beauty and more.",
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
 * stub, no script. */
export default async function RootLayout({ children }: LayoutProps<"/">) {
  const { facebookPixelId } = await getShopSettings();

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
