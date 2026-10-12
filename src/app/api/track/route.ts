/** Where the storefront's browser reports the pages a shopper sees.
 *
 * Sent by `ActivityTracker` with `navigator.sendBeacon`, after the page is
 * idle, so nothing here is on the shopper's critical path. The answer is an
 * empty 204 whatever happens: a beacon does not read its response, and a row
 * that could not be written is a gap in a report, not an error to show anyone.
 *
 * The visitor id comes from the `zv` cookie rather than the body, so one
 * browser cannot write rows under another's id by editing a request. */

import { cookies, headers } from "next/headers";
import {
  VISITOR_COOKIE,
  currentSessionId,
  deviceOf,
  isBot,
  recordBrowse,
  sourceOf,
  validVisitorId,
} from "@/lib/activity";
import { afterResponse } from "@/lib/db";

/** A beacon is a few hundred bytes; anything much larger is not one. */
const MAX_BODY = 2048;

interface Beacon {
  /** pathname */
  p?: unknown;
  /** first page of a visit */
  e?: unknown;
  /** document.referrer */
  r?: unknown;
  /** utm_source, utm_medium, utm_campaign */
  us?: unknown;
  um?: unknown;
  uc?: unknown;
  /** whether the URL carried fbclid / gclid */
  fb?: unknown;
  g?: unknown;
}

function text(value: unknown, max: number): string {
  return typeof value === "string" ? value.slice(0, max) : "";
}

function done(): Response {
  return new Response(null, { status: 204, headers: { "cache-control": "no-store" } });
}

export async function POST(request: Request) {
  const [jar, headerStore] = await Promise.all([cookies(), headers()]);
  const userAgent = headerStore.get("user-agent");
  if (isBot(userAgent)) return done();

  const visitorId = validVisitorId(jar.get(VISITOR_COOKIE)?.value);
  if (!visitorId) return done();

  const raw = await request.text();
  if (raw.length > MAX_BODY) return done();

  let beacon: Beacon;
  try {
    beacon = JSON.parse(raw) as Beacon;
  } catch {
    return done();
  }

  const path = text(beacon.p, 300);
  if (!path.startsWith("/")) return done();

  // The panels share this Worker; a beacon from one is not a shopper.
  const host = new URL(request.url).hostname;
  if (/^(admin|seller)\./.test(host) || /^\/(admin|seller|api)(\/|$)/.test(path)) return done();

  const arrival =
    beacon.e === 1
      ? sourceOf(
          {
            referrer: text(beacon.r, 500),
            utmSource: text(beacon.us, 60),
            utmMedium: text(beacon.um, 60),
            utmCampaign: text(beacon.uc, 120),
            fbclid: beacon.fb === 1,
            gclid: beacon.g === 1,
          },
          host,
          userAgent
        )
      : null;

  const sessionId = await currentSessionId();

  await afterResponse("activity beacon", () =>
    recordBrowse({ visitorId, sessionId, path, arrival, device: deviceOf(userAgent) })
  );

  return done();
}
