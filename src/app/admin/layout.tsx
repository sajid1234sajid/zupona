import type { Metadata } from "next";

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
};

export default function AdminRootLayout({ children }: LayoutProps<"/admin">) {
  return children;
}
