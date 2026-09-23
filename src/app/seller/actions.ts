"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getDB } from "@/lib/db";
import { rateLimit } from "@/lib/cache";
import { hashPassword, verifyPassword } from "@/lib/password";
import { createSession, destroySession, getCurrentUser } from "@/lib/session";
import {
  applyAsSeller,
  getSeller,
  getSellerForUser,
  requireApprovedSeller,
  setSellerView,
  updateSellerProfile,
} from "@/lib/sellers";
import { requireAdmin } from "@/lib/admin";
import { sellerUrl } from "@/lib/panelUrl";

export interface SellerAuthState {
  error?: string;
}

export interface StoreFormState {
  error?: string;
  success?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+?\d{7,15}$/;

/** How a seller is paid out. Anything else is a typed-in value we would not
 * know how to send money to. */
const PAYOUT_METHODS = new Set(["bank", "bkash", "nagad"]);

/** Deliberately the same message for "no such account" and "wrong password",
 * so the form never confirms which addresses exist. */
const REFUSED = "Those details don't match an account.";

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "store"
  );
}

/** A store URL nobody else holds. Store names collide far more often than
 * product names do -- half the market is called "Fashion House" -- so this
 * runs on every application rather than only when a clash is suspected. */
async function uniqueSlug(base: string): Promise<string> {
  const db = await getDB();
  let candidate = base;

  for (let attempt = 2; attempt < 60; attempt += 1) {
    const clash = await db
      .prepare("SELECT id FROM sellers WHERE slug = ?")
      .bind(candidate)
      .first<{ id: string }>();
    if (!clash) return candidate;
    candidate = `${base}-${attempt}`;
  }

  return `${base}-${crypto.randomUUID().slice(0, 6)}`;
}

/** Records the attempt whatever the outcome, the same way the other two doors
 * do. The row is what makes a burst of failures visible after the fact. */
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

/* -------------------------------------------------------------------------- */
/* The door                                                                   */
/* -------------------------------------------------------------------------- */

/** Signs a seller in.
 *
 * This checks the password and nothing about stores: an applicant whose shop
 * is still pending has to get in to read that, and a shopper who has decided
 * to start selling signs in here before applying. Which of those three screens
 * they land on is the layout's decision, not this one's. */
export async function logInSellerAction(
  _prevState: SellerAuthState,
  formData: FormData
): Promise<SellerAuthState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) return { error: "Enter your email and password." };

  const limit = await rateLimit(`seller-login:${email}`, 10, 15 * 60).catch(() => null);
  if (limit && !limit.allowed) {
    return { error: "Too many attempts. Wait a few minutes and try again." };
  }

  const db = await getDB();
  const row = await db
    .prepare("SELECT id, password_hash, role, status FROM users WHERE email = ?")
    .bind(email)
    .first<{ id: string; password_hash: string | null; role: string; status: string }>();

  // A guest row is created by the first add to cart from a signed-out browser.
  // It is a real `users` row with no password, and it has no business signing
  // in anywhere -- so it is refused here by name rather than only by the
  // missing hash.
  if (!row || !row.password_hash || row.role === "guest") {
    await recordAttempt(email, row?.id ?? null, false);
    return { error: REFUSED };
  }

  if (!(await verifyPassword(password, row.password_hash))) {
    await recordAttempt(email, row.id, false);
    return { error: REFUSED };
  }

  if (row.status !== "active") {
    await recordAttempt(email, row.id, false);
    return { error: "This account has been suspended." };
  }

  await recordAttempt(email, row.id, true);
  await createSession(row.id);
  redirect(await sellerUrl("/seller"));
}

export async function logOutSellerAction(): Promise<void> {
  await destroySession();
  redirect(await sellerUrl("/seller/login"));
}

/* -------------------------------------------------------------------------- */
/* Applying to sell                                                           */
/* -------------------------------------------------------------------------- */

/** Registers a store application, creating the owner's account first if they
 * arrived without one.
 *
 * Both halves live in one action because they are one decision for the person
 * filling the form: someone who has decided to sell on Zupona should not have
 * to make an account, find their way back and then apply. A visitor who is
 * already signed in never sees the account fields, and they are ignored here
 * if they arrive anyway. */
export async function applySellerAction(
  _prevState: SellerAuthState,
  formData: FormData
): Promise<SellerAuthState> {
  const storeName = String(formData.get("storeName") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const payoutMethod = String(formData.get("payoutMethod") ?? "").trim();
  const accountName = String(formData.get("accountName") ?? "").trim();
  const accountNumber = String(formData.get("accountNumber") ?? "").trim();

  if (storeName.length < 3) return { error: "Enter your store name." };
  if (!PAYOUT_METHODS.has(payoutMethod)) return { error: "Choose how you want to be paid." };
  if (!accountName) return { error: "Enter the account holder's name." };
  if (!accountNumber) return { error: "Enter the account number." };

  const db = await getDB();

  // Held as a bare id rather than re-reading the session after signing the new
  // account in: `getCurrentUser` memoises per request, so a second call would
  // hand back the same "signed out" answer it gave at the top of this action.
  let userId = (await getCurrentUser())?.id ?? null;

  if (!userId) {
    const name = String(formData.get("name") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim().toLowerCase();
    const phone = String(formData.get("phone") ?? "").replace(/[^\d+]/g, "");
    const password = String(formData.get("password") ?? "");

    if (!name) return { error: "Enter your name." };
    if (!EMAIL_RE.test(email)) return { error: "Enter a valid email address." };
    if (!PHONE_RE.test(phone)) return { error: "Enter a valid mobile number." };
    if (password.length < 8) return { error: "Password must be at least 8 characters." };

    const limit = await rateLimit(`seller-apply:${email}`, 10, 15 * 60).catch(() => null);
    if (limit && !limit.allowed) {
      return { error: "Too many attempts. Wait a few minutes and try again." };
    }

    const taken = await db
      .prepare("SELECT id FROM users WHERE email = ?")
      .bind(email)
      .first<{ id: string }>();
    if (taken) {
      return { error: "An account with this email already exists. Sign in first, then apply." };
    }

    const id = crypto.randomUUID();
    try {
      await db
        .prepare("INSERT INTO users (id, name, email, phone, password_hash) VALUES (?, ?, ?, ?, ?)")
        .bind(id, name, email, phone, await hashPassword(password))
        .run();
    } catch {
      return { error: "That account already exists. Sign in first, then apply." };
    }

    await createSession(id);
    userId = id;
  }

  // Someone who already applied is sent to read their status rather than told
  // off -- a second submission is almost always a refresh or an impatient
  // second tap, not an attempt to own two stores.
  const existing = await getSellerForUser(userId);
  if (existing) redirect(await sellerUrl("/seller/pending"));

  try {
    await applyAsSeller({
      userId,
      storeName,
      slug: await uniqueSlug(slugify(storeName)),
      description: description || null,
      payoutMethod,
      payoutDetails: { accountName, accountNumber },
    });
  } catch {
    return { error: "A store already exists for this account. Sign in to see it." };
  }

  redirect(await sellerUrl("/seller/pending"));
}

/* -------------------------------------------------------------------------- */
/* Working on a store as an admin                                             */
/* -------------------------------------------------------------------------- */

/** Points the admin's Seller Center at a store and opens it.
 *
 * Guarded by `requireAdmin()` rather than by a seller guard, because this is
 * the one action in the panel only the platform can take: a seller has no
 * store to choose between, and nothing here would be safe if one could. */
export async function viewStoreAction(formData: FormData): Promise<void> {
  await requireAdmin();

  const sellerId = String(formData.get("sellerId") ?? "");
  if (!sellerId) return;

  // Looked up rather than taken on trust, so a made-up id cannot leave the
  // panel pointed at a store that does not exist.
  const seller = await getSeller(sellerId);
  if (!seller) return;

  await setSellerView(sellerId);
  redirect(await sellerUrl("/seller"));
}

/* -------------------------------------------------------------------------- */
/* Store profile                                                              */
/* -------------------------------------------------------------------------- */

/** Edits the parts of the storefront a seller owns. The store's URL is not
 * among them: changing a slug breaks every link and every share of the shop,
 * so it is set once at application time and changed only by an admin. */
export async function updateStoreAction(
  _prevState: StoreFormState,
  formData: FormData
): Promise<StoreFormState> {
  const { seller } = await requireApprovedSeller();

  const storeName = String(formData.get("storeName") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();

  if (storeName.length < 3) return { error: "Enter your store name." };

  await updateSellerProfile(seller.id, {
    storeName,
    description: description || null,
  });

  return { success: "Store details saved." };
}
