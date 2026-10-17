/** Page-speed numbers from real visitors (a sample of them); see
 * src/components/analytics/WebVitals.tsx. Stored for Admin > Reports > Speed. */

import { afterResponse, getDB } from "@/lib/db";
import { rateLimit } from "@/lib/cache";

const METRICS = new Set(["LCP", "CLS", "INP", "FCP", "TTFB"]);
const PAGES = new Set(["home", "product", "category", "search", "cart", "checkout", "offers", "account", "other"]);

export async function POST(request: Request) {
  const ip = request.headers.get("cf-connecting-ip") ?? "unknown";
  const limit = await rateLimit(`vitals:${ip}`, 60, 3600).catch(() => null);
  if (limit && !limit.allowed) return new Response(null, { status: 204 });

  let body: { page?: unknown; device?: unknown; metrics?: unknown } = {};
  try {
    body = JSON.parse((await request.text()).slice(0, 2000));
  } catch {
    return new Response(null, { status: 204 });
  }
  const page = typeof body.page === "string" && PAGES.has(body.page) ? body.page : "other";
  const device = body.device === "desktop" ? "desktop" : "mobile";
  const metrics = Object.entries((body.metrics ?? {}) as Record<string, unknown>).filter(
    (entry): entry is [string, number] =>
      METRICS.has(entry[0]) && typeof entry[1] === "number" && Number.isFinite(entry[1]) && entry[1] >= 0 && entry[1] < 120000
  );
  if (metrics.length === 0) return new Response(null, { status: 204 });

  await afterResponse("web vitals", async () => {
    const db = await getDB();
    const statements = metrics.map(([metric, value]) =>
      db
        .prepare("INSERT INTO web_vitals (page, metric, value, device) VALUES (?, ?, ?, ?)")
        .bind(page, metric, metric === "CLS" ? Math.round(value * 1000) / 1000 : Math.round(value), device)
    );
    // Now and then, forget what is older than a month.
    if (Math.random() < 0.02) {
      statements.push(db.prepare("DELETE FROM web_vitals WHERE created_at < datetime('now', '-30 days')"));
    }
    await db.batch(statements);
  });
  return new Response(null, { status: 204 });
}
