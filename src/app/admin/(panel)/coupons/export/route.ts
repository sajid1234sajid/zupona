import { getDB } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";

/** One batch of codes as a spreadsheet: code, whether it has been used, and
 * when. Admins only. */
export async function GET(request: Request) {
  await requireAdmin();
  const batch = new URL(request.url).searchParams.get("batch")?.trim().toUpperCase() ?? "";
  if (!/^[A-Z0-9_-]{3,24}$/.test(batch)) return new Response("Unknown batch", { status: 400 });

  const db = await getDB();
  const { results } = await db
    .prepare(
      `SELECT c.code, c.usage_count, c.ends_at,
              (SELECT MAX(r.redeemed_at) FROM coupon_redemptions r WHERE r.coupon_id = c.id) AS used_at
       FROM coupons c WHERE c.batch = ? ORDER BY c.code`
    )
    .bind(batch)
    .all<{ code: string; usage_count: number; ends_at: string | null; used_at: string | null }>();

  const rows = [
    ["Code", "Used", "Used at", "Ends"],
    ...results.map((row) => [row.code, row.usage_count > 0 ? "yes" : "no", row.used_at ?? "", row.ends_at ?? ""]),
  ];
  const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\r\n");
  return new Response(`﻿${csv}\r\n`, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="zupona-codes-${batch}.csv"`,
      "cache-control": "no-store",
    },
  });
}
