import type { Metadata, Viewport } from "next";
import { Hind_Siliguri, Poppins } from "next/font/google";
import ServiceWorkerRegistration from "@/components/app/ServiceWorkerRegistration";
import AppBanner from "@/components/app/AppBanner";
import { appBannerScript } from "@/components/app/appBannerScript";
import MetaPixel from "@/components/analytics/MetaPixel";
import GoogleAnalytics from "@/components/analytics/GoogleAnalytics";
import Monitoring from "@/components/analytics/Monitoring";
import ActivityTracker from "@/components/analytics/ActivityTracker";
import { getShopSettings } from "@/lib/shopSettings";
import { SITE_URL, shareMetadata } from "@/lib/shareCard";
import JsonLd from "@/components/seo/JsonLd";
import { DEFAULT_SETTINGS, type ShopSettings } from "@/lib/shopSettings";
import { DEFAULT_SUPPORT_WHATSAPP } from "@/lib/contact";
import "./globals.css";

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

/* Bengali text (product descriptions, the owner's taglines) in one consistent
 * face instead of whatever the phone has. Poppins has no Bengali letters, so
 * the browser reaches for this only for those characters, and the font's
 * unicode-range means a page with no Bengali never downloads it -- hence no
 * preload. */
const bengali = Hind_Siliguri({
  variable: "--font-bengali",
  subsets: ["bengali"],
  weight: ["400", "600"],
  preload: false,
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
  // Off when settings cannot be read: an install prompt is not worth
  // guessing at on a page that is already in trouble.
  let appBannerEnabled = false;
  let appBannerSnoozeDays = 0;
  let settings: ShopSettings = DEFAULT_SETTINGS;
  try {
    settings = await getShopSettings();
    ({ facebookPixelId, appBannerEnabled, appBannerSnoozeDays } = settings);
  } catch (error) {
    console.error("shop settings unreadable in root layout", error);
  }

  return (
    // `suppressHydrationWarning`: the app banner's inline script may add
    // `data-app-banner` to this element before React hydrates it.
    <html
      lang="en"
      className={`${poppins.variable} ${bengali.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col bg-white">
        {appBannerEnabled ? (
          <>
            <script dangerouslySetInnerHTML={{ __html: appBannerScript(appBannerSnoozeDays) }} />
            <AppBanner />
          </>
        ) : null}
        <JsonLd data={organizationSchema(settings)} />
        {children}
        <ServiceWorkerRegistration />
        {facebookPixelId ? <MetaPixel pixelId={facebookPixelId} /> : null}
        {settings.ga4MeasurementId ? <GoogleAnalytics measurementId={settings.ga4MeasurementId} /> : null}
        <Monitoring reportErrors={Boolean(settings.sentryDsn)} />
        <ActivityTracker />
      </body>
    </html>
  );
}

/** Who the shop is, for search engines: the name, logo and official pages a
 * results page can show beside the site, and the support line. Built from
 * Settings, so a Facebook page added there is claimed here too. */
function organizationSchema(settings: ShopSettings) {
  const social = settings.social ?? DEFAULT_SETTINGS.social;
  const sameAs = [social.facebook, social.instagram, social.youtube, social.tiktok].filter(
    (url): url is string => Boolean(url)
  );
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${SITE_URL}/#organization`,
        name: settings.storeName,
        url: SITE_URL,
        logo: `${SITE_URL}/icon-512.png`,
        ...(sameAs.length > 0 ? { sameAs } : {}),
        contactPoint: {
          "@type": "ContactPoint",
          contactType: "customer support",
          telephone: settings.supportPhone || social.whatsapp || DEFAULT_SUPPORT_WHATSAPP,
          ...(settings.supportEmail ? { email: settings.supportEmail } : {}),
          areaServed: "BD",
          availableLanguage: ["en", "bn"],
        },
      },
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        name: settings.storeName,
        url: SITE_URL,
        publisher: { "@id": `${SITE_URL}/#organization` },
        potentialAction: {
          "@type": "SearchAction",
          target: { "@type": "EntryPoint", urlTemplate: `${SITE_URL}/search?q={search_term_string}` },
          "query-input": "required name=search_term_string",
        },
      },
    ],
  };
}
