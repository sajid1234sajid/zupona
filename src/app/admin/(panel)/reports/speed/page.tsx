import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { getDB } from "@/lib/db";
import { Card, CardHeader, EmptyState, PageHeader, TableScroll, Td, Th } from "@/components/admin/ui";

export const metadata = { title: "Speed" };

const METRICS = [
  { key: "LCP", label: "Main content shown", good: 2500, poor: 4000, unit: "ms" },
  { key: "INP", label: "Response to a tap", good: 200, poor: 500, unit: "ms" },
  { key: "CLS", label: "Layout jumping", good: 0.1, poor: 0.25, unit: "" },
  { key: "FCP", label: "First thing shown", good: 1800, poor: 3000, unit: "ms" },
  { key: "TTFB", label: "Server answer", good: 800, poor: 1800, unit: "ms" },
] as const;

const PAGES = ["home", "product", "category", "search", "cart", "checkout", "offers", "account", "other"];

function shown(value: number, unit: string): string {
  if (unit === "") return value.toFixed(2);
  return value >= 1000 ? `${(value / 1000).toFixed(1)} s` : `${Math.round(value)} ms`;
}

/** How fast the shop is for real visitors, from a sample of their page views:
 * the 75th percentile of each Core Web Vital per kind of page, which is the
 * figure Google judges a site by. Green is good, amber needs work, red is poor. */
export default async function SpeedPage(props: PageProps<"/admin/reports/speed">) {
  await requireAdmin();
  const params = await props.searchParams;
  const device = params.device === "desktop" ? "desktop" : "mobile";
  const db = await getDB();
  const { results } = await db
    .prepare(
      `WITH ranked AS (
         SELECT page, metric, value,
                ROW_NUMBER() OVER (PARTITION BY page, metric ORDER BY value) AS rn,
                COUNT(*) OVER (PARTITION BY page, metric) AS n
         FROM web_vitals WHERE device = ? AND created_at >= datetime('now', '-7 days'))
       SELECT page, metric, MIN(value) AS p75, MAX(n) AS n FROM ranked
       WHERE rn >= 0.75 * n GROUP BY page, metric`
    )
    .bind(device)
    .all<{ page: string; metric: string; p75: number; n: number }>()
    .catch(() => ({ results: [] as { page: string; metric: string; p75: number; n: number }[] }));

  const cell = new Map(results.map((row) => [`${row.page}:${row.metric}`, row]));
  const pages = PAGES.filter((page) => METRICS.some((metric) => cell.has(`${page}:${metric.key}`)));

  return (
    <>
      <PageHeader
        title="Speed"
        subtitle="How fast pages load for real visitors over the last 7 days (75th percentile)"
        breadcrumb={["Reports", "Speed"]}
        action={
          <div className="flex gap-1 rounded-xl bg-neutral-100 p-1">
            {(["mobile", "desktop"] as const).map((option) => (
              <Link
                key={option}
                href={option === "mobile" ? "?" : "?device=desktop"}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize ${
                  option === device ? "bg-white text-brand shadow-sm" : "text-neutral-500"
                }`}
              >
                {option}
              </Link>
            ))}
          </div>
        }
      />
      <Card>
        <CardHeader title="By page" subtitle="Green: good · Amber: needs work · Red: poor (Google's thresholds)" />
        {pages.length === 0 ? (
          <EmptyState title="No measurements yet" detail="One visit in four reports its speed; numbers appear here within a day of traffic." />
        ) : (
          <TableScroll>
            <table className="w-full min-w-[640px] border-collapse">
              <thead>
                <tr>
                  <Th>Page</Th>
                  {METRICS.map((metric) => (
                    <Th key={metric.key} className="text-right">
                      {metric.key}
                      <span className="block text-[10px] font-normal normal-case text-neutral-400">{metric.label}</span>
                    </Th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pages.map((page) => (
                  <tr key={page} className="border-b border-neutral-50 last:border-0">
                    <Td className="font-semibold capitalize">{page}</Td>
                    {METRICS.map((metric) => {
                      const row = cell.get(`${page}:${metric.key}`);
                      if (!row) return <Td key={metric.key} className="text-right text-neutral-300">–</Td>;
                      const tone = row.p75 <= metric.good ? "text-emerald-700" : row.p75 <= metric.poor ? "text-amber-600" : "text-red-600";
                      return (
                        <Td key={metric.key} className={`text-right font-semibold ${tone}`}>
                          {shown(row.p75, metric.unit)}
                          <span className="block text-[10px] font-normal text-neutral-400">{row.n} visits</span>
                        </Td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
        )}
      </Card>
    </>
  );
}
