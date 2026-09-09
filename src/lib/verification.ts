import { cookies } from "next/headers";
import { getDB } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/password";
import { CODE_LENGTH } from "@/lib/checkout";

const VERIFY_COOKIE = "zupona_verify";
const CODE_TTL_MS = 5 * 60 * 1000;
/** How long a confirmed number stays confirmed - long enough to finish the
 * remaining checkout steps without being asked for a second code. */
const VERIFIED_TTL_MS = 30 * 60 * 1000;
const MAX_ATTEMPTS = 5;

interface VerificationRow {
  id: string;
  phone: string;
  code_hash: string;
  attempts: number;
  verified: number;
  expires_at: string;
}

async function readVerification(): Promise<VerificationRow | null> {
  const cookieStore = await cookies();
  const id = cookieStore.get(VERIFY_COOKIE)?.value;
  if (!id) return null;

  const db = await getDB();
  const row = await db
    .prepare("SELECT id, phone, code_hash, attempts, verified, expires_at FROM phone_verifications WHERE id = ?")
    .bind(id)
    .first<VerificationRow>();

  return row ?? null;
}

/**
 * Issues a fresh 6-digit code for `phone`. Only the hash is stored, and the
 * browser only ever holds the row id - so the "verified" flag lives entirely
 * server-side and cannot be forged by editing cookies.
 *
 * There is no SMS gateway wired up yet, so the code is returned to the caller
 * and surfaced in the UI as a demo hint. Swap this for a provider call (and
 * stop returning `code`) once one is available.
 */
export async function issuePhoneCode(phone: string): Promise<{ code: string; expiresAt: string }> {
  const db = await getDB();
  const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000).padStart(CODE_LENGTH, "0");
  const id = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + CODE_TTL_MS).toISOString();

  await db
    .prepare("INSERT INTO phone_verifications (id, phone, code_hash, expires_at) VALUES (?, ?, ?, ?)")
    .bind(id, phone, await hashPassword(code), expiresAt)
    .run();

  const cookieStore = await cookies();
  cookieStore.set(VERIFY_COOKIE, id, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    expires: new Date(Date.now() + CODE_TTL_MS),
  });

  await db.prepare("DELETE FROM phone_verifications WHERE expires_at < datetime('now')").run();

  return { code, expiresAt };
}

export type CodeCheck = { ok: true; phone: string } | { ok: false; error: string };

/** Checks a submitted code against the pending verification and marks it verified. */
export async function confirmPhoneCode(code: string): Promise<CodeCheck> {
  const row = await readVerification();
  if (!row) return { ok: false, error: "Your code expired. Send a new one to continue." };
  if (new Date(row.expires_at).getTime() < Date.now()) {
    return { ok: false, error: "Your code expired. Send a new one to continue." };
  }
  if (row.attempts >= MAX_ATTEMPTS) {
    return { ok: false, error: "Too many attempts. Send a new code to continue." };
  }

  const db = await getDB();
  const digits = code.replace(/\D/g, "");

  if (digits.length !== CODE_LENGTH || !(await verifyPassword(digits, row.code_hash))) {
    await db.prepare("UPDATE phone_verifications SET attempts = attempts + 1 WHERE id = ?").bind(row.id).run();
    return { ok: false, error: "That code doesn't match. Please check and try again." };
  }

  const verifiedUntil = new Date(Date.now() + VERIFIED_TTL_MS);
  await db
    .prepare("UPDATE phone_verifications SET verified = 1, expires_at = ? WHERE id = ?")
    .bind(verifiedUntil.toISOString(), row.id)
    .run();

  const cookieStore = await cookies();
  cookieStore.set(VERIFY_COOKIE, row.id, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    expires: verifiedUntil,
  });

  return { ok: true, phone: row.phone };
}

/** The phone number confirmed in this browser, or null if none is verified yet. */
export async function getVerifiedPhone(): Promise<string | null> {
  const row = await readVerification();
  if (!row || row.verified !== 1) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) return null;
  return row.phone;
}

/** Called once an order is placed so the code can't be replayed. */
export async function clearPhoneVerification(): Promise<void> {
  const cookieStore = await cookies();
  const id = cookieStore.get(VERIFY_COOKIE)?.value;
  if (id) {
    const db = await getDB();
    await db.prepare("DELETE FROM phone_verifications WHERE id = ?").bind(id).run();
  }
  cookieStore.delete(VERIFY_COOKIE);
}
