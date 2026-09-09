import { NextResponse, type NextRequest } from "next/server";

/** Host-based routing for the admin panel.
 *
 * The admin panel and the storefront are one Cloudflare Worker, so which one a
 * request gets is decided here by the Host header rather than by deploying two
 * apps. Everything admin lives under `/admin/*` in the app router; this file
 * maps `admin.zupona.com/products` onto `/admin/products` so the internal
 * prefix never reaches the address bar.
 *
 * Locally there is no subdomain, so `localhost:3001/admin` is left to work
 * directly -- the host rules only fire for real domains.
 *
 * This is routing, not authorization. Nothing here decides who may see the
 * panel: `requireAdmin()` in the layout and in every server action does that,
 * because a proxy check can be bypassed by anything that reaches the origin
 * another way. */

const ADMIN_HOST_PREFIX = "admin.";

/** Assets, server-action payloads and the media route must reach their real
 * paths untouched on every host. */
const PASS_THROUGH = ["/_next", "/api", "/__vinext", "/favicon.ico", "/robots.txt"];

/** The panel's own top-level sections.
 *
 * Only these are served from the root of the admin host. Anything else --
 * `/product/123`, `/cart`, `/wishlist` -- belongs to the storefront, and a
 * link to it from inside the panel is sent to the main domain rather than
 * being rewritten into an admin route that does not exist. */
const ADMIN_SEGMENTS = new Set([
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
]);

/** A routable public domain: at least one dot and an alphabetic TLD.
 *
 * The alphabetic TLD is what rules out a bare IP -- `127.0.0.1` contains dots
 * too, and without this check a local production run would try to redirect to
 * the nonexistent host `admin.127.0.0.1`. */
const PUBLIC_DOMAIN = /^[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/;

function hostOf(request: NextRequest): string {
  return (request.headers.get("host") ?? "").split(":")[0].toLowerCase();
}

/** True for hostnames that have an admin subdomain to send people to. */
function hasAdminSubdomain(host: string): boolean {
  if (!PUBLIC_DOMAIN.test(host)) return false;
  return !host.endsWith("workers.dev") && !host.endsWith("localhost");
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (PASS_THROUGH.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    return NextResponse.next();
  }

  const host = hostOf(request);
  const isPrefixed = pathname === "/admin" || pathname.startsWith("/admin/");

  if (host.startsWith(ADMIN_HOST_PREFIX)) {
    // Anything that still hands out an internal `/admin/...` URL is bounced to
    // the clean equivalent, so the address bar shows admin.zupona.com/products.
    if (isPrefixed) {
      const target = request.nextUrl.clone();
      target.pathname = pathname.slice("/admin".length) || "/";
      return NextResponse.redirect(target);
    }

    const segment = pathname.split("/")[1] ?? "";

    if (pathname === "/" || ADMIN_SEGMENTS.has(segment)) {
      const target = request.nextUrl.clone();
      target.pathname = pathname === "/" ? "/admin" : `/admin${pathname}`;
      return NextResponse.rewrite(target);
    }

    // A storefront path reached on the admin host: send it to the main site,
    // which is what "View live" on a product means.
    const apex = host.slice(ADMIN_HOST_PREFIX.length);
    if (PUBLIC_DOMAIN.test(apex)) {
      const target = new URL(request.url);
      target.hostname = apex;
      target.search = search;
      return NextResponse.redirect(target);
    }

    return NextResponse.next();
  }

  // On the storefront host, send /admin traffic to the subdomain so the panel
  // has one canonical address. Skipped on localhost, raw IPs and *.workers.dev,
  // where `/admin` is the only way in.
  if (isPrefixed && hasAdminSubdomain(host)) {
    const target = new URL(request.url);
    target.hostname = `${ADMIN_HOST_PREFIX}${host.replace(/^www\./, "")}`;
    target.pathname = pathname.slice("/admin".length) || "/";
    target.search = search;
    return NextResponse.redirect(target);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
