import type { Metadata, Viewport } from "next";
import { Poppins, Playfair_Display } from "next/font/google";
import "./globals.css";

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

/** Reserved for display copy -- the hero headline and little else. The UI
 * itself stays on Poppins so the serif keeps its impact. */
const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  weight: ["600", "700"],
});

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

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${poppins.variable} ${playfair.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-white">{children}</body>
    </html>
  );
}
