import type { Metadata, Viewport } from "next";

/** Wraps both the login screen and the panel itself.
 *
 * Deliberately thin: the sign-in page needs no chrome and no session guard, so
 * those live one level down in `(panel)/layout.tsx`. What is shared at this
 * level is only what must be true of every admin URL -- chiefly that none of
 * them are ever indexed. */
export const metadata: Metadata = {
  title: {
    default: "Zupona Admin",
    template: "%s · Zupona Admin",
  },
  robots: { index: false, follow: false, nocache: true },
  // The panel's own installable identity, overriding the shop's. Without it
  // "Install app" on admin.zupona.com would offer the storefront, since the
  // root layout's manifest would otherwise still be the one in effect. The
  // Android admin app (android/admin/twa-manifest.json) wraps this manifest.
  applicationName: "Zupona Admin",
  manifest: "/admin.webmanifest",
  appleWebApp: { capable: true, title: "Zupona Admin", statusBarStyle: "black-translucent" },
  icons: {
    icon: [
      { url: "/admin-icon-192.png", type: "image/png", sizes: "192x192" },
      { url: "/admin-icon-512.png", type: "image/png", sizes: "512x512" },
    ],
  },
};

/** The sidebar's green, so the phone's status bar matches the panel rather
 * than the storefront. */
export const viewport: Viewport = {
  themeColor: "#0e3220",
};

export default function AdminRootLayout({ children }: LayoutProps<"/admin">) {
  return children;
}
