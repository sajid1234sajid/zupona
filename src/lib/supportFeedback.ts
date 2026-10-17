/** Help-centre feedback and contact-form messages (migration 0032). */

import { cookies, headers } from "next/headers";
import { getDB } from "@/lib/db";
import { validVisitorId, VISITOR_COOKIE } from "@/lib/activity";
import { rateLimit } from "@/lib/cache";
import { normalizeBdPhone } from "@/lib/checkout";

/** Who is voting: the visitor cookie, or failing that the address, so one
 * browser counts once per question. */
async function voter(): Promise<string> {
  const [jar, list] = await Promise.all([cookies(), headers()]);
  return (
    validVisitorId(jar.get(VISITOR_COOKIE)?.value) ??
    `ip:${list.get("cf-connecting-ip") ?? list.get("x-forwarded-for") ?? "unknown"}`
  );
}

export async function recordFaqVote(question: string, helpful: boolean): Promise<void> {
  const text = question.trim().slice(0, 300);
  if (!text) return;
  const db = await getDB();
  await db
    .prepare(
      `INSERT INTO faq_feedback (question, visitor_id, helpful) VALUES (?, ?, ?)
       ON CONFLICT (question, visitor_id) DO UPDATE SET helpful = excluded.helpful, created_at = datetime('now')`
    )
    .bind(text, await voter(), helpful ? 1 : 0)
    .run();
}

export interface FaqScore {
  question: string;
  yes: number;
  no: number;
}

/** Answers with votes, least helpful first: the ones worth rewriting. */
export async function faqScores(limit = 20): Promise<FaqScore[]> {
  const db = await getDB();
  const { results } = await db
    .prepare(
      `SELECT question, SUM(helpful) AS yes, SUM(1 - helpful) AS no FROM faq_feedback
       GROUP BY question ORDER BY (SUM(1 - helpful) * 1.0 / COUNT(*)) DESC, COUNT(*) DESC LIMIT ?`
    )
    .bind(limit)
    .all<FaqScore>();
  return results;
}

export interface ContactInput {
  name: string;
  phone: string;
  orderNumber: string;
  message: string;
}

export async function saveContactMessage(
  userId: string | null,
  input: ContactInput
): Promise<{ ok: true } | { ok: false; error: string }> {
  const name = input.name.trim().slice(0, 80);
  const phone = normalizeBdPhone(input.phone);
  const orderNumber = input.orderNumber.trim().toUpperCase().slice(0, 20) || null;
  const message = input.message.trim().slice(0, 2000);
  if (!name) return { ok: false, error: "Please enter your name." };
  if (!phone) return { ok: false, error: "Enter your mobile number, like 01712345678, so we can reply." };
  if (message.length < 10) return { ok: false, error: "Tell us a little more, so we can help." };

  const list = await headers();
  const ip = list.get("cf-connecting-ip") ?? "unknown";
  const limit = await rateLimit(`contact:${ip}`, 5, 3600).catch(() => null);
  if (limit && !limit.allowed) return { ok: false, error: "Too many messages for now. Please try WhatsApp." };

  const db = await getDB();
  await db
    .prepare(
      `INSERT INTO contact_messages (id, user_id, name, phone, order_number, message) VALUES (?, ?, ?, ?, ?, ?)`
    )
    .bind(crypto.randomUUID(), userId, name, phone, orderNumber, message)
    .run();
  return { ok: true };
}

export interface ContactMessage {
  id: string;
  name: string;
  phone: string;
  orderNumber: string | null;
  message: string;
  status: "new" | "handled";
  createdAt: string;
  handledAt: string | null;
  userId: string | null;
}

export async function listContactMessages(status: "new" | "handled" | "all" = "new"): Promise<ContactMessage[]> {
  const db = await getDB();
  const where = status === "all" ? "" : "WHERE status = ?";
  const statement = db.prepare(
    `SELECT id, name, phone, order_number AS orderNumber, message, status, created_at AS createdAt,
            handled_at AS handledAt, user_id AS userId
     FROM contact_messages ${where} ORDER BY created_at DESC LIMIT 200`
  );
  const { results } = await (status === "all" ? statement : statement.bind(status)).all<ContactMessage>();
  return results;
}

export async function countNewContactMessages(): Promise<number> {
  const db = await getDB();
  const row = await db
    .prepare("SELECT COUNT(*) AS n FROM contact_messages WHERE status = 'new'")
    .first<{ n: number }>()
    .catch(() => null);
  return row?.n ?? 0;
}

export async function markContactHandled(id: string, staffId: string, handled: boolean): Promise<void> {
  const db = await getDB();
  await db
    .prepare(
      `UPDATE contact_messages SET status = ?, handled_by = ?, handled_at = CASE WHEN ? = 'handled' THEN datetime('now') END
       WHERE id = ?`
    )
    .bind(handled ? "handled" : "new", handled ? staffId : null, handled ? "handled" : "new", id)
    .run();
}
