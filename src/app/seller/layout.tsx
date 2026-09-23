import type { Metadata, Viewport } from "next";

/** Wraps the Seller Center's door and the panel itself.
 *
 * Deliberately thin, the same way the admin panel's root layout is: the sign-in
 * and application screens need no chrome and no store guard, so those live one
 * level down in `(panel)/layout.tsx`. What is shared at this level is only what
 * must be true of every seller URL.
 *
 * None of these are indexed. The page that is meant to be found in a search is
 * `/sell` on the shop itself, which is where a would-be seller starts; these
 * are the working screens behind it, and letting a search engine hold two
 * addresses for the same application form helps nobody. */
export const metadata: Metadata = {
  title: {
    default: "Zupona Seller Center",
    template: "%s · Zupona Seller Center",
  },
  robots: { index: false, follow: false, nocache: true },
  applicationName: "Zupona Seller Center",
};

/** The rail's green, so the phone's status bar matches the panel rather than
 * the storefront. */
export const viewport: Viewport = {
  themeColor: "#0e3220",
};

export default function SellerRootLayout({ children }: LayoutProps<"/seller">) {
  return children;
}
