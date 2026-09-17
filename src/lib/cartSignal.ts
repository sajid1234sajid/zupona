"use client";

import { useEffect, useState } from "react";

/** Lets an "Add to cart" tap move the tab bar's badge immediately.
 *
 * The badge is read on the server, which is what makes it right on first
 * paint, and `router.refresh()` is what reconciles it after an add. But that
 * refresh is a round trip: measured on zupona.com the badge did not move for
 * about two seconds after the tap, which is long enough for a shopper to
 * wonder whether the tap worked and press again.
 *
 * So the card announces the add here and the bar adds it to the count it was
 * given, until the refreshed count arrives and replaces the guess. The card
 * and the bar sit in different trees -- one in the page, one in the layout --
 * so this is a plain subscription rather than a context that would have to
 * wrap the whole app.
 *
 * It is deliberately only a hint. Nothing is ever bought or priced from it;
 * the server's count is the truth and always wins. */

type Listener = (delta: number) => void;

const listeners = new Set<Listener>();

/** Tell the bar that `delta` more items just went into the cart. */
export function signalCartAdd(delta = 1): void {
  for (const listener of listeners) listener(delta);
}

/** The number of items added in this browser since the server last answered.
 *
 * `serverCount` is the count the bar was rendered with. When a new one arrives
 * the guess has been superseded, so it is dropped -- adjusted during that
 * render rather than in an effect, so the badge is never painted once with the
 * guess still added on top of the fresh count. */
export function usePendingCartAdds(serverCount: number): number {
  const [pending, setPending] = useState(0);
  const [lastServerCount, setLastServerCount] = useState(serverCount);

  if (lastServerCount !== serverCount) {
    setLastServerCount(serverCount);
    setPending(0);
  }

  useEffect(() => {
    const listener: Listener = (delta) => setPending((current) => current + delta);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  return pending;
}
