import Link from "next/link";
import { Eye, MousePointerClick, Phone, ShoppingBag, ShoppingCart, Users } from "lucide-react";
import {
  ACTIVITY_RANGES,
  FEED_FILTERS,
  FEED_PAGE_SIZE,
  asActivityRange,
  getActivityOverview,
  sourceLabel,
} from "@/lib/activityData";
import { EventPill, EventSubject, PersonCell, thumb } from "@/components/admin/ActivityParts";
import { formatDateTime, formatPrice, formatRelative } from "@/lib/format";
import RangeTabs, { withParam } from "@/components/admin/RangeTabs";
import LiveRefresh from "@/components/admin/LiveRefresh";
import {
  Card,
  CardHeader,
  PageHeader,
  Pagination,
  StatCard,
  Td,
  Th,
  TableScroll,
  Thumb,
} from "@/components/admin/ui";

export const metadata = { title: "Activity" };

function one(value: string | string[] | undefined): string | undefined {
  const single = Array.isArray(value) ? value[0] : value;
  return single || undefined;
}

function percent(part: number, whole: number): string {
  if (whole === 0) return "0%";
  const value = (part / whole) * 100;
  return `${value < 10 && value > 0 ? value.toFixed(1) : Math.round(value)}%`;
}

export default async function ActivityPage(props: PageProps<"/admin/activity">) {
  const searchParams = await props.searchParams;
  const range = asActivityRange(one(searchParams.range));
  const filter = one(searchParams.show) ?? "all";
  const page = Math.max(1, Number(one(searchParams.page)) || 1);
  const rangeLabel = ACTIVITY_RANGES.find((option) => option.key === range)?.label ?? "";

  const { funnel, sources, campaigns, products, abandoned, feed, feedTotal, people } =
    await getActivityOverview({ range, filter, page });

  const steps = [
    { label: "Visited the shop", value: funnel.visitors },
    { label: "Viewed a product", value: funnel.viewed },
    { label: "Added to cart / Buy Now", value: funnel.carted },
    { label: "Opened checkout", value: funnel.checkout },
    { label: "Placed an order", value: funnel.bought },
  ];

  const hasFacebookAd = sources.some((row) => row.source === "facebook_ad");
  const plainParams = Object.fromEntries(
    Object.entries(searchParams).map(([key, value]) => [key, one(value)])
  );

  return (
    <>
      <PageHeader
        title="Customer Activity"
        subtitle={`Who visited, what they looked at, what they added and who bought: ${rangeLabel.toLowerCase()}`}
        breadcrumb={["Activity"]}
        action={
          <div className="flex min-w-0 max-w-full items-center gap-2">
            <LiveRefresh />
            <RangeTabs base="/admin/activity" params={searchParams} current={range} options={ACTIVITY_RANGES} compact />
          </div>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <StatCard label="Visitors" value={funnel.visitors.toLocaleString("en-US")} change={null} icon={Users} tone="blue" />
        <StatCard
          label="Product views"
          value={funnel.productViews.toLocaleString("en-US")}
          change={null}
          icon={Eye}
          tone="violet"
        />
        <StatCard
          label="Added to cart"
          value={funnel.carted.toLocaleString("en-US")}
          change={null}
          icon={ShoppingCart}
          tone="orange"
        />
        <StatCard
          label={`Orders · ${formatPrice(funnel.revenue)}`}
          value={funnel.orders.toLocaleString("en-US")}
          change={null}
          icon={ShoppingBag}
          tone="green"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Card className="xl:col-span-5">
          <CardHeader title="Shopping Funnel" subtitle="How many people reached each step" />
          <ol className="space-y-3.5">
            {steps.map((step, index) => {
              const previous = index === 0 ? step.value : steps[index - 1].value;
              return (
                <li key={step.label}>
                  <div className="mb-1.5 flex items-baseline justify-between gap-3">
                    <span className="min-w-0 truncate text-[13px] font-medium text-neutral-700">{step.label}</span>
                    <span className="shrink-0 text-[13px] font-semibold text-neutral-800">
                      {step.value.toLocaleString("en-US")}
                      <span className="ml-1.5 text-[11px] font-normal text-neutral-400">
                        {index === 0 ? "people" : `${percent(step.value, previous)} of previous`}
                      </span>
                    </span>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-neutral-100">
                    <div
                      className="h-full rounded-full bg-brand"
                      style={{ width: `${funnel.visitors === 0 ? 0 : Math.max(2, (step.value / funnel.visitors) * 100)}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ol>
          <p className="mt-4 text-xs text-neutral-400">
            {percent(funnel.bought, funnel.visitors)} of visitors placed an order ·{" "}
            {funnel.pageViews.toLocaleString("en-US")} pages viewed
          </p>
        </Card>

        <Card className="xl:col-span-7">
          <CardHeader title="Where Visitors Came From" subtitle="By the first page of each visitor's visit" />
          {sources.length === 0 ? (
            <p className="py-8 text-center text-sm text-neutral-400">No visits recorded in this window yet.</p>
          ) : (
            <TableScroll>
              <table className="w-full min-w-[480px] border-collapse">
                <thead>
                  <tr className="border-b border-neutral-100">
                    <Th className="pl-4 lg:pl-3">Source</Th>
                    <Th className="text-right">Visitors</Th>
                    <Th className="text-right">Added to cart</Th>
                    <Th className="text-right">Orders</Th>
                    <Th className="pr-4 text-right lg:pr-3">Revenue</Th>
                  </tr>
                </thead>
                <tbody>
                  {sources.map((row) => (
                    <tr key={row.source} className="border-b border-neutral-50 last:border-0">
                      <Td className="pl-4 font-medium lg:pl-3">{sourceLabel(row.source)}</Td>
                      <Td className="text-right">{row.visitors}</Td>
                      <Td className="text-right">
                        {row.carted}
                        <span className="ml-1 text-[11px] text-neutral-400">{percent(row.carted, row.visitors)}</span>
                      </Td>
                      <Td className="text-right">
                        {row.orders}
                        <span className="ml-1 text-[11px] text-neutral-400">{percent(row.orders, row.visitors)}</span>
                      </Td>
                      <Td className="whitespace-nowrap pr-4 text-right font-semibold lg:pr-3">
                        {formatPrice(row.revenue)}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableScroll>
          )}

          {campaigns.length > 0 ? (
            <div className="mt-5">
              <h3 className="mb-2 text-[13px] font-bold text-neutral-700">Ad campaigns</h3>
              <ul className="space-y-2">
                {campaigns.map((row) => (
                  <li key={row.campaign} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 text-[13px]">
                    <span className="min-w-0 truncate text-neutral-700">{row.campaign}</span>
                    <span className="shrink-0 text-neutral-500">
                      {row.visitors} visitors · {row.carted} carts · {row.orders} orders ·{" "}
                      <span className="font-semibold text-neutral-800">{formatPrice(row.revenue)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {!hasFacebookAd ? (
            <p className="mt-4 rounded-xl bg-neutral-50 px-3 py-2.5 text-xs leading-relaxed text-neutral-500">
              To see Facebook ads apart from ordinary Facebook posts, add this under the ad&apos;s{" "}
              <span className="font-semibold">URL parameters</span> in Ads Manager:{" "}
              <code className="break-all rounded bg-white px-1 py-0.5 text-[11px] text-neutral-700">
                utm_source=facebook&amp;utm_medium=paid&amp;utm_campaign={"{{campaign.name}}"}
              </code>
            </p>
          ) : null}
        </Card>

        <Card className="xl:col-span-5">
          <CardHeader title="Added to Cart, Not Ordered" subtitle="Worth a call or a message" />
          {abandoned.length === 0 ? (
            <p className="py-8 text-center text-sm text-neutral-400">Nobody has left a cart in this window.</p>
          ) : (
            <ul className="divide-y divide-neutral-50">
              {abandoned.map((row) => {
                const person = people.get(row.visitorId);
                return (
                  <li key={row.visitorId} className="flex items-center gap-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <PersonCell person={person} visitorId={row.visitorId} />
                      <p className="mt-1 truncate pl-[40px] text-[12px] text-neutral-500">
                        {row.productName ?? "A product"}
                        {row.adds > 1 ? ` + ${row.adds - 1} more` : ""} · {formatPrice(row.value)} ·{" "}
                        <span title={formatDateTime(row.lastAt)}>{formatRelative(row.lastAt)}</span>
                      </p>
                    </div>
                    {person?.phone ? (
                      <a
                        href={`tel:${person.phone}`}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
                        aria-label={`Call ${person.name}`}
                      >
                        <Phone className="h-4 w-4" />
                      </a>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card className="xl:col-span-7">
          <CardHeader title="Products" subtitle="Who looked, who added, who bought" />
          {products.length === 0 ? (
            <p className="py-8 text-center text-sm text-neutral-400">No product views in this window yet.</p>
          ) : (
            <TableScroll>
              <table className="w-full min-w-[540px] border-collapse">
                <thead>
                  <tr className="border-b border-neutral-100">
                    <Th className="pl-4 lg:pl-3">Product</Th>
                    <Th className="text-right">Viewers</Th>
                    <Th className="text-right">Added</Th>
                    <Th className="text-right">Bought</Th>
                    <Th className="pr-4 text-right lg:pr-3">View → order</Th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((row) => (
                    <tr key={row.id} className="border-b border-neutral-50 last:border-0">
                      <Td className="pl-4 lg:pl-3">
                        <Link
                          href={`/admin/products/${row.id}`}
                          className="flex max-w-[18rem] items-center gap-2 font-medium text-neutral-800 hover:text-brand"
                        >
                          <Thumb src={thumb(row.image)} alt="" size={30} />
                          <span className="truncate">{row.name}</span>
                        </Link>
                      </Td>
                      <Td className="whitespace-nowrap text-right">
                        {row.viewers}
                        <span className="ml-1 text-[11px] text-neutral-400">({row.views} views)</span>
                      </Td>
                      <Td className="text-right">{row.carted}</Td>
                      <Td className="text-right">
                        {row.buyers}
                        {row.units > row.buyers ? (
                          <span className="ml-1 text-[11px] text-neutral-400">({row.units} pcs)</span>
                        ) : null}
                      </Td>
                      <Td className="pr-4 text-right font-semibold lg:pr-3">{percent(row.buyers, row.viewers)}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableScroll>
          )}
        </Card>

        <Card className="xl:col-span-12">
          <CardHeader
            title="Live Activity"
            subtitle="Every view, add to cart and order, newest first. Tap a name for their whole history."
          />
          <div className="no-scrollbar -mx-1 mb-3 flex gap-1.5 overflow-x-auto px-1">
            {Object.entries(FEED_FILTERS).map(([key, option]) => {
              const active = key === filter;
              return (
                <Link
                  key={key}
                  href={`/admin/activity${withParam(searchParams, "show", key === "all" ? undefined : key)}`}
                  className={`shrink-0 whitespace-nowrap rounded-full border px-3 py-1.5 text-[12px] font-semibold transition ${
                    active
                      ? "border-brand bg-brand text-white"
                      : "border-neutral-200 text-neutral-600 hover:border-brand hover:text-brand"
                  }`}
                >
                  {option.label}
                </Link>
              );
            })}
          </div>

          {feed.length === 0 ? (
            <p className="flex items-center justify-center gap-2 py-10 text-sm text-neutral-400">
              <MousePointerClick className="h-4 w-4" />
              Nothing recorded in this window yet.
            </p>
          ) : (
            <ul className="divide-y divide-neutral-50">
              {feed.map((row) => (
                <li key={row.id} className="grid grid-cols-1 gap-1.5 py-2.5 sm:grid-cols-[minmax(0,13rem)_minmax(0,1fr)_auto] sm:items-center sm:gap-4">
                  <PersonCell person={people.get(row.visitorId)} visitorId={row.visitorId} />
                  <div className="flex min-w-0 flex-wrap items-center gap-2 pl-[40px] sm:pl-0">
                    <EventPill event={row.event} />
                    <span className="min-w-0 flex-1">
                      <EventSubject row={row} />
                    </span>
                  </div>
                  <span
                    className="pl-[40px] text-[11px] text-neutral-400 sm:pl-0 sm:text-right"
                    title={formatDateTime(row.createdAt)}
                  >
                    {formatRelative(row.createdAt)}
                    {row.device ? ` · ${row.device}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-2">
            <Pagination
              base="/admin/activity"
              params={plainParams}
              page={page}
              total={feedTotal}
              pageSize={FEED_PAGE_SIZE}
              noun="events"
            />
          </div>
        </Card>
      </div>
    </>
  );
}
