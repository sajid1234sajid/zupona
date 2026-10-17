/** A browser error, forwarded to Sentry; see src/lib/errorReport.ts.
 * Rate-limited per address so a page stuck in an error loop cannot flood it. */

import { reportError } from "@/lib/errorReport";
import { rateLimit } from "@/lib/cache";
import { afterResponse } from "@/lib/db";

export async function POST(request: Request) {
  const ip = request.headers.get("cf-connecting-ip") ?? "unknown";
  const limit = await rateLimit(`client-error:${ip}`, 20, 600).catch(() => null);
  if (limit && !limit.allowed) return new Response(null, { status: 204 });

  let body: { message?: unknown; type?: unknown; stack?: unknown; url?: unknown } = {};
  try {
    body = JSON.parse((await request.text()).slice(0, 20000));
  } catch {
    return new Response(null, { status: 204 });
  }
  const message = typeof body.message === "string" ? body.message.slice(0, 1000) : "";
  if (!message) return new Response(null, { status: 204 });

  await afterResponse("client error report", () =>
    reportError({
      source: "browser",
      message,
      type: typeof body.type === "string" ? body.type.slice(0, 100) : "Error",
      stack: typeof body.stack === "string" ? body.stack.slice(0, 8000) : undefined,
      url: typeof body.url === "string" ? body.url.slice(0, 500) : undefined,
      tags: { agent: (request.headers.get("user-agent") ?? "").slice(0, 120) },
    })
  );
  return new Response(null, { status: 204 });
}
