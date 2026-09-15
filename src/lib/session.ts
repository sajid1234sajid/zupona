import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getDB } from "@/lib/db";
import type { AuthUser, UserRole } from "@/types";

const SESSION_COOKIE = "zupona_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/** A shopper who has not made an account yet.
 *
 * Nobody has to sign in to fill a cart or to buy. The first add to cart from a
 * signed-out browser creates a `users` row with this role and an ordinary
 * session for it, so the cart, Buy Now and checkout keep working on a user id
 * exactly as before. Everywhere else a guest is signed out: `getCurrentUser`
 * does not return one, and the admin panel does not count them as customers.
 * Confirming a phone number at checkout, or signing in, turns the guest into a
 * real customer or hands its cart to the account it signed in to. */
const GUEST_ROLE = "guest";

interface UserRow {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
  points: number;
  role: UserRole | typeof GUEST_ROLE;
  created_at: string;
}

/** Whoever holds this browser's cart: a signed-in user or a guest. */
export interface Shopper {
  id: string;
  name: string;
  phone: string | null;
  isGuest: boolean;
}

function toAuthUser(row: UserRow & { role: UserRole }): AuthUser {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    avatarUrl: row.avatar_url,
    points: row.points,
    role: row.role,
    createdAt: row.created_at,
  };
}

/** Moves a guest's cart and Buy Now line to `userId`, then removes the guest.
 *
 * A line the account already holds is kept as the account had it -- `OR IGNORE`
 * skips it rather than failing on the unique index -- and the guest's copy goes
 * with the guest. */
async function adoptGuest(guestId: string, userId: string): Promise<void> {
  const db = await getDB();
  await db.batch([
    db.prepare("UPDATE OR IGNORE cart_items SET user_id = ? WHERE user_id = ?").bind(userId, guestId),
    db.prepare("UPDATE buy_now_sessions SET user_id = ? WHERE user_id = ?").bind(userId, guestId),
    db.prepare("DELETE FROM cart_items WHERE user_id = ?").bind(guestId),
    db.prepare("DELETE FROM sessions WHERE user_id = ?").bind(guestId),
    db.prepare("DELETE FROM users WHERE id = ? AND role = ?").bind(guestId, GUEST_ROLE),
  ]);
}

export async function createSession(userId: string): Promise<void> {
  const db = await getDB();

  // Signing in from a browser that was shopping as a guest keeps what it put in
  // the cart.
  const current = await readSessionRow();
  if (current && current.role === GUEST_ROLE && current.id !== userId) {
    await adoptGuest(current.id, userId);
  }

  const sessionId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();

  // Device details are recorded so the account security page can list active
  // sessions and the owner can spot a login they don't recognise.
  const headerStore = await headers();
  const ipAddress = headerStore.get("cf-connecting-ip");
  const userAgent = headerStore.get("user-agent");

  await db.batch([
    db
      .prepare(
        "INSERT INTO sessions (id, user_id, expires_at, ip_address, user_agent) VALUES (?, ?, ?, ?, ?)"
      )
      .bind(sessionId, userId, expiresAt, ipAddress, userAgent),
    db
      .prepare("UPDATE users SET last_login_at = datetime('now') WHERE id = ?")
      .bind(userId),
  ]);

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, sessionId, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    expires: new Date(expiresAt),
  });
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE)?.value;

  if (sessionId) {
    const db = await getDB();
    await db.prepare("DELETE FROM sessions WHERE id = ?").bind(sessionId).run();
  }

  cookieStore.delete(SESSION_COOKIE);
}

/** Resolves the signed-in user, or null. Suspended and banned accounts are
 * treated as signed out: the status check lives in the query so a moderation
 * decision takes effect on the very next request.
 *
 * Memoised for the lifetime of one request. A page, its header and the tab
 * bar all ask who is signed in, and before this that was one session lookup
 * each; now the first one pays and the rest are free. It is safe because
 * nothing writes the session cookie and then reads it back in the same
 * request -- `createSession` is always followed by a redirect. */
const readSessionRow = cache(async function readSessionRow(): Promise<UserRow | null> {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE)?.value;
  if (!sessionId) return null;

  const db = await getDB();
  const row = await db
    .prepare(
      `SELECT users.id, users.name, users.email, users.phone, users.avatar_url, users.points,
              users.role, users.created_at
       FROM sessions
       JOIN users ON users.id = sessions.user_id
       WHERE sessions.id = ? AND sessions.expires_at > datetime('now')
         AND users.status = 'active'`
    )
    .bind(sessionId)
    .first<UserRow>();

  return row ?? null;
});

/** A guest is not a signed-in user, so this returns null for one. Use
 * `getShopper` for anything that belongs to the cart. */
export const getCurrentUser = cache(async function getCurrentUser(): Promise<AuthUser | null> {
  const row = await readSessionRow();
  if (!row || row.role === GUEST_ROLE) return null;
  return toAuthUser(row as UserRow & { role: UserRole });
});

/** The signed-in user or the guest shopping in this browser, or null when the
 * browser has never added anything. */
export async function getShopper(): Promise<Shopper | null> {
  const row = await readSessionRow();
  if (!row) return null;
  return { id: row.id, name: row.name, phone: row.phone, isGuest: row.role === GUEST_ROLE };
}

/** The shopper, creating a guest for a signed-out browser. Only called from
 * actions that are about to write to the cart, so browsing never creates one. */
export async function getOrCreateShopper(): Promise<Shopper> {
  const existing = await getShopper();
  if (existing) return existing;

  const db = await getDB();
  const id = crypto.randomUUID();
  await db
    .prepare("INSERT INTO users (id, name, role) VALUES (?, 'Guest', ?)")
    .bind(id, GUEST_ROLE)
    .run();
  await createSession(id);

  // Guests outlive their 30-day session by nothing. Cleared opportunistically,
  // like the other short-lived rows, and never allowed to fail an add to cart.
  try {
    await db
      .prepare(
        `DELETE FROM users WHERE role = ? AND created_at < datetime('now', '-31 days')
           AND NOT EXISTS (SELECT 1 FROM orders o WHERE o.user_id = users.id)`
      )
      .bind(GUEST_ROLE)
      .run();
  } catch (error) {
    console.error("guest cleanup failed", error);
  }

  return { id, name: "Guest", phone: null, isGuest: true };
}

/** Turns a guest into a customer once checkout has confirmed their number.
 *
 * If that number already belongs to an account, the order goes to that account
 * and the browser is signed in to it -- the same thing the phone sign-in does,
 * since holding the number is what proves who they are. Otherwise the guest row
 * itself becomes the customer. Returns the id the order belongs to. */
export async function claimGuest(guest: Shopper, phone: string, name: string): Promise<{ id: string; existing: boolean }> {
  const db = await getDB();
  const owner = await db
    .prepare("SELECT id FROM users WHERE phone = ? AND id != ?")
    .bind(phone, guest.id)
    .first<{ id: string }>();

  if (owner) return { id: owner.id, existing: true };

  await db
    .prepare(
      `UPDATE users SET role = 'customer', name = ?, phone = ?, phone_verified = 1,
              updated_at = datetime('now')
       WHERE id = ? AND role = ?`
    )
    .bind(name, phone, guest.id, GUEST_ROLE)
    .run();
  return { id: guest.id, existing: false };
}

/** For use in server actions/pages that require a signed-in user - redirects to login otherwise. */
export async function requireUser(): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/account/login");
  return user;
}
