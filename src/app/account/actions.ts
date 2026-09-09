"use server";

import { redirect } from "next/navigation";
import { getDB } from "@/lib/db";
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

  const db = await getDB();
  const row = await db
    .prepare(`SELECT id, password_hash FROM users WHERE ${method === "email" ? "email" : "phone"} = ?`)
    .bind(identifier)
    .first<{ id: string; password_hash: string | null }>();

  if (!row || !row.password_hash || !(await verifyPassword(password, row.password_hash))) {
    return { error: "Incorrect details. Please try again." };
  }

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
