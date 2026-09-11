import { getDB } from "@/lib/db";
import { applyGatewayResult, providerStatus, type PaymentStatus } from "@/lib/payments";

/** Payment callbacks from a gateway.
 *
 * This is the only way a payment becomes `paid`. The browser cannot do it:
 * nothing in the checkout writes that state, and this route refuses anything
 * it has not verified itself.
 *
 * Five checks, in order, before a single row is touched:
 *
 *   1. The provider is configured. An unconfigured gateway has no secret to
 *      verify against, so a callback claiming to be from one is refused
 *      outright rather than trusted.
 *   2. The signature matches an HMAC of the exact bytes received, compared in
 *      constant time. Anyone can POST here; only the gateway can sign.
 *   3. The payment exists and belongs to the order the callback names.
 *   4. The amount and currency match what we recorded when the order was
 *      placed. A callback that says a 3,079 taka order was paid with 1 taka is
 *      a callback we reject.
 *   5. The transition is legal. A replay that tries to walk a refunded payment
 *      back to paid is refused by the state machine.
 *
 * Idempotent throughout: the update is conditional on the status we read, so a
 * webhook delivered twice changes one row the first time and none the second,
 * and the second delivery still answers 200 -- gateways retry on anything else,
 * and a retry storm helps nobody. */

const STATUS_MAP: Record<string, PaymentStatus> = {
  success: "paid",
  completed: "paid",
  paid: "paid",
  authorized: "authorized",
  initiated: "initiated",
  failed: "failed",
  cancelled: "cancelled",
  refunded: "refunded",
};

/** Constant-time compare, so a wrong signature cannot be found a byte at a
 * time by measuring how long the rejection takes. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function hmacHex(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return [...new Uint8Array(signature)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ provider: string }> }
): Promise<Response> {
  const { provider } = await params;
  const { env } = await import("cloudflare:workers");
  const environment = env as unknown as Record<string, unknown>;

  const known = providerStatus(environment).find((entry) => entry.id === provider);
  if (!known || !known.online) {
    return Response.json({ error: "Unknown payment provider." }, { status: 404 });
  }
  if (!known.configured) {
    // No credentials means no secret to verify against, so there is no such
    // thing as a trustworthy callback for this provider yet.
    return Response.json({ error: "Provider is not configured." }, { status: 503 });
  }

  const secret = environment[`${provider.toUpperCase()}_WEBHOOK_SECRET`];
  if (typeof secret !== "string" || !secret) {
    return Response.json({ error: "Provider webhook secret is not set." }, { status: 503 });
  }

  // The raw bytes are what was signed; parsing first and re-serialising would
  // change them and break every signature.
  const raw = await request.text();
  const presented = request.headers.get("x-signature") ?? "";
  if (!safeEqual(presented, await hmacHex(secret, raw))) {
    return Response.json({ error: "Bad signature." }, { status: 401 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Malformed payload." }, { status: 400 });
  }

  const orderId = String(payload.orderId ?? "");
  const reference = payload.transactionId == null ? null : String(payload.transactionId);
  const amount = Number(payload.amount);
  const currency = String(payload.currency ?? "BDT");
  const next = STATUS_MAP[String(payload.status ?? "").toLowerCase()];

  if (!orderId || !next || !Number.isFinite(amount)) {
    return Response.json({ error: "Missing orderId, status or amount." }, { status: 400 });
  }

  const db = await getDB();
  const payment = await db
    .prepare(
      `SELECT id, status, amount, currency FROM payment_transactions
        WHERE order_id = ? AND provider = ? ORDER BY rowid DESC LIMIT 1`
    )
    .bind(orderId, provider)
    .first<{ id: string; status: PaymentStatus; amount: number; currency: string }>();

  if (!payment) {
    return Response.json({ error: "No payment for that order." }, { status: 404 });
  }
  if (payment.amount !== Math.round(amount) || payment.currency !== currency) {
    return Response.json({ error: "Amount or currency does not match." }, { status: 409 });
  }

  const { applied } = await applyGatewayResult(db, {
    paymentId: payment.id,
    from: payment.status,
    to: next,
    providerRef: reference,
    failureReason: next === "failed" ? String(payload.reason ?? "Declined by gateway") : null,
    rawResponse: raw.slice(0, 4000),
  });

  // A payment that is settled tells the order row, which is what the admin and
  // the customer read. Order status is left alone on purpose: paying for
  // something does not pack or ship it.
  if (applied && (next === "paid" || next === "failed" || next === "refunded")) {
    await db
      .prepare("UPDATE orders SET payment_status = ? WHERE id = ?")
      .bind(next, orderId)
      .run();
  }

  // `applied: false` is a replay or an illegal transition, and both are fine to
  // acknowledge -- the gateway has nothing useful to do with a retry.
  return Response.json({ ok: true, applied });
}
