import Link from "next/link";
import { BadgeCheck, Images, MessageSquare, ShieldCheck, Star } from "lucide-react";
import { PAGE_SIZE, asRange, getReviewStats, listAdminReviews, listOrders } from "@/lib/adminData";
import { formatRelative } from "@/lib/format";
import { RatingBars } from "@/components/admin/charts";
import FilterBar from "@/components/admin/FilterBar";
import ReviewTable from "@/components/admin/ReviewTable";
import RangeTabs, { withParam } from "@/components/admin/RangeTabs";
import {
  Card,
  CardHeader,
  EmptyState,
  PageHeader,
  Pagination,
  StatCard,
  StatusPill,
  buttonStyles,
} from "@/components/admin/ui";

export const metadata = { title: "Product Reviews" };

function one(value: string | string[] | undefined): string | undefined {
  const single = Array.isArray(value) ? value[0] : value;
  return single || undefined;
}

const TABS = [
  { key: "all", label: "All" },
  { key: "approved", label: "Approved" },
  { key: "pending", label: "Pending" },
  { key: "rejected", label: "Rejected" },
  { key: "spam", label: "Spam" },
] as const;

export default async function ReviewsPage(props: PageProps<"/admin/products/reviews">) {
  const searchParams = await props.searchParams;

  const status = one(searchParams.status) ?? "all";
  const ratingParam = Number(one(searchParams.rating) ?? 0);
  const media = (one(searchParams.media) ?? "all") as "all" | "with" | "without";
  const range = asRange(one(searchParams.range), "all");
  const page = Math.max(1, Number(one(searchParams.page) ?? 1) || 1);

  const [reviews, stats, recentOrders] = await Promise.all([
    listAdminReviews({
      search: one(searchParams.search),
      status,
      rating: ratingParam >= 1 && ratingParam <= 5 ? ratingParam : undefined,
      media,
      range,
      page,
    }),
    getReviewStats(),
    listOrders({ page: 1 }),
  ]);

  return (
    <>
      <PageHeader
        title="Product Reviews"
        subtitle="Manage customer reviews, ratings and feedback for your products"
        breadcrumb={["Products", "Product Reviews"]}
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <StatCard
          label="Overall Rating"
          value={stats.total === 0 ? "—" : `${stats.average} / 5`}
          icon={Star}
          tone="orange"
        />
        <StatCard
          label="Total Reviews"
          value={stats.total.toLocaleString("en-US")}
          icon={MessageSquare}
          tone="blue"
        />
        <StatCard
          label="Verified Purchases"
          value={stats.verified.toLocaleString("en-US")}
          icon={BadgeCheck}
          tone="green"
        />
        <StatCard
          label="With Photos"
          value={stats.withMedia.toLocaleString("en-US")}
          icon={Images}
          tone="violet"
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-12">
        <div className="min-w-0 xl:col-span-9">
          <Card>
            <FilterBar
              base="/admin/products/reviews"
              searchPlaceholder="Search by product, customer or review text…"
              selects={[
                {
                  name: "rating",
                  allLabel: "All Ratings",
                  options: [5, 4, 3, 2, 1].map((star) => ({
                    value: String(star),
                    label: `${star} star${star === 1 ? "" : "s"}`,
                  })),
                },
                {
                  name: "media",
                  allLabel: "All Media",
                  options: [
                    { value: "with", label: "With photos" },
                    { value: "without", label: "Without photos" },
                  ],
                },
              ]}
            >
              <RangeTabs
                base="/admin/products/reviews"
                params={searchParams}
                current={range}
                compact
              />
            </FilterBar>

            <div className="mb-4 flex flex-wrap gap-1.5">
              {TABS.map((tab) => {
                const active = status === tab.key;
                const count = stats.byStatus[tab.key] ?? 0;
                return (
                  <Link
                    key={tab.key}
                    href={`/admin/products/reviews${withParam(searchParams, "status", tab.key === "all" ? undefined : tab.key)}`}
                    aria-current={active ? "true" : undefined}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition ${
                      active
                        ? "bg-brand text-white"
                        : "border border-neutral-200 text-neutral-600 hover:border-brand hover:text-brand"
                    }`}
                  >
                    {tab.label}
                    <span className={active ? "text-white/70" : "text-neutral-400"}>{count}</span>
                  </Link>
                );
              })}
            </div>

            {reviews.rows.length === 0 ? (
              <EmptyState
                title="No reviews match these filters"
                detail="Reviews appear here as soon as customers start leaving them."
                action={
                  <Link href="/admin/products/reviews" className={buttonStyles.secondary}>
                    Clear filters
                  </Link>
                }
              />
            ) : (
              <>
                <ReviewTable rows={reviews.rows} />
                <Pagination
                  base="/admin/products/reviews"
                  params={{
                    search: one(searchParams.search),
                    status: status === "all" ? undefined : status,
                    rating: one(searchParams.rating),
                    media: media === "all" ? undefined : media,
                    range: one(searchParams.range),
                  }}
                  page={page}
                  total={reviews.total}
                  pageSize={PAGE_SIZE}
                  noun="reviews"
                />
              </>
            )}
          </Card>
        </div>

        <div className="min-w-0 space-y-4 xl:col-span-3">
          <Card>
            <CardHeader title="Rating Breakdown" />
            <RatingBars counts={stats.counts} total={stats.total} />
          </Card>

          <Card>
            <CardHeader title="Review Statistics" />
            <dl className="space-y-2.5 text-sm">
              {[
                [
                  "Verified share",
                  stats.total === 0
                    ? "—"
                    : `${Math.round((stats.verified / stats.total) * 100)}%`,
                ],
                [
                  "With photos",
                  stats.total === 0
                    ? "—"
                    : `${Math.round((stats.withMedia / stats.total) * 100)}%`,
                ],
                ["Awaiting moderation", String(stats.byStatus.pending ?? 0)],
                ["Marked as spam", String(stats.byStatus.spam ?? 0)],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between gap-3">
                  <dt className="text-neutral-400">{label}</dt>
                  <dd className="font-semibold text-neutral-800">{value}</dd>
                </div>
              ))}
            </dl>
          </Card>

          <Card>
            <CardHeader
              title="Recent Orders"
              subtitle="For cross-referencing"
              action={
                <Link href="/admin/orders" className="text-xs font-semibold text-brand hover:underline">
                  View all
                </Link>
              }
            />
            {recentOrders.rows.length === 0 ? (
              <p className="py-6 text-center text-sm text-neutral-400">No orders yet.</p>
            ) : (
              <ul className="space-y-3">
                {recentOrders.rows.slice(0, 5).map((order) => (
                  <li key={order.id} className="flex items-center gap-2.5">
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/admin/orders/${order.id}`}
                        className="block truncate text-[13px] font-semibold text-brand hover:underline"
                      >
                        #{order.orderNumber}
                      </Link>
                      <p className="truncate text-[11px] text-neutral-400">
                        {order.customerName} · {formatRelative(order.placedAt)}
                      </p>
                    </div>
                    <StatusPill status={order.status} />
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="border-brand/20 bg-brand-tint/40">
            <p className="flex items-center gap-2 text-[13px] font-bold text-neutral-800">
              <ShieldCheck className="h-4 w-4 text-brand" />
              Moderation &amp; Spam Protection
            </p>
            <ul className="mt-2 space-y-1.5 text-xs text-neutral-600">
              <li>· Only shoppers who bought the item get a Verified badge</li>
              <li>· Rejected and spam reviews stop counting toward the star average</li>
              <li>· Every moderation decision is written to the audit log</li>
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}
