"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getDB } from "@/lib/db";
import { rateLimit } from "@/lib/cache";
import { verifyPassword } from "@/lib/password";
import { createSession, destroySession } from "@/lib/session";
import { adminUrl } from "@/lib/panelUrl";
import type { UserRole } from "@/types";

export interface AdminAuthState {
  error?: string;
}

/** Roles allowed through the back-office door. Support staff get in and are
 * then narrowed further by `requireAdmin()` on the pages that write. */
const STAFF_ROLES: UserRole[] = ["admin", "support"];

/** Deliberately the same message for "no such account", "wrong password" and
 * "not a staff account". Distinguishing them would tell an attacker which
 * addresses are real admins. */
const REFUSED = "Those details don't match an admin account.";

/** Records the attempt whatever the outcome. The row is what the account
 * security page reads, and what makes a burst of failures visible after the
 * fact rather than only while it is happening. */
async function recordAttempt(
  identifier: string,
  userId: string | null,
  success: boolean,
  ip: string | null,
  userAgent: string | null
): Promise<void> {
  const db = await getDB();
  await db
    .prepare(
      `INSERT INTO login_attempts (id, identifier, user_id, success, ip_address, user_agent)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .bind(crypto.randomUUID(), identifier, userId, success ? 1 : 0, ip, userAgent)
    .run();
}

export async function logInAdminAction(
  _prevState: AdminAuthState,
  formData: FormData
): Promise<AdminAuthState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Enter your email and password." };
  }

  const headerStore = await headers();
  const ip = headerStore.get("cf-connecting-ip");
  const userAgent = headerStore.get("user-agent");

  // An admin login page on a public subdomain is a standing target, so the
  // throttle is tighter than the storefront's: ten tries per address per
  // fifteen minutes. KV is approximate under a distributed burst, which is
  // acceptable for a brake -- the password check itself is the real boundary.
  const limit = await rateLimit(`admin-login:${email}`, 10, 15 * 60).catch(() => null);
  if (limit && !limit.allowed) {
    return { error: "Too many attempts. Wait a few minutes and try again." };
  }

  const db = await getDB();
  const row = await db
    .prepare("SELECT id, password_hash, role, status FROM users WHERE email = ?")
    .bind(email)
    .first<{ id: string; password_hash: string | null; role: UserRole; status: string }>();

  if (!row || !row.password_hash) {
    await recordAttempt(email, row?.id ?? null, false, ip, userAgent);
    return { error: REFUSED };
  }

  if (!(await verifyPassword(password, row.password_hash))) {
    await recordAttempt(email, row.id, false, ip, userAgent);
    return { error: REFUSED };
  }

  if (!STAFF_ROLES.includes(row.role)) {
    await recordAttempt(email, row.id, false, ip, userAgent);
    return { error: REFUSED };
  }

  if (row.status !== "active") {
    await recordAttempt(email, row.id, false, ip, userAgent);
    return { error: "This account has been suspended." };
  }

  await recordAttempt(email, row.id, true, ip, userAgent);
  await createSession(row.id);
  redirect(await adminUrl("/admin"));
}

export async function logOutAdminAction(): Promise<void> {
  await destroySession();
  redirect(await adminUrl("/admin/login"));
}
