/** Sends errors to Sentry, when Settings holds a DSN.
 *
 * No SDK: an event is one small JSON envelope POSTed to the project's ingest
 * address, which a Worker can do with `fetch` and the browser never has to
 * download a tracker for. Browser errors come here through /api/report-error,
 * server errors through `onRequestError` in src/instrumentation.ts. Without a
 * DSN everything here is a no-op apart from the console line. */

import { getShopSettings } from "@/lib/shopSettings";

interface Dsn {
  key: string;
  host: string;
  project: string;
  raw: string;
}

/** `https://<key>@o123.ingest.sentry.io/456` -> its parts. */
export function parseDsn(raw: string | null | undefined): Dsn | null {
  const match = /^https:\/\/([0-9a-f]{16,64})@([a-z0-9.-]+)\/(\d+)$/i.exec((raw ?? "").trim());
  return match ? { key: match[1], host: match[2], project: match[3], raw: raw!.trim() } : null;
}

export interface ErrorDetails {
  message: string;
  type?: string;
  stack?: string;
  url?: string;
  /** "server" or "browser". */
  source: "server" | "browser";
  tags?: Record<string, string>;
}

function frames(stack: string | undefined) {
  if (!stack) return undefined;
  const lines = stack.split("\n").slice(1, 30);
  const parsed = lines
    .map((line) => /at (?:(.+?) \()?(.+?):(\d+):(\d+)\)?$/.exec(line.trim()))
    .filter((m): m is RegExpExecArray => m !== null)
    .map((m) => ({ function: m[1] || "?", filename: m[2], lineno: Number(m[3]), colno: Number(m[4]), in_app: !m[2].includes("node_modules") }));
  // Sentry wants the oldest frame first.
  return parsed.length > 0 ? { frames: parsed.reverse() } : undefined;
}

export async function reportError(details: ErrorDetails): Promise<void> {
  console.error(`[${details.source}] ${details.type ?? "Error"}: ${details.message}`, details.url ?? "");
  const settings = await getShopSettings().catch(() => null);
  const dsn = parseDsn(settings?.sentryDsn);
  if (!dsn) return;

  const eventId = crypto.randomUUID().replace(/-/g, "");
  const event = {
    event_id: eventId,
    timestamp: Date.now() / 1000,
    platform: "javascript",
    level: "error",
    environment: "production",
    server_name: details.source === "server" ? "worker" : undefined,
    tags: { source: details.source, ...details.tags },
    request: details.url ? { url: details.url } : undefined,
    exception: {
      values: [
        {
          type: (details.type ?? "Error").slice(0, 100),
          value: details.message.slice(0, 1000),
          stacktrace: frames(details.stack),
        },
      ],
    },
  };
  const envelope = [
    JSON.stringify({ event_id: eventId, sent_at: new Date().toISOString(), dsn: dsn.raw }),
    JSON.stringify({ type: "event" }),
    JSON.stringify(event),
  ].join("\n");

  try {
    await fetch(`https://${dsn.host}/api/${dsn.project}/envelope/?sentry_key=${dsn.key}&sentry_version=7`, {
      method: "POST",
      headers: { "content-type": "application/x-sentry-envelope" },
      body: envelope,
    });
  } catch (error) {
    console.error("error report not sent", error);
  }
}
