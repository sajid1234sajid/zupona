import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getDB } from "@/lib/db";
import type { AuthUser, UserRole } from "@/types";

const SESSION_COOKIE = "zupona_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

interface UserRow {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
  points: number;
  role: UserRole;
  created_at: string;
}

function toAuthUser(row: UserRow): AuthUser {
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

export async function createSession(userId: string): Promise<void> {
  const db = await getDB();
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
 * decision takes effect on the very next request. */
export async function getCurrentUser(): Promise<AuthUser | null> {
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

  if (!row) return null;
  return toAuthUser(row);
}

/** For use in server actions/pages that require a signed-in user - redirects to login otherwise. */
export async function requireUser(): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/account/login");
  return user;
}
