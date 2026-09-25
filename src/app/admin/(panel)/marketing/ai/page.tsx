import Link from "next/link";
import { BadgeCheck, Banknote, Bot, Megaphone, ShoppingBag, TriangleAlert } from "lucide-react";
import { getMarketingOverview } from "@/lib/marketing/campaigns";
import { textProviderConfigured } from "@/lib/marketing/provider";
import { formatDateTime, formatPrice } from "@/lib/format";
import CommandCenter from "@/components/admin/marketing/CommandCenter";
import {
  Card,
  CardHeader,
  EmptyState,
  PageHeader,
  StatCard,
  StatusPill,
  buttonStyles,
} from "@/components/admin/ui";

export const metadata = { title: "AI Command Center" };

export default async function MarketingAiPage() {
  // Neither of these depends on the other, and the database is in Singapore.
  const [overview, aiConfigured] = await Promise.all([
    getMarketingOverview(),
    textProviderConfigured(),
  ]);

  return (
    <>
      <PageHeader
        title="AI Command Center"
        subtitle="Say what you want to achieve — the plan comes back for your approval"
        breadcrumb={["Marketing", "AI Command Center"]}
      />

      {!aiConfigured ? (
        <div className="mb-5 flex flex-col gap-2.5 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-start gap-2.5 text-[13px] text-amber-900">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              <strong className="font-semibold">Demo Mode.</strong> No AI provider is configured,
              so plans are worked examples rather than analysis. Everything is labelled{" "}
              <em>demo data</em> and is kept out of your real figures.
            </span>
          </p>
          <Link
            href="/admin/settings"
            className={`${buttonStyles.secondary} shrink-0 justify-center`}
          >
            Add a key
          </Link>
        </div>
      ) : null}

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Ad spend today"
          value={formatPrice(overview.spendToday)}
          caption="live campaigns only"
          icon={Banknote}
          tone="orange"
        />
        <StatCard
          label="Orders today"
          value={String(overview.ordersToday)}
          caption="every order, not only from ads"
          icon={ShoppingBag}
          tone="green"
        />
        <StatCard
          label="Cost per purchase"
          value={overview.cpa === null ? "—" : formatPrice(overview.cpa)}
          caption={overview.cpa === null ? "nothing spent yet" : "attributed by the platform"}
          icon={BadgeCheck}
          tone="blue"
        />
        <StatCard
          label="Return on ad spend"
          value={overview.roas === null ? "—" : `${overview.roas}x`}
          caption={overview.roas === null ? "nothing spent yet" : "attributed revenue ÷ spend"}
          icon={Megaphone}
          tone="violet"
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-12">
        <div className="min-w-0 space-y-4 xl:col-span-7">
          <Card>
            <CardHeader
              title="What do you want to achieve?"
              subtitle="Plain language — the product, the budget and how long for"
            />
            <CommandCenter demoMode={!aiConfigured} />
          </Card>
        </div>

        <div className="min-w-0 space-y-4 xl:col-span-5">
          <Card>
            <CardHeader
              title="Waiting for you"
              subtitle="Nothing here has spent anything yet"
            />
            {overview.awaiting.length === 0 ? (
              <EmptyState
                title="No campaign is waiting"
                detail="A plan you create will appear here once it is ready for approval."
              />
            ) : (
              <ul className="space-y-2.5">
                {overview.awaiting.map((campaign) => (
                  <li
                    key={campaign.id}
                    className="rounded-xl border border-neutral-100 p-3 transition hover:border-brand/40"
                  >
                    <p className="truncate text-[13px] font-semibold text-neutral-800">
                      {campaign.name}
                    </p>
                    <p className="mt-0.5 text-[11px] text-neutral-400">
                      {formatPrice(campaign.budgetTotal)} · {campaign.creativeCount} creatives
                    </p>
                    <Link
                      href={`/admin/marketing/campaigns/${campaign.id}`}
                      className={`${buttonStyles.secondary} mt-2.5 w-full justify-center`}
                    >
                      Review
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader title="AI activity" subtitle="Every run, newest first" />
            {overview.recentRuns.length === 0 ? (
              <EmptyState title="Nothing has run yet" />
            ) : (
              <ul className="space-y-2">
                {overview.recentRuns.map((run) => (
                  <li key={run.id} className="flex items-start gap-2.5">
                    <Bot className="mt-0.5 h-4 w-4 shrink-0 text-neutral-300" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12.5px] text-neutral-700">
                        {run.summary}
                      </span>
                      <span className="text-[11px] text-neutral-400">
                        {formatDateTime(run.createdAt)}
                        {run.isDemo ? " · demo" : ""}
                      </span>
                    </span>
                    <StatusPill status={run.status} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
