/** Buy Now, held apart from the cart.
 *
 * Buy Now used to add the item to the cart and send the shopper to checkout,
 * which quietly bought whatever else was already in there -- a shopper with two
 * saved items who taps Buy Now on a third pays for all three. A session holds
 * the single line being bought and the cart is never touched.
 *
 * The browser only ever holds the session id, in an httpOnly cookie; what is
 * being bought, how many, and at what price all live in the database. A session
 * is spent once: `consumed_at` is set by a conditional update, so a replayed
 * request cannot become a second order. */

import { cookies } from "next/headers";
import { getDB } from "@/lib/db";
import { resolveSelection } from "@/lib/selection";

const BUY_NOW_COOKIE = "zupona_buynow";
/** Long enough to finish checkout, short enough that a forgotten tab does not
 * hold a line open for a day. */
const SESSION_TTL_MS = 30 * 60 * 1000;

export interface BuyNowLine {
  sessionId: string;
  productId: string;
  variantId: string | null;
  quantity: number;
  label: string;
  name: string;
  image: string;
  price: number;
  oldPrice: number;
  available: number;
}

export type BuyNowResult = { ok: true } | { ok: false; error: string };

/** Validates the selection and opens a session for it. */
export async function createBuyNowSession(
  userId: string,
  input: { productId: string; variantId?: string | null; quantity: number }
): Promise<BuyNowResult> {
  const selection = await resolveSelection(input);
  if (!selection.ok) return selection;

  if (selection.available <= 0) return { ok: false, error: "This option is out of stock." };
  if (selection.quantity > selection.available) {
    return { ok: false, error: `Only ${selection.available} available.` };
  }

  const db = await getDB();
  const id = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();

  // Old sessions are cleared opportunistically rather than by a scheduled job,
  // and the sweep does not depend on the insert -- so the two go together. D1
  // is in Singapore and this runs while a shopper waits on Buy Now, so a wave
  // saved here is a round trip they do not sit through.
  await Promise.all([
    db
      .prepare(
        `INSERT INTO buy_now_sessions (id, user_id, product_id, variant_id, quantity, expires_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .bind(id, userId, selection.productId, selection.variantId, selection.quantity, expiresAt)
      .run(),
    db
      .prepare(
        "DELETE FROM buy_now_sessions WHERE expires_at < datetime('now') AND consumed_at IS NULL"
      )
      .run(),
  ]);

  const cookieStore = await cookies();
  cookieStore.set(BUY_NOW_COOKIE, id, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    expires: new Date(expiresAt),
  });

  return { ok: true };
}

/**
 * The line this browser is buying, priced from the database rather than from
 * whatever was true when the session opened -- so a price change between
 * tapping Buy Now and paying is honoured.
 */
export async function getBuyNowLine(userId: string): Promise<BuyNowLine | null> {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(BUY_NOW_COOKIE)?.value;
  if (!sessionId) return null;

  const db = await getDB();
  const row = await db
    .prepare(
      `SELECT id, product_id, variant_id, quantity FROM buy_now_sessions
       WHERE id = ? AND user_id = ? AND consumed_at IS NULL AND expires_at > datetime('now')`
    )
    .bind(sessionId, userId)
    .first<{ id: string; product_id: string; variant_id: string | null; quantity: number }>();

  if (!row) return null;

  const selection = await resolveSelection({
    productId: row.product_id,
    variantId: row.variant_id,
    quantity: row.quantity,
  });
  if (!selection.ok) return null;

  return {
    sessionId: row.id,
    productId: selection.productId,
    variantId: selection.variantId,
    quantity: selection.quantity,
    label: selection.label,
    name: selection.name,
    image: selection.image,
    price: selection.price,
    oldPrice: selection.oldPrice,
    available: selection.available,
  };
}

/**
 * Spends the session. The conditional update is the whole mechanism: whichever
 * request gets there first is the one that changes a row, and every later
 * attempt sees no change and knows it lost.
 */
export async function consumeBuyNowSession(sessionId: string): Promise<boolean> {
  const db = await getDB();
  const result = await db
    .prepare("UPDATE buy_now_sessions SET consumed_at = datetime('now') WHERE id = ? AND consumed_at IS NULL")
    .bind(sessionId)
    .run();

  return (result.meta.changes ?? 0) > 0;
}

export async function clearBuyNowCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(BUY_NOW_COOKIE);
}
