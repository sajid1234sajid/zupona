import { NextResponse, type NextRequest } from "next/server";

/** Host-based routing for the back-office panels.
 *
 * The storefront, the admin panel and the Seller Center are one Cloudflare
 * Worker, so which one a request gets is decided here by the Host header
 * rather than by deploying three apps. Each panel's pages live under their own
 * prefix in the app router; this file maps `admin.zupona.com/products` onto
 * `/admin/products`, and `seller.zupona.com/orders` onto `/seller/orders`, so
 * the internal prefix never reaches the address bar.
 *
 * Locally there is no subdomain, so `localhost:3001/admin` and
 * `localhost:3001/seller` are left to work directly -- the host rules only
 * fire for real domains.
 *
 * This is routing, not authorization. Nothing here decides who may see a
 * panel: `requireAdmin()` and the Seller Center's own guard, in the layouts and
 * in every server action, do that -- because a proxy check can be bypassed by
 * anything that reaches the origin another way. */

interface Panel {
  /** The subdomain this panel answers on, trailing dot included. */
  hostPrefix: string;
  /** The internal route prefix its pages live under. */
  base: string;
  /** The panel's own top-level sections.
   *
   * Only these are served from the root of the panel's host. Anything else --
   * `/product/123`, `/cart`, `/wishlist` -- belongs to the storefront, and a
   * link to it from inside the panel is sent to the main domain rather than
   * being rewritten into a panel route that does not exist. */
  segments: Set<string>;
}

const PANELS: Panel[] = [
  {
    hostPrefix: "admin.",
    base: "/admin",
    segments: new Set([
      "login",
      "products",
      "categories",
      "orders",
      "customers",
      "distributors",
      "coupons",
      "marketing",
      "reports",
      "settings",
      "search",
    ]),
  },
  {
    hostPrefix: "seller.",
    base: "/seller",
    segments: new Set(["login", "apply", "pending", "settings", "stores"]),
  },
];

/** Assets, server-action payloads and the media route must reach their real
 * paths untouched on every host. */
const PASS_THROUGH = [
  "/_next",
  "/api",
  "/__vinext",
  "/favicon.ico",
  "/robots.txt",
  // The installable-app files. Bouncing these to the apex from a panel host
  // would only turn them into cross-origin requests the browser then ignores.
  "/manifest.webmanifest",
  "/apple-touch-icon.png",
  "/icon-192.png",
  "/icon-512.png",
  "/icon-maskable-512.png",
  // The admin panel's own installable-app files. These have to be served on
  // the admin host rather than redirected to the apex: a redirect is what the
  // Android build fetching them would fail on, and a manifest whose icons
  // live on another origin is not the panel's app.
  "/admin.webmanifest",
  "/admin-icon-192.png",
  "/admin-icon-512.png",
  "/admin-icon-maskable-512.png",
  "/shortcut-admin-orders.png",
  "/shortcut-admin-products.png",
  "/shortcut-admin-new-product.png",
];

/** Android insists on this exact path; the handler lives under `/api`. */
const ASSET_LINKS_PATH = "/.well-known/assetlinks.json";

/** A routable public domain: at least one dot and an alphabetic TLD.
 *
 * The alphabetic TLD is what rules out a bare IP -- `127.0.0.1` contains dots
 * too, and without this check a local production run would try to redirect to
 * the nonexistent host `admin.127.0.0.1`. */
const PUBLIC_DOMAIN = /^[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/;

function hostOf(request: NextRequest): string {
  return (request.headers.get("host") ?? "").split(":")[0].toLowerCase();
}

/** True for hostnames that have panel subdomains to send people to. */
function hasPanelSubdomains(host: string): boolean {
  if (!PUBLIC_DOMAIN.test(host)) return false;
  return !host.endsWith("workers.dev") && !host.endsWith("localhost");
}

/** The panel whose internal prefix this path carries, if any. */
function panelForPath(pathname: string): Panel | undefined {
  return PANELS.find(
    (panel) => pathname === panel.base || pathname.startsWith(`${panel.base}/`)
  );
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (PASS_THROUGH.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    return NextResponse.next();
  }

  if (pathname === ASSET_LINKS_PATH) {
    const target = request.nextUrl.clone();
    target.pathname = "/api/assetlinks";
    return NextResponse.rewrite(target);
  }

  const host = hostOf(request);
  const prefixed = panelForPath(pathname);
  const panel = PANELS.find((entry) => host.startsWith(entry.hostPrefix));

  if (panel) {
    // Anything that still hands out an internal `/admin/...` URL is bounced to
    // the clean equivalent, so the address bar shows admin.zupona.com/products.
    // Only this panel's own prefix is stripped: `/admin/...` reached on the
    // seller host is not this panel's URL to rewrite, and falls through to the
    // storefront redirect below.
    if (prefixed === panel) {
      const target = request.nextUrl.clone();
      target.pathname = pathname.slice(panel.base.length) || "/";
      return NextResponse.redirect(target);
    }

    const segment = pathname.split("/")[1] ?? "";

    if (pathname === "/" || panel.segments.has(segment)) {
      const target = request.nextUrl.clone();
      target.pathname = pathname === "/" ? panel.base : `${panel.base}${pathname}`;
      return NextResponse.rewrite(target);
    }

    // A storefront path reached on a panel host: send it to the main site,
    // which is what "View live" on a product means.
    const apex = host.slice(panel.hostPrefix.length);
    if (PUBLIC_DOMAIN.test(apex)) {
      const target = new URL(request.url);
      target.hostname = apex;
      target.search = search;
      return NextResponse.redirect(target);
    }

    return NextResponse.next();
  }

  // On the storefront host, send panel traffic to its subdomain so each panel
  // has one canonical address. Skipped on localhost, raw IPs and *.workers.dev,
  // where the prefix is the only way in.
  if (prefixed && hasPanelSubdomains(host)) {
    const target = new URL(request.url);
    target.hostname = `${prefixed.hostPrefix}${host.replace(/^www\./, "")}`;
    target.pathname = pathname.slice(prefixed.base.length) || "/";
    target.search = search;
    return NextResponse.redirect(target);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
