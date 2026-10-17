/** For an uptime monitor: 200 when the Worker is up and can read the
 * database, 503 when it cannot. Never cached, and it reveals nothing beyond
 * whether the shop is working. */

import { getDB } from "@/lib/db";

export async function GET() {
  const started = Date.now();
  try {
    const db = await getDB();
    await db.prepare("SELECT 1").first();
    return Response.json(
      { ok: true, db: "up", ms: Date.now() - started },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return Response.json(
      { ok: false, db: "down" },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}
