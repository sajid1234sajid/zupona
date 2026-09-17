import type { MetadataRoute } from "next";

/** What crawlers may read.
 *
 * Both this and the sitemap answered 404 until now, so nothing told a search
 * engine what the shop sells or which pages were worth its time.
 *
 * The storefront is open. Everything behind a session is not: an account page,
 * a cart and a checkout are one shopper's and have nothing to offer a crawler
 * but wasted requests against a Worker. `/api/` is machinery. The admin panel
 * lives on its own host and `requireAdmin()` is what actually guards it -- it
 * is listed here so a crawler does not spend its budget being redirected to a
 * login screen, never as a security measure.
 *
 * Absolute URL for the sitemap because that is what the standard asks for. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/account", "/cart", "/checkout", "/wishlist", "/admin", "/api/"],
    },
    sitemap: "https://zupona.com/sitemap.xml",
  };
}
