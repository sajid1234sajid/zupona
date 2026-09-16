/** The SMS gateway.
 *
 * Bangladeshi bulk-SMS providers all sell the same thing -- an API key, an
 * approved sender mask, one HTTP call per message -- and then disagree about
 * every detail of how to ask for it: form posts against JSON bodies, `error: 0`
 * against `response_code: 202`, `msg` against `Message`. So each one gets a
 * small adapter here and the rest of the app only ever sees `sendSms`.
 *
 * Credentials are Worker secrets, never `site_settings` rows. That table is
 * readable by every admin and editable from a form; a key that spends money on
 * every request is not an admin preference. The one SMS value an admin may
 * edit is the sender mask, which is public by definition -- it is printed on
 * every message that arrives.
 *
 * Nothing in here throws. A gateway that is down, slow or refusing the key is
 * an ordinary outcome of sending a message, not an exception: it comes back as
 * `{ ok: false }` and the caller decides what the shopper is told. */

import { getDB } from "@/lib/db";
import { getShopSettings } from "@/lib/shopSettings";
import { cached } from "@/lib/cache";

export type SmsProviderId = "smsnetbd" | "bulksmsbd" | "mimsms" | "custom";

interface ProviderSpec {
  label: string;
  /** Where messages go when `SMS_ENDPOINT` is not set. */
  endpoint: string;
  /** What this provider needs beyond `SMS_API_KEY` before it can send. */
  requires: ("senderId" | "username" | "endpoint")[];
}

const PROVIDERS: Record<SmsProviderId, ProviderSpec> = {
  // sms.net.bd (Alpha Net) -- the "SMS BD" most shops here mean. A masked
  // sender is optional: with none set the message goes out on the shared
  // non-masking route, which is exactly what OTP traffic wants.
  smsnetbd: {
    label: "sms.net.bd",
    endpoint: "https://api.sms.net.bd/sendsms",
    requires: [],
  },
  // bulksmsbd.net -- refuses any request without an approved sender id.
  bulksmsbd: {
    label: "BulkSMSBD",
    endpoint: "https://bulksmsbd.net/api/smsapi",
    requires: ["senderId"],
  },
  // MiMSMS -- JSON, and authenticates on username *and* key.
  mimsms: {
    label: "MiMSMS",
    endpoint: "https://api.mimsms.com/api/SmsSending/SMS",
    requires: ["senderId", "username"],
  },
  // Any reseller that hands you a plain GET URL. Set SMS_ENDPOINT to it with
  // {api_key} {to} {sender_id} {message} where the values belong, e.g.
  //   https://example.com/api?key={api_key}&to={to}&text={message}
  custom: {
    label: "Custom URL",
    endpoint: "",
    requires: ["endpoint"],
  },
};

const DEFAULT_PROVIDER: SmsProviderId = "smsnetbd";
const REQUEST_TIMEOUT_MS = 10_000;

export interface SmsConfig {
  provider: SmsProviderId;
  apiKey: string;
  senderId: string | null;
  username: string | null;
  endpoint: string;
}

/** What the admin panel is allowed to know: whether messages can go out, and
 * what is missing if they cannot. Never the key itself. */
export interface SmsGatewayStatus {
  configured: boolean;
  provider: SmsProviderId;
  providerLabel: string;
  senderId: string | null;
  /** Human-readable reason the gateway cannot send, or null when it can. */
  problem: string | null;
}

async function readEnv(): Promise<Record<string, unknown> | undefined> {
  try {
    const { env } = await import("cloudflare:workers");
    return env as unknown as Record<string, unknown>;
  } catch {
    // Outside the Workers runtime there are no secrets to read, which reads
    // the same as an unconfigured gateway.
    return undefined;
  }
}

function text(value: unknown): string | null {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed.length > 0 ? trimmed : null;
}

function resolveProvider(raw: unknown): SmsProviderId {
  const id = text(raw)?.toLowerCase().replace(/[^a-z]/g, "");
  return id && id in PROVIDERS ? (id as SmsProviderId) : DEFAULT_PROVIDER;
}

/** The gateway as configured, or a reason it is not usable.
 *
 * `senderId` falls back to the `sms_sender_id` setting so a shop that gets a
 * new mask approved can switch to it from the admin panel rather than by
 * redeploying. It is read here rather than passed in because every caller
 * would otherwise have to remember to. */
export async function getSmsConfig(): Promise<
  { ok: true; config: SmsConfig } | { ok: false; provider: SmsProviderId; problem: string }
> {
  const env = await readEnv();
  const provider = resolveProvider(env?.SMS_PROVIDER);
  const spec = PROVIDERS[provider];

  const apiKey = text(env?.SMS_API_KEY);
  if (!apiKey) {
    return { ok: false, provider, problem: "SMS_API_KEY is not set on the Worker." };
  }

  let senderId = text(env?.SMS_SENDER_ID);
  if (!senderId) {
    try {
      senderId = text((await getShopSettings()).smsSenderId);
    } catch {
      // No database to read the mask from -- the secret's value, or none, stands.
    }
  }

  const username = text(env?.SMS_USERNAME);
  const endpoint = text(env?.SMS_ENDPOINT) ?? spec.endpoint;

  const missing: string[] = [];
  if (spec.requires.includes("senderId") && !senderId) {
    missing.push(`${spec.label} needs an approved sender id — set SMS_SENDER_ID or fill in the sender mask below`);
  }
  if (spec.requires.includes("username") && !username) {
    missing.push(`${spec.label} needs SMS_USERNAME as well as the API key`);
  }
  if (spec.requires.includes("endpoint") && !text(env?.SMS_ENDPOINT)) {
    missing.push("A custom gateway needs SMS_ENDPOINT — the full URL template to call");
  }
  if (missing.length > 0) {
    return { ok: false, provider, problem: `${missing.join(". ")}.` };
  }

  return { ok: true, config: { provider, apiKey, senderId, username, endpoint } };
}

export async function smsGatewayStatus(): Promise<SmsGatewayStatus> {
  const resolved = await getSmsConfig();

  if (!resolved.ok) {
    return {
      configured: false,
      provider: resolved.provider,
      providerLabel: PROVIDERS[resolved.provider].label,
      senderId: null,
      problem: resolved.problem,
    };
  }

  return {
    configured: true,
    provider: resolved.config.provider,
    providerLabel: PROVIDERS[resolved.config.provider].label,
    senderId: resolved.config.senderId,
    problem: null,
  };
}

/* -------------------------------------------------------------------------- */
/* Balance                                                                    */
/* -------------------------------------------------------------------------- */

/** Where each provider reports what is left. Absent for the ones that offer no
 * such endpoint, in which case the admin panel says nothing rather than
 * inventing a number. */
const BALANCE_ENDPOINT: Partial<Record<SmsProviderId, string>> = {
  smsnetbd: "https://api.sms.net.bd/user/balance",
  bulksmsbd: "https://bulksmsbd.net/api/getBalanceApi",
};

export interface SmsBalance {
  /** Whole Taka, rounded down -- a gateway reporting "2.1000" has two. */
  amount: number;
  /** When the credit expires, if the provider says so. */
  validUntil: string | null;
}

/** What is left at the gateway, or null when it cannot be read.
 *
 * Worth a place on the page because running out is silent and total: the
 * gateway starts refusing, no code reaches anyone, and every checkout stops at
 * the verification step. A shop finds that out from its customers rather than
 * from its own admin panel.
 *
 * Cached, since this runs on an admin page load and the figure moves a few
 * poisha at a time. Never throws: a gateway that will not answer is one less
 * line on the page, not a broken page.
 */
export async function smsBalance(): Promise<SmsBalance | null> {
  const resolved = await getSmsConfig();
  if (!resolved.ok) return null;

  const { config } = resolved;
  const url = BALANCE_ENDPOINT[config.provider];
  if (!url) return null;

  // A custom endpoint means the shop is pointed at something other than the
  // provider's own API -- a reseller, or a stand-in during testing -- and
  // asking the real host for a balance would report a different account.
  const env = await readEnv();
  if (text(env?.SMS_ENDPOINT)) return null;

  return cached(
    `sms:balance:${config.provider}`,
    async () => {
      const response = await post(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ api_key: config.apiKey }).toString(),
      });
      if (!response.ok) return null;

      const json = parseJson(response.body);
      if (!json) return null;

      // sms.net.bd nests it under `data`; BulkSMSBD returns it at the top.
      const data = (json.data ?? json) as Record<string, unknown>;
      const raw = Number.parseFloat(String(data.balance ?? ""));
      if (!Number.isFinite(raw)) return null;

      return { amount: Math.floor(raw), validUntil: text(data.validity) };
    },
    300
  );
}

/* -------------------------------------------------------------------------- */
/* Message shaping                                                            */
/* -------------------------------------------------------------------------- */

/** `+8801712345678` -> `8801712345678`, which is what every gateway here wants.
 * Returns null for anything that is not a Bangladeshi mobile number, so a
 * malformed number is refused before it is paid for. */
function toMsisdn(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  const local = digits.length === 13 && digits.startsWith("880") ? digits.slice(2) : digits;
  return /^01[3-9]\d{8}$/.test(local) ? `88${local}` : null;
}

/** Everything outside the GSM 03.38 alphabet turns a 160-character message
 * into a 70-character unicode one, which these gateways bill at several times
 * the rate and split into more parts. Verification texts are ASCII by nature,
 * so anything that isn't is dropped rather than silently tripling the bill. */
export function gsmSafe(input: string): string {
  return input
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/[^\x20-\x7E\r\n]/g, "")
    .trim();
}

/** Logged and reported as `+88017******78`: enough to match a message against a
 * shopper's complaint, not enough to make the log a list of phone numbers. */
export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 6) return "***";
  return `${digits.slice(0, 7)}******${digits.slice(-2)}`;
}

/* -------------------------------------------------------------------------- */
/* Provider adapters                                                          */
/* -------------------------------------------------------------------------- */

export type SmsResult =
  | { ok: true; reference: string | null }
  | {
      ok: false;
      error: string;
      /** True when nothing was even attempted because the shop has no gateway.
       * Distinguished from a refusal so the caller can fall back to demo mode
       * on a shop that has not connected one yet, and never on a shop that
       * has. */
      unconfigured?: boolean;
    };

async function post(
  url: string,
  init: RequestInit
): Promise<{ ok: true; status: number; body: string } | { ok: false; error: string }> {
  try {
    const response = await fetch(url, { ...init, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    return { ok: true, status: response.status, body: (await response.text()).slice(0, 2000) };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: /timeout|abort/i.test(message) ? "The gateway did not answer in time." : message };
  }
}

/** Providers answer with JSON, except when they answer with an HTML error
 * page. Parsing is therefore allowed to fail without that being a crash. */
function parseJson(body: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(body);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** sms.net.bd: form post, `{"error":0,"msg":"...","data":{"request_id":N}}`.
 * Anything other than `error: 0` is a refusal, and `msg` says why. */
async function sendViaSmsNetBd(config: SmsConfig, to: string, message: string): Promise<SmsResult> {
  const form = new URLSearchParams({ api_key: config.apiKey, msg: message, to });
  if (config.senderId) form.set("sender_id", config.senderId);

  const response = await post(config.endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });
  if (!response.ok) return { ok: false, error: response.error };

  const json = parseJson(response.body);
  if (!json) return { ok: false, error: `Gateway returned HTTP ${response.status} and no JSON.` };

  if (Number(json.error) === 0) {
    const data = json.data as { request_id?: unknown } | undefined;
    return { ok: true, reference: data?.request_id != null ? String(data.request_id) : null };
  }
  return { ok: false, error: String(json.msg ?? `Gateway error code ${json.error}`) };
}

/** BulkSMSBD: form post, `{"response_code":202,...}`. 202 is the only success. */
async function sendViaBulkSmsBd(config: SmsConfig, to: string, message: string): Promise<SmsResult> {
  const form = new URLSearchParams({
    api_key: config.apiKey,
    type: "text",
    number: to,
    senderid: config.senderId ?? "",
    message,
  });

  const response = await post(config.endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });
  if (!response.ok) return { ok: false, error: response.error };

  const json = parseJson(response.body);
  if (!json) return { ok: false, error: `Gateway returned HTTP ${response.status} and no JSON.` };

  if (Number(json.response_code) === 202) {
    return { ok: true, reference: text(json.success_message) };
  }
  return {
    ok: false,
    error: String(json.error_message ?? json.success_message ?? `Gateway code ${json.response_code}`),
  };
}

/** MiMSMS: JSON body, `{"statusCode":"200","status":"Success",...}`. */
async function sendViaMimSms(config: SmsConfig, to: string, message: string): Promise<SmsResult> {
  const response = await post(config.endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      UserName: config.username,
      Apikey: config.apiKey,
      MobileNumber: to,
      CampaignId: "null",
      SenderName: config.senderId,
      TransactionType: "T",
      Message: message,
    }),
  });
  if (!response.ok) return { ok: false, error: response.error };

  const json = parseJson(response.body);
  if (!json) return { ok: false, error: `Gateway returned HTTP ${response.status} and no JSON.` };

  if (String(json.statusCode) === "200" || /success/i.test(String(json.status ?? ""))) {
    return { ok: true, reference: text(json.trxnId) };
  }
  return { ok: false, error: String(json.responseResult ?? json.status ?? "The gateway refused the message.") };
}

/** A reseller's GET URL, filled in from a template. Every value is URL-encoded
 * on the way in, so a message containing `&` cannot bolt an extra parameter
 * onto the request. */
async function sendViaCustomUrl(config: SmsConfig, to: string, message: string): Promise<SmsResult> {
  const url = config.endpoint
    .replaceAll("{api_key}", encodeURIComponent(config.apiKey))
    .replaceAll("{to}", encodeURIComponent(to))
    .replaceAll("{to_plus}", encodeURIComponent(`+${to}`))
    .replaceAll("{sender_id}", encodeURIComponent(config.senderId ?? ""))
    .replaceAll("{message}", encodeURIComponent(message));

  const response = await post(url, { method: "GET" });
  if (!response.ok) return { ok: false, error: response.error };
  if (response.status < 200 || response.status >= 300) {
    return { ok: false, error: `Gateway returned HTTP ${response.status}.` };
  }

  // With no agreed response shape, an explicit error in the body is the only
  // failure that can be recognised; anything else counts as accepted.
  const json = parseJson(response.body);
  if (json && (Number(json.error) > 0 || /^(error|failed)/i.test(String(json.status ?? "")))) {
    return { ok: false, error: String(json.msg ?? json.message ?? json.status) };
  }
  return { ok: true, reference: null };
}

/* -------------------------------------------------------------------------- */
/* Sending                                                                    */
/* -------------------------------------------------------------------------- */

/** Every send, as it happened, minus the body -- a verification text *is* its
 * one-time code, so writing the message down would put live codes in a table
 * any admin can read. Best-effort: a shop whose `sms_messages` migration has
 * not been applied yet still sends messages, it just cannot show a history. */
async function recordSend(
  input: { phone: string; purpose: string; provider: string; result: SmsResult }
): Promise<void> {
  try {
    const db = await getDB();
    await db
      .prepare(
        `INSERT INTO sms_messages (id, phone, purpose, provider, status, provider_ref, error)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        crypto.randomUUID(),
        input.phone,
        input.purpose,
        input.provider,
        input.result.ok ? "sent" : "failed",
        input.result.ok ? input.result.reference : null,
        input.result.ok ? null : input.result.error.slice(0, 300)
      )
      .run();
  } catch (error) {
    console.error("sms log write failed", { provider: input.provider, error });
  }
}

/** Sends one message and says what happened.
 *
 * `to` is a normalized `+8801XXXXXXXXX`; the number actually dialled is derived
 * from it here so no caller has to know which format its gateway wants. */
export async function sendSms(
  to: string,
  message: string,
  purpose: string = "otp"
): Promise<SmsResult> {
  const msisdn = toMsisdn(to);
  if (!msisdn) return { ok: false, error: "Not a Bangladeshi mobile number." };

  const resolved = await getSmsConfig();
  if (!resolved.ok) {
    return { ok: false, error: resolved.problem, unconfigured: true };
  }

  const body = gsmSafe(message);
  const { config } = resolved;

  let result: SmsResult;
  switch (config.provider) {
    case "bulksmsbd":
      result = await sendViaBulkSmsBd(config, msisdn, body);
      break;
    case "mimsms":
      result = await sendViaMimSms(config, msisdn, body);
      break;
    case "custom":
      result = await sendViaCustomUrl(config, msisdn, body);
      break;
    default:
      result = await sendViaSmsNetBd(config, msisdn, body);
  }

  if (!result.ok) {
    console.error("sms send failed", {
      provider: config.provider,
      to: maskPhone(to),
      purpose,
      error: result.error,
    });
  }

  await recordSend({ phone: to, purpose, provider: config.provider, result });
  return result;
}

/** The most recent sends, for the admin panel. Returns nothing at all rather
 * than erroring when the table is not there yet. */
export interface SmsLogEntry {
  id: string;
  phone: string;
  purpose: string;
  provider: string;
  status: string;
  error: string | null;
  createdAt: string;
}

export async function recentSmsSends(limit = 8): Promise<SmsLogEntry[]> {
  try {
    const db = await getDB();
    const { results } = await db
      .prepare(
        `SELECT id, phone, purpose, provider, status, error, created_at
           FROM sms_messages ORDER BY created_at DESC LIMIT ?`
      )
      .bind(limit)
      .all<{
        id: string;
        phone: string;
        purpose: string;
        provider: string;
        status: string;
        error: string | null;
        created_at: string;
      }>();

    return results.map((row) => ({
      id: row.id,
      phone: maskPhone(row.phone),
      purpose: row.purpose,
      provider: row.provider,
      status: row.status,
      error: row.error,
      createdAt: row.created_at,
    }));
  } catch {
    return [];
  }
}
