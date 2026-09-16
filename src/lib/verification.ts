import { cookies } from "next/headers";
import { getDB } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/password";
import { CODE_LENGTH } from "@/lib/checkout";
import { getShopSettings } from "@/lib/shopSettings";
import { gsmSafe, sendSms } from "@/lib/sms";

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

/** The text that arrives on the handset. Kept to one 160-character GSM part:
 * these gateways bill per part, and a unicode character in the store name
 * would cut the limit to 70 and multiply the cost of every code sent. */
function codeMessage(code: string, storeName: string): string {
  const brand = gsmSafe(storeName).slice(0, 20).trim() || "Zupona";
  const minutes = Math.round(CODE_TTL_MS / 60_000);
  return `${code} is your ${brand} verification code. It expires in ${minutes} minutes. Do not share it with anyone.`;
}

export interface IssuedCode {
  /** True when the gateway accepted the message. False means the shopper has
   * no code and is being told so, rather than left staring at empty boxes. */
  delivered: boolean;
  expiresAt: string;
  /** The code itself, and only when `otp_demo_mode` is on. In every other case
   * this is null: a code returned to the browser is a code anyone can request
   * for anyone else's number and read straight out of the response. */
  demoCode: string | null;
  /** Why nothing was sent, when nothing was. Safe to show a shopper. */
  error: string | null;
}

/**
 * Issues a fresh 6-digit code for `phone` and sends it by SMS. Only the hash is
 * stored, and the browser only ever holds the row id - so the "verified" flag
 * lives entirely server-side and cannot be forged by editing cookies.
 *
 * A code that was never delivered is not left lying in the table: the row and
 * the cookie are both removed, so the 30-second resend throttle does not
 * punish a shopper for the gateway's failure, and no half-live verification
 * survives to confuse the next attempt.
 */
export async function issuePhoneCode(phone: string): Promise<IssuedCode> {
  const db = await getDB();
  const settings = await getShopSettings();
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

  const sweep = () => db.prepare("DELETE FROM phone_verifications WHERE expires_at < datetime('now')").run();

  const sent = await sendSms(phone, codeMessage(code, settings.storeName), "otp");

  /* Demo mode is what a shop with no gateway uses to test the flow: the code
   * comes back to the browser and the checkout prints it. It deliberately does
   * *not* survive a gateway being connected -- a live shop that left the
   * toggle on would otherwise hand anyone the code for anyone's number, so a
   * configured gateway wins over the setting rather than the other way round. */
  if (!sent.ok && sent.unconfigured) {
    console.error("sms gateway not configured", { problem: sent.error });
    if (settings.otpDemoMode) {
      await sweep();
      return { delivered: false, expiresAt, demoCode: code, error: null };
    }
  }

  if (!sent.ok) {
    await db.prepare("DELETE FROM phone_verifications WHERE id = ?").bind(id).run();
    cookieStore.delete(VERIFY_COOKIE);
    // The gateway's own words stay in the log. A shopper gets a sentence they
    // can act on, and learns nothing about the shop's credentials from it.
    return {
      delivered: false,
      expiresAt,
      demoCode: null,
      error: "We couldn't send the code just now. Please check the number and try again in a moment.",
    };
  }

  await sweep();
  return { delivered: true, expiresAt, demoCode: null, error: null };
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
