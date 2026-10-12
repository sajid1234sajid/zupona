/** What shoppers do on the storefront, written to `visitor_events`.
 *
 * Two writers share this module. Browsing -- a page, a product, the cart, the
 * checkout -- arrives from the browser as a beacon to `/api/track`, sent after
 * the page is idle so it costs the shopper nothing. Adding to the cart, Buy Now
 * and the purchase are recorded by the server actions that perform them,
 * because those are the rows that matter and a browser can neither be relied
 * on to send them nor trusted to make them up.
 *
 * The admin panel reads it all back in `src/lib/activityData.ts`. */

import { cookies, headers } from "next/headers";
import { afterResponse, getDB } from "@/lib/db";
import { SESSION_COOKIE } from "@/lib/session";

/** The browser's id, set by `ActivityTracker` on the first page it shows. */
export const VISITOR_COOKIE = "zv";

/** How long a row is kept. Long enough to compare one season with the last;
 * short enough that the table never becomes the database. */
const RETENTION = "-120 days";

export type BrowseEvent = "page_view" | "product_view" | "cart_view" | "checkout";
export type ActionEvent = "add_to_cart" | "buy_now" | "purchase";

const VISITOR_ID = /^[A-Za-z0-9-]{8,64}$/;

export function validVisitorId(value: string | undefined | null): string | null {
  return value && VISITOR_ID.test(value) ? value : null;
}

/** Search engines, link previews and test browsers. Counting them would make
 * every product look popular and every funnel look broken. */
const BOT = /bot|crawl|spider|slurp|headless|lighthouse|facebookexternalhit|meta-externalagent|preview|pingdom|uptime|python|curl|wget|httpclient|okhttp/i;

export function isBot(userAgent: string | null): boolean {
  return !userAgent || BOT.test(userAgent);
}

export function deviceOf(userAgent: string | null): "mobile" | "tablet" | "desktop" {
  if (!userAgent) return "desktop";
  if (/iPad|Tablet|SM-T|Tab\b/i.test(userAgent)) return "tablet";
  if (/Mobi|Android|iPhone|iPod/i.test(userAgent)) return "mobile";
  return "desktop";
}

/** Which of the shop's pages a path is, and the product slug when it is one. */
export function classifyPath(path: string): { event: BrowseEvent; slug: string | null } {
  const product = /^\/products\/([^/]+)\/?$/.exec(path);
  if (product) {
    let slug = product[1];
    try {
      slug = decodeURIComponent(slug);
    } catch {
      // A malformed escape is still a path; it simply matches no product.
    }
    return { event: "product_view", slug };
  }
  if (path === "/cart") return { event: "cart_view", slug: null };
  if (path === "/checkout") return { event: "checkout", slug: null };
  return { event: "page_view", slug: null };
}

export interface Arrival {
  /** `document.referrer`, the full URL. */
  referrer: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  fbclid: boolean;
  gclid: boolean;
}

export interface Source {
  source: string;
  campaign: string | null;
  referrer: string | null;
}

const HOSTS: [RegExp, string][] = [
  [/(^|\.)(facebook\.com|fb\.com|fb\.me)$/, "facebook"],
  [/(^|\.)instagram\.com$/, "instagram"],
  [/(^|\.)messenger\.com$/, "messenger"],
  [/(^|\.)(whatsapp\.com|wa\.me)$/, "whatsapp"],
  [/(^|\.)(youtube\.com|youtu\.be)$/, "youtube"],
  [/(^|\.)tiktok\.com$/, "tiktok"],
  [/(^|\.)google\.[a-z.]+$/, "google"],
  [/(^|\.)bing\.com$/, "bing"],
];

const PAID = /paid|cpc|ppc|^ads?$|sponsored|boost/i;

/** Where a visit came from, decided once, on the first page of it.
 *
 * In order of how much it can be trusted: an ad's own `utm_` tags, then the
 * click ids Meta and Google append, then the referring site, then the in-app
 * browser a link was opened in. Meta adds `fbclid` to every click out of
 * Facebook, advert or post, so without `utm_medium=paid` on the ad an ad
 * click reads as plain "facebook". */
export function sourceOf(arrival: Arrival, ownHost: string, userAgent: string | null): Source | null {
  const campaign = arrival.utmCampaign.slice(0, 120) || null;
  const utm = arrival.utmSource.toLowerCase().slice(0, 60);

  if (utm) {
    const meta = /^(facebook|fb|ig|instagram|meta)$/.test(utm);
    if (meta && (PAID.test(arrival.utmMedium) || campaign)) {
      return { source: "facebook_ad", campaign, referrer: null };
    }
    if (meta) return { source: utm === "ig" ? "instagram" : utm === "fb" ? "facebook" : utm, campaign, referrer: null };
    const known = HOSTS.find(([, name]) => name === utm);
    return { source: known ? utm : "other", campaign, referrer: known ? null : utm };
  }

  if (arrival.fbclid) return { source: "facebook", campaign, referrer: null };
  if (arrival.gclid) return { source: "google", campaign, referrer: null };

  let host = "";
  try {
    host = arrival.referrer ? new URL(arrival.referrer).hostname.toLowerCase() : "";
  } catch {
    host = "";
  }

  // A page reached from the shop itself is not an arrival.
  if (host && (host === ownHost || host.endsWith(".zupona.com") || host === "zupona.com")) return null;

  if (host) {
    const known = HOSTS.find(([pattern]) => pattern.test(host));
    return known
      ? { source: known[1], campaign, referrer: null }
      : { source: "other", campaign, referrer: host.slice(0, 120) };
  }

  // Facebook's and Instagram's in-app browsers often send no referrer at all.
  if (userAgent && /FBAN|FBAV|FB_IAB|FBIOS/.test(userAgent)) return { source: "facebook", campaign, referrer: null };
  if (userAgent && /Instagram/.test(userAgent)) return { source: "instagram", campaign, referrer: null };

  return { source: "direct", campaign, referrer: null };
}

export interface BrowseRow {
  visitorId: string;
  sessionId: string | null;
  path: string;
  arrival: Source | null;
  device: string;
}

/** Writes one page the browser reported. The user and the product are looked
 * up inside the insert, so the whole thing is one statement and one trip. */
export async function recordBrowse(row: BrowseRow): Promise<void> {
  const db = await getDB();
  const { event, slug } = classifyPath(row.path);

  await db
    .prepare(
      `INSERT INTO visitor_events
         (visitor_id, user_id, event, path, product_id, source, campaign, referrer, device)
       VALUES (?1,
               (SELECT user_id FROM sessions WHERE id = ?2 AND expires_at > datetime('now')),
               ?3, ?4,
               (SELECT id FROM products WHERE slug = ?5),
               ?6, ?7, ?8, ?9)`
    )
    .bind(
      row.visitorId,
      row.sessionId,
      event,
      row.path,
      slug,
      row.arrival?.source ?? null,
      row.arrival?.campaign ?? null,
      row.arrival?.referrer ?? null,
      row.device
    )
    .run();

  // Pruned now and then rather than on a schedule: one request in a few
  // hundred pays for a delete the index makes cheap.
  if (Math.random() < 0.004) {
    await db.prepare("DELETE FROM visitor_events WHERE created_at < datetime('now', ?)").bind(RETENTION).run();
  }
}

export interface ActionRow {
  event: ActionEvent;
  userId: string;
  productId?: string | null;
  quantity?: number | null;
  /** Whole Taka. */
  value?: number | null;
  orderId?: string | null;
}

/**
 * Records something a shopper did on the server: an add to cart, a Buy Now, an
 * order. Written after the response, and it never throws -- a missing row in
 * the activity log is a gap in a report, not a failed purchase.
 */
export async function recordAction(action: ActionRow): Promise<void> {
  try {
    const [jar, headerStore] = await Promise.all([cookies(), headers()]);
    const userAgent = headerStore.get("user-agent");
    if (isBot(userAgent)) return;

    // A browser with JavaScript off never set the cookie; the account then
    // stands in for it, so the row still belongs to somebody.
    const visitorId = validVisitorId(jar.get(VISITOR_COOKIE)?.value) ?? `u:${action.userId}`;
    const device = deviceOf(userAgent);

    await afterResponse("activity insert", async () => {
      const db = await getDB();
      await db
        .prepare(
          `INSERT INTO visitor_events
             (visitor_id, user_id, event, product_id, order_id, quantity, value, device)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          visitorId,
          action.userId,
          action.event,
          action.productId ?? null,
          action.orderId ?? null,
          action.quantity ?? null,
          action.value ?? null,
          device
        )
        .run();
    });
  } catch (error) {
    console.error("activity not recorded", { event: action.event, error });
  }
}

/** The session cookie's value, for the ingest route to resolve inside its
 * insert. Exported so the route does not need to know the cookie's name. */
export async function currentSessionId(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(SESSION_COOKIE)?.value ?? null;
}
