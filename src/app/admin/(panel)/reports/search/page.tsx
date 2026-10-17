import Link from "next/link";
import { Search, SearchX } from "lucide-react";
import { requireAdmin } from "@/lib/admin";
import { searchReport, POPULAR_SEARCHES_SETTING } from "@/lib/searchInsights";
import { getSetting } from "@/lib/admin";
import {
  Card,
  CardHeader,
  EmptyState,
  PageHeader,
  StatCard,
  TableScroll,
  Td,
  Th,
} from "@/components/admin/ui";
import PopularForm from "./PopularForm";

export const metadata = { title: "Search insights" };

const RANGES = [7, 30, 90];

/** What shoppers search for, and -- more useful -- what they search for and
 * do not find. Each zero-result search is a product the shop does not carry,
 * or a word (often Bangla or Banglish) to add to an existing product's tags
 * so the next shopper who types it finds it. */
export default async function SearchInsightsPage(props: PageProps<"/admin/reports/search">) {
  await requireAdmin();
  const params = await props.searchParams;
  const raw = Number(Array.isArray(params.days) ? params.days[0] : params.days);
  const days = RANGES.includes(raw) ? raw : 30;

  const [report, popularRaw] = await Promise.all([
    searchReport(days, 50),
    getSetting(POPULAR_SEARCHES_SETTING, ""),
  ]);
  const popular = popularRaw.split("\n").map((l) => l.trim()).filter(Boolean);
  const zeroShare = report.searches ? Math.round((report.zeroSearches / report.searches) * 100) : 0;

  return (
    <>
      <PageHeader
        title="Search insights"
        subtitle="What shoppers search for on the shop, and what they could not find"
        breadcrumb={["Reports", "Search insights"]}
        action={
          <div className="flex gap-1 rounded-xl bg-neutral-100 p-1">
            {RANGES.map((range) => (
              <Link
                key={range}
                href={`?days=${range}`}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                  range === days ? "bg-white text-brand shadow-sm" : "text-neutral-500"
                }`}
              >
                {range} days
              </Link>
            ))}
          </div>
        }
      />

      <div className="mb-4 grid gap-4 sm:grid-cols-2">
        <StatCard label="Searches" value={report.searches.toLocaleString("en-US")} icon={Search} caption={`last ${days} days`} />
        <StatCard
          label="Found nothing"
          value={`${report.zeroSearches.toLocaleString("en-US")} (${zeroShare}%)`}
          icon={SearchX}
          tone="red"
          caption={`last ${days} days`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Searches that found nothing"
            subtitle="Add these words to a product's tags, or stock what people are asking for"
          />
          {report.zero.length === 0 ? (
            <EmptyState title="Nothing yet" detail="Every search in this period found at least one product." />
          ) : (
            <QueryTable rows={report.zero} showResults={false} />
          )}
        </Card>

        <Card>
          <CardHeader title="Top searches" subtitle="Most searched, with how many products the last one found" />
          {report.top.length === 0 ? (
            <EmptyState title="No searches yet" detail="Searches made on the shop's results page appear here." />
          ) : (
            <QueryTable rows={report.top} showResults />
          )}
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader
            title="“Popular right now” list"
            subtitle="What the search box suggests before anyone types. Set your own, or leave it to real searches."
          />
          <PopularForm current={popular} />
        </Card>
      </div>
    </>
  );
}

function QueryTable({
  rows,
  showResults,
}: {
  rows: { query: string; searches: number; lastResults: number; lastSearchedAt: string }[];
  showResults: boolean;
}) {
  return (
    <TableScroll>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-neutral-100">
            <Th>Search</Th>
            <Th className="text-right">Times</Th>
            {showResults ? <Th className="text-right">Results</Th> : null}
            <Th className="text-right">Last</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.query} className="border-b border-neutral-50 last:border-0">
              <Td>
                <a
                  href={`https://zupona.com/search?q=${encodeURIComponent(row.query)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-neutral-800 hover:text-brand"
                >
                  {row.query}
                </a>
              </Td>
              <Td className="text-right tabular-nums">{row.searches}</Td>
              {showResults ? (
                <Td className={`text-right tabular-nums ${row.lastResults === 0 ? "text-red-600" : ""}`}>
                  {row.lastResults}
                </Td>
              ) : null}
              <Td className="text-right text-xs text-neutral-400">{row.lastSearchedAt.slice(0, 10)}</Td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableScroll>
  );
}
