import { headers } from "next/headers";

/** Turns an internal `/admin/...` path into the one the browser should show.
 *
 * The panel's routes physically live under `/admin/*` because the storefront
 * and the back office are one app. On `admin.zupona.com` the proxy serves
 * those routes from the root, so a redirect written as `/admin/products`
 * would leave a redundant prefix in the address bar.
 *
 * Redirects issued from a server action are followed by the client router,
 * which never touches the proxy -- so stripping has to happen here, at the
 * point the redirect is created, rather than being fixed up on the way
 * through.
 *
 * On any other host (localhost in development, the apex, a preview URL) the
 * path is returned unchanged, because there `/admin` is the only way in. */
export async function adminUrl(path: string): Promise<string> {
  const headerStore = await headers();
  const host = (headerStore.get("host") ?? "").split(":")[0].toLowerCase();

  if (!host.startsWith("admin.")) return path;
  if (path !== "/admin" && !path.startsWith("/admin/")) return path;

  return path.slice("/admin".length) || "/";
}

/** Absolute origin of the storefront, for links that must leave the panel.
 *
 * On `admin.zupona.com` a bare `href="/"` is the admin dashboard, not the
 * shop, so "View storefront" has to be an absolute URL. Everywhere else an
 * empty string is returned and the links stay relative, which is what keeps
 * them working on localhost. */
export async function storefrontOrigin(): Promise<string> {
  const headerStore = await headers();
  const rawHost = headerStore.get("host") ?? "";
  const host = rawHost.split(":")[0].toLowerCase();

  if (!host.startsWith("admin.")) return "";

  const apex = host.slice("admin.".length);
  if (!apex.includes(".")) return "";

  const protocol = headerStore.get("x-forwarded-proto") ?? "https";
  return `${protocol}://${apex}`;
}
