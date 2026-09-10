"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getDB } from "@/lib/db";
import { rateLimit } from "@/lib/cache";
import { hashPassword, verifyPassword } from "@/lib/password";
import { createSession, destroySession, requireUser } from "@/lib/session";

export interface AuthActionState {
  error?: string;
  success?: boolean;
}

export interface ProfileActionState {
  error?: string;
  success?: boolean;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+?\d{7,15}$/;

function readMethod(formData: FormData): "email" | "phone" {
  return formData.get("method") === "phone" ? "phone" : "email";
}

function normalizePhone(value: string): string {
  return value.replace(/[^\d+]/g, "");
}

/** Records the attempt whatever the outcome, the same way the admin door does.
 * The row is what makes a burst of failures visible after the fact. */
async function recordAttempt(identifier: string, userId: string | null, success: boolean) {
  const headerStore = await headers();
  const db = await getDB();
  await db
    .prepare(
      `INSERT INTO login_attempts (id, identifier, user_id, success, ip_address, user_agent)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .bind(
      crypto.randomUUID(),
      identifier,
      userId,
      success ? 1 : 0,
      headerStore.get("cf-connecting-ip"),
      headerStore.get("user-agent")
    )
    .run();
}

/** A brake on credential stuffing. Looser than the admin door's ten per
 * fifteen minutes, because a shopper mistyping their own password is far more
 * common than an attack, and being locked out of a shop is worse than a slow
 * attacker. KV being unavailable never blocks a sign-in: the password check
 * is the real boundary, this only slows a burst down. */
async function throttle(bucket: string, identifier: string): Promise<boolean> {
  const limit = await rateLimit(`${bucket}:${identifier}`, 20, 15 * 60).catch(() => null);
  return limit ? limit.allowed : true;
}

export async function signUpAction(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const method = readMethod(formData);
  const identifierRaw = String(formData.get("identifier") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!identifierRaw) {
    return { error: method === "phone" ? "Enter your mobile number." : "Enter your email address." };
  }
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }

  let email: string | null = null;
  let phone: string | null = null;
  let name: string;

  if (method === "email") {
    if (!EMAIL_RE.test(identifierRaw)) return { error: "Enter a valid email address." };
    email = identifierRaw.toLowerCase();
    name = email.split("@")[0];
  } else {
    const normalized = normalizePhone(identifierRaw);
    if (!PHONE_RE.test(normalized)) return { error: "Enter a valid mobile number." };
    phone = normalized;
    name = normalized;
  }

  if (!(await throttle("signup", (email ?? phone) as string))) {
    return { error: "Too many attempts. Wait a few minutes and try again." };
  }

  const db = await getDB();
  const existing = await db
    .prepare(`SELECT id FROM users WHERE ${method === "email" ? "email" : "phone"} = ?`)
    .bind(method === "email" ? email : phone)
    .first<{ id: string }>();

  if (existing) {
    return {
      error:
        method === "email"
          ? "An account with this email already exists. Try logging in instead."
          : "An account with this number already exists. Try logging in instead.",
    };
  }

  const id = crypto.randomUUID();
  const passwordHash = await hashPassword(password);

  try {
    await db
      .prepare("INSERT INTO users (id, name, email, phone, password_hash) VALUES (?, ?, ?, ?, ?)")
      .bind(id, name, email, phone, passwordHash)
      .run();
  } catch {
    return { error: "That account already exists. Try logging in instead." };
  }

  await createSession(id);
  redirect("/account");
}

export async function logInAction(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const method = readMethod(formData);
  const identifierRaw = String(formData.get("identifier") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!identifierRaw || !password) {
    return { error: "Enter your details to continue." };
  }

  const identifier = method === "email" ? identifierRaw.toLowerCase() : normalizePhone(identifierRaw);

  if (!(await throttle("login", identifier))) {
    return { error: "Too many attempts. Wait a few minutes and try again." };
  }

  const db = await getDB();
  const row = await db
    .prepare(`SELECT id, password_hash FROM users WHERE ${method === "email" ? "email" : "phone"} = ?`)
    .bind(identifier)
    .first<{ id: string; password_hash: string | null }>();

  if (!row || !row.password_hash || !(await verifyPassword(password, row.password_hash))) {
    await recordAttempt(identifier, row?.id ?? null, false);
    return { error: "Incorrect details. Please try again." };
  }

  await recordAttempt(identifier, row.id, true);
  await createSession(row.id);
  redirect("/account");
}

export async function logOutAction(): Promise<void> {
  await destroySession();
  redirect("/account");
}

export async function updateProfileAction(
  _prevState: ProfileActionState,
  formData: FormData
): Promise<ProfileActionState> {
  const user = await requireUser();
  const name = String(formData.get("name") ?? "").trim();
  const phoneRaw = String(formData.get("phone") ?? "").trim();
  const avatarUrlRaw = String(formData.get("avatarUrl") ?? "").trim();

  if (!name) return { error: "Enter your name." };

  const phone = phoneRaw ? normalizePhone(phoneRaw) : null;
  if (phone && !PHONE_RE.test(phone)) return { error: "Enter a valid mobile number." };

  const avatarUrl = avatarUrlRaw || null;
  if (avatarUrl && !/^https?:\/\//.test(avatarUrl)) {
    return { error: "Avatar URL must start with http:// or https://" };
  }

  const db = await getDB();

  if (phone) {
    const existing = await db
      .prepare("SELECT id FROM users WHERE phone = ? AND id != ?")
      .bind(phone, user.id)
      .first<{ id: string }>();
    if (existing) return { error: "That mobile number is already in use." };
  }

  await db
    .prepare("UPDATE users SET name = ?, phone = ?, avatar_url = ? WHERE id = ?")
    .bind(name, phone, avatarUrl, user.id)
    .run();

  redirect("/account");
}

export async function changePasswordAction(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const user = await requireUser();
  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");

  if (newPassword.length < 8) {
    return { error: "New password must be at least 8 characters." };
  }

  const db = await getDB();
  const row = await db
    .prepare("SELECT password_hash FROM users WHERE id = ?")
    .bind(user.id)
    .first<{ password_hash: string | null }>();

  if (row?.password_hash) {
    if (!currentPassword || !(await verifyPassword(currentPassword, row.password_hash))) {
      return { error: "Your current password is incorrect." };
    }
  }

  const passwordHash = await hashPassword(newPassword);
  await db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").bind(passwordHash, user.id).run();

  return { success: true };
}
