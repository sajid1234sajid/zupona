/** The Meta (Facebook) pixel: what the browser reports, and what this server does.
 *
 * One dataset, filled from two sides. The browser reports the cheap,
 * high-volume events -- a page view, a product view, an add to cart -- because
 * those describe browsing, and browsing only happens in a browser.
 *
 * The purchase is reported from here instead, because it is the one event that
 * decides whether a campaign was worth its money and the one event a browser
 * routinely loses: a tracking blocker, a privacy default or a shopper who
 * closes the tab on the confirmation page each take it away, and Meta then
 * optimises against half the sales the shop actually made. Sent from the
 * Worker it cannot be blocked, and it is only ever sent for an order already
 * committed to D1, so nothing a browser claims can invent one.
 *
 * Both sides send the same `event_id` -- the order id -- which is how Meta
 * collapses the browser's Purchase and this one into a single sale instead of
 * counting the order twice.
 *
 * Server-only: it reads the access token out of `site_settings`, and that
 * token must never reach a browser. Nothing here is imported by a client
 * component; `facebookPixelId` on the shop settings is the public half. */

import { getDB } from "@/lib/db";

const GRAPH_VERSION = "v21.0";

/** How long to wait on Meta before giving up. The shopper is not waiting on
 * this -- it runs after the response -- but a hung request would otherwise
 * hold a Worker invocation open for no reason. */
const TIMEOUT_MS = 3000;

export interface PurchaseLine {
  productId: string;
  quantity: number;
  price: number;
}

export interface PurchaseEvent {
  /** The order id, which is also the deduplication key against the browser. */
  orderId: string;
  /** Whole Taka, exactly what the shopper was charged. */
  value: number;
  lines: PurchaseLine[];
  /** Bangladeshi mobile number as entered. Hashed before it is sent. */
  phone: string | null;
  /** The confirmation page, so Meta can attribute the sale to a referrer. */
  sourceUrl: string | null;
  /** Passed through from the shopper's request so Meta can match the event to
   * the browser that saw the ad. Without these the match rate falls. */
  clientIp: string | null;
  userAgent: string | null;
  /** Meta's own browser cookies, when the pixel has set them. */
  fbp: string | null;
  fbc: string | null;
}

/** Meta wants every personal identifier as a lowercase SHA-256 hex digest, so
 * the raw number never leaves this Worker. */
async function hash(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** Meta matches phone numbers in E.164 without the plus: `8801712345678`.
 * Local input arrives as `01712345678` or `+8801712345678`, so both are
 * normalised to the same digits before hashing -- a number hashed in two
 * shapes is two different people as far as Meta is concerned. */
function normalisePhone(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("880")) return digits.length === 13 ? digits : null;
  if (digits.startsWith("0")) return digits.length === 11 ? `88${digits}` : null;
  if (digits.startsWith("1")) return digits.length === 10 ? `880${digits}` : null;
  return null;
}

interface PixelCredentials {
  pixelId: string;
  token: string;
}

/** Both halves of the server-side credential, or null when the shop has not
 * configured them. Read straight from D1 rather than through the settings
 * cache: this runs once per order, and the token has no business sitting in a
 * cached object that other code passes around. */
async function credentials(): Promise<PixelCredentials | null> {
  try {
    const db = await getDB();
    const { results } = await db
      .prepare("SELECT key, value FROM site_settings WHERE key IN ('facebook_pixel_id', 'meta_capi_token')")
      .all<{ key: string; value: string }>();

    const map = new Map(results.map((row) => [row.key, row.value?.trim()]));
    const pixelId = map.get("facebook_pixel_id");
    const token = map.get("meta_capi_token");

    if (!pixelId || !token) return null;
    return { pixelId, token };
  } catch (error) {
    console.error("meta pixel credentials unreadable", error);
    return null;
  }
}

/**
 * Reports a completed order to Meta's Conversions API.
 *
 * Never throws and never blocks anything that matters: an unconfigured shop,
 * an expired token or a Meta outage all end as a logged line. A sale that
 * failed to be reported is a worse advert, not a worse order.
 */
export async function sendPurchase(event: PurchaseEvent): Promise<void> {
  const config = await credentials();
  if (!config) return;

  const phone = event.phone ? normalisePhone(event.phone) : null;

  const userData: Record<string, unknown> = {};
  if (phone) userData.ph = [await hash(phone)];
  if (event.clientIp) userData.client_ip_address = event.clientIp;
  if (event.userAgent) userData.client_user_agent = event.userAgent;
  if (event.fbp) userData.fbp = event.fbp;
  if (event.fbc) userData.fbc = event.fbc;

  const payload = {
    data: [
      {
        event_name: "Purchase",
        event_time: Math.floor(Date.now() / 1000),
        event_id: event.orderId,
        action_source: "website",
        ...(event.sourceUrl ? { event_source_url: event.sourceUrl } : {}),
        user_data: userData,
        custom_data: {
          currency: "BDT",
          value: event.value,
          content_type: "product",
          contents: event.lines.map((line) => ({
            id: line.productId,
            quantity: line.quantity,
            item_price: line.price,
          })),
          num_items: event.lines.reduce((sum, line) => sum + line.quantity, 0),
        },
      },
    ],
  };

  try {
    const response = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${config.pixelId}/events?access_token=${encodeURIComponent(config.token)}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      }
    );

    if (!response.ok) {
      // The body carries Meta's reason -- a stale token, a wrong pixel id --
      // and reading it is the only way the admin ever finds out which.
      console.error("meta purchase rejected", {
        orderId: event.orderId,
        status: response.status,
        body: (await response.text()).slice(0, 400),
      });
    }
  } catch (error) {
    console.error("meta purchase not sent", { orderId: event.orderId, error });
  }
}

/** Whether a Conversions API token is stored, without reading it out.
 *
 * The Settings page prints "saved" beside an empty box rather than handing a
 * live token back to a browser on every page load. */
export async function capiTokenConfigured(): Promise<boolean> {
  try {
    const db = await getDB();
    const row = await db
      .prepare("SELECT value FROM site_settings WHERE key = 'meta_capi_token'")
      .first<{ value: string }>();
    return Boolean(row?.value?.trim());
  } catch {
    return false;
  }
}
