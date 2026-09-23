"use client";

/** Fires one pixel event when a page is shown.
 *
 * A server component cannot report to the pixel -- the pixel lives in the
 * browser -- so the pages that mean something to a campaign render this
 * instead of holding a client component of their own. It draws nothing.
 *
 * Guarded by a ref rather than by the effect's dependencies: React runs
 * effects twice in development, and a purchase reported twice is a campaign
 * told the shop sells twice what it does. */

import { useEffect, useRef } from "react";
import { trackPixel } from "./MetaPixel";

export default function PixelEvent({
  event,
  params,
  eventId,
}: {
  event: string;
  params?: Record<string, unknown>;
  /** Deduplication key. On a purchase this is the order id, which the Worker
   * sends with its own copy of the event. */
  eventId?: string;
}) {
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    trackPixel(event, params, eventId);
    // The payload is rebuilt on every render of the page that owns it, so it
    // is deliberately not a dependency: this fires for the page, once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
