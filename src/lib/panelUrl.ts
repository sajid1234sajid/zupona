import { headers } from "next/headers";

/** Which subdomain serves each back-office panel.
 *
 * Both panels are the same Worker as the shop, separated only by the Host
 * header the proxy reads. Keeping the mapping here as well as in `proxy.ts`
 * would let the two drift, so this table is the one the redirect helpers use
 * and the proxy builds its own routing from the same two facts. */
const PANEL_HOSTS: Record<string, string> = {
  "/admin": "admin.",
  "/seller": "seller.",
};

async function currentHost(): Promise<string> {
  const headerStore = await headers();
  return (headerStore.get("host") ?? "").split(":")[0].toLowerCase();
}

/** Turns an internal panel path into the one the browser should show.
 *
 * A panel's routes physically live under `/admin/*` or `/seller/*` because the
 * storefront and the back offices are one app. On their own subdomains the
 * proxy serves those routes from the root, so a redirect written as
 * `/admin/products` would leave a redundant prefix in the address bar.
 *
 * Redirects issued from a server action are followed by the client router,
 * which never touches the proxy -- so stripping has to happen here, at the
 * point the redirect is created, rather than being fixed up on the way
 * through.
 *
 * On any other host (localhost in development, the apex, a preview URL) the
 * path is returned unchanged, because there the prefix is the only way in. */
async function panelUrl(base: string, path: string): Promise<string> {
  const host = await currentHost();

  if (!host.startsWith(PANEL_HOSTS[base])) return path;
  if (path !== base && !path.startsWith(`${base}/`)) return path;

  return path.slice(base.length) || "/";
}

export function adminUrl(path: string): Promise<string> {
  return panelUrl("/admin", path);
}

export function sellerUrl(path: string): Promise<string> {
  return panelUrl("/seller", path);
}

/** Absolute origin of the storefront, for links that must leave a panel.
 *
 * On `admin.zupona.com` or `seller.zupona.com` a bare `href="/"` is that
 * panel's dashboard, not the shop, so "View storefront" has to be an absolute
 * URL. Everywhere else an empty string is returned and the links stay
 * relative, which is what keeps them working on localhost. */
export async function storefrontOrigin(): Promise<string> {
  const host = await currentHost();
  const prefix = Object.values(PANEL_HOSTS).find((entry) => host.startsWith(entry));
  if (!prefix) return "";

  const apex = host.slice(prefix.length);
  if (!apex.includes(".")) return "";

  const headerStore = await headers();
  const protocol = headerStore.get("x-forwarded-proto") ?? "https";
  return `${protocol}://${apex}`;
}
