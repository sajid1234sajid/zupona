
/** Payment records, and the boundary a real gateway plugs into.
 *
 * Two rules hold everything else up:
 *
 *  1. Payment state is not order state. An order can be delivered while its
 *     payment is still pending -- that is exactly what cash on delivery is --
 *     and a paid order can still be unfulfilled. They are separate columns and
 *     separate lifecycles.
 *
 *  2. Nothing the browser says can make a payment `paid`. Cash on delivery is
 *     recorded as pending and only a human marking the cash received moves it;
 *     an online payment only moves on a gateway callback this server has
 *     verified. There is no code path from a button click to `paid`. */

export type PaymentStatus =
  | "pending"
  | "initiated"
  | "authorized"
  | "paid"
  | "failed"
  | "cancelled"
  | "refunded"
  | "partially_refunded";

/** Which states a payment may move to. A gateway callback that asks for
 * anything else is rejected rather than applied, so a replayed or out-of-order
 * webhook cannot walk a refunded payment back to paid. */
const ALLOWED_NEXT: Record<PaymentStatus, PaymentStatus[]> = {
  pending: ["initiated", "authorized", "paid", "failed", "cancelled"],
  initiated: ["authorized", "paid", "failed", "cancelled"],
  authorized: ["paid", "failed", "cancelled"],
  paid: ["refunded", "partially_refunded"],
  failed: ["initiated"],
  cancelled: [],
  refunded: [],
  partially_refunded: ["refunded"],
};

export function canTransition(from: PaymentStatus, to: PaymentStatus): boolean {
  if (from === to) return true; // a redelivered webhook saying the same thing
  return ALLOWED_NEXT[from]?.includes(to) ?? false;
}

export interface PaymentProvider {
  id: string;
  label: string;
  /** False until real credentials exist. An unconfigured provider is offered
   * to nobody: the checkout marks it unavailable rather than pretending. */
  configured: boolean;
  /** True when money moves through a gateway rather than at the door. */
  online: boolean;
}

/** Reads provider credentials from the Worker environment. Secrets stay on the
 * server -- nothing here is ever sent to the browser except `configured`. */
export function providerStatus(env: Record<string, unknown> | undefined): PaymentProvider[] {
  const has = (...keys: string[]) => keys.every((key) => Boolean(env?.[key]));

  return [
    { id: "cod", label: "Cash on Delivery", configured: true, online: false },
    {
      id: "bkash",
      label: "bKash",
      configured: has("BKASH_APP_KEY", "BKASH_APP_SECRET", "BKASH_USERNAME", "BKASH_PASSWORD"),
      online: true,
    },
    {
      id: "nagad",
      label: "Nagad",
      configured: has("NAGAD_MERCHANT_ID", "NAGAD_PRIVATE_KEY", "NAGAD_PUBLIC_KEY"),
      online: true,
    },
    {
      id: "card",
      label: "Card",
      configured: has("SSLCZ_STORE_ID", "SSLCZ_STORE_PASSWORD"),
      online: true,
    },
  ];
}

/** The payment row that is written in the same batch as the order.
 *
 * Cash on delivery starts `pending` and stays there until someone confirms the
 * cash arrived. An online payment also starts `pending`: it becomes
 * `initiated` when the gateway session opens and only reaches `paid` through a
 * verified callback. */
export function createPaymentStatement(
  db: D1Database,
  input: {
    orderId: string;
    method: string;
    provider: string;
    amount: number;
    /** Ties the payment to the order attempt, so a retried submission cannot
     * write a second payment for the same order. */
    idempotencyKey: string | null;
  }
): D1PreparedStatement {
  return db
    .prepare(
      `INSERT INTO payment_transactions
        (id, order_id, provider, method, amount, currency, status, initiated_at, idempotency_key)
       VALUES (?, ?, ?, ?, ?, 'BDT', 'pending', datetime('now'), ?)`
    )
    .bind(
      crypto.randomUUID(),
      input.orderId,
      input.provider,
      input.method,
      input.amount,
      input.idempotencyKey ? `${input.idempotencyKey}:payment` : null
    );
}

/** Applies a verified gateway result to a payment.
 *
 * Idempotent by construction: the UPDATE carries the expected current status,
 * so a webhook delivered twice changes one row the first time and zero rows
 * the second. The caller is told which happened and can skip the side effects
 * on a replay rather than sending a second notification. */
export async function applyGatewayResult(
  db: D1Database,
  input: {
    paymentId: string;
    from: PaymentStatus;
    to: PaymentStatus;
    providerRef: string | null;
    failureReason?: string | null;
    rawResponse?: string | null;
  }
): Promise<{ applied: boolean }> {
  if (!canTransition(input.from, input.to)) return { applied: false };

  const result = await db
    .prepare(
      `UPDATE payment_transactions
          SET status = ?, provider_ref = COALESCE(?, provider_ref),
              failure_reason = ?, raw_response = COALESCE(?, raw_response),
              completed_at = CASE WHEN ? IN ('paid','failed','cancelled','refunded')
                                  THEN datetime('now') ELSE completed_at END
        WHERE id = ? AND status = ?`
    )
    .bind(
      input.to,
      input.providerRef,
      input.failureReason ?? null,
      input.rawResponse ?? null,
      input.to,
      input.paymentId,
      input.from
    )
    .run();

  return { applied: result.meta.changes === 1 };
}

/** Which checkout payment methods can actually take money right now.
 *
 * Cash on delivery always can. The online methods depend on gateway
 * credentials living in the Worker environment, and only the answer -- not the
 * credentials -- ever leaves the server. */
export async function availablePaymentMethods(): Promise<string[]> {
  let environment: Record<string, unknown> | undefined;
  try {
    const { env } = await import("cloudflare:workers");
    environment = env as unknown as Record<string, unknown>;
  } catch {
    environment = undefined;
  }

  const providers = providerStatus(environment);
  const online = providers.some((entry) => entry.online && entry.configured);
  const methods = ["cod"];
  if (online) methods.push("online");
  // Bank transfer needs no gateway -- it is an account number and a human
  // checking the statement -- but it does need that account number configured.
  if (environment?.BANK_TRANSFER_DETAILS) methods.push("bank");
  return methods;
}
