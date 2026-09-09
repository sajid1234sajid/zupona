import Link from "next/link";
import {
  CalendarDays,
  FolderPlus,
  Package,
  PackagePlus,
  ShieldCheck,
  ShoppingBag,
  Ticket,
  TrendingUp,
  Users,
} from "lucide-react";
import { getCurrentUser } from "@/lib/session";
import {
  asRange,
  getDashboardSummary,
  getOrderStatusBreakdown,
  getRecentActivity,
  getSalesSeries,
  getTopProductsDetailed,
  listOrders,
} from "@/lib/adminData";
import { formatPrice, formatRelative } from "@/lib/format";
import { DonutChart, SeriesTable, statusColor } from "@/components/admin/charts";
import SalesChart from "@/components/admin/SalesChart";
import {
  Avatar,
  Card,
  CardHeader,
  StatCard,
  StatusPill,
  Td,
  Th,
  TableScroll,
  Thumb,
  statusLabel,
} from "@/components/admin/ui";
import RangeTabs from "@/components/admin/RangeTabs";

export const metadata = { title: "Dashboard" };

/** Bangladesh time, which is what "this morning" means to the person reading
 * this — the Worker itself runs in UTC. */
function dhakaNow(): Date {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Dhaka" }));
}

function greeting(): string {
  const hour = dhakaNow().getHours();
  if (hour < 12) return "Good Morning";
  if (hour < 17) return "Good Afternoon";
  return "Good Evening";
}

const ORDER_STATUSES = [
  "delivered",
  "placed",
  "confirmed",
  "shipped",
  "out_for_delivery",
  "cancelled",
] as const;

const QUICK_ACTIONS = [
  { label: "Add Product", detail: "Create a new product", href: "/admin/products/new", icon: PackagePlus },
  { label: "Add Coupon", detail: "Set up a discount code", href: "/admin/coupons", icon: Ticket },
  { label: "View Orders", detail: "Check new orders", href: "/admin/orders", icon: ShoppingBag },
  { label: "Add Category", detail: "Organise your catalog", href: "/admin/categories", icon: FolderPlus },
  { label: "View Customers", detail: "Manage your customers", href: "/admin/customers", icon: Users },
];

export default async function AdminDashboard(props: PageProps<"/admin">) {
  const searchParams = await props.searchParams;
  const range = asRange(
    typeof searchParams.range === "string" ? searchParams.range : undefined,
    "7d"
  );

  const [user, summary, series, statuses, latest, topProducts, activity] = await Promise.all([
    getCurrentUser(),
    getDashboardSummary(range),
    getSalesSeries(range),
    getOrderStatusBreakdown(range),
    listOrders({ range, page: 1 }),
    getTopProductsDetailed(5, range),
    getRecentActivity(6),
  ]);

  const statusMap = new Map(statuses.map((slice) => [slice.status, slice.count]));
  const statusTotal = statuses.reduce((sum, slice) => sum + slice.count, 0);
  // Only statuses that actually occurred: a donut of six segments where four
  // are zero is harder to read than one showing what happened.
  const slices = ORDER_STATUSES.filter((status) => (statusMap.get(status) ?? 0) > 0).map(
    (status) => ({
      label: statusLabel(status),
      value: statusMap.get(status) ?? 0,
      color: statusColor(status),
    })
  );

  const rangeCaption =
    range === "all" ? "vs all time" : `vs previous ${range.replace("d", " days")}`;

  return (
    <div className="grid gap-5 xl:grid-cols-12">
      <div className="min-w-0 space-y-5 xl:col-span-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-neutral-900 lg:text-2xl">
              {greeting()}, {user?.name?.split(" ")[0] ?? "Admin"} 👋
            </h1>
            <p className="mt-1 text-sm text-neutral-500">
              Here&apos;s what&apos;s happening with your store today.
            </p>
          </div>
          <div className="flex items-center gap-2.5 rounded-2xl border border-black/[0.05] bg-white px-4 py-2.5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] xl:hidden">
            <CalendarDays className="h-4 w-4 text-brand" />
            <div>
              <p className="text-[11px] leading-tight text-neutral-400">Today</p>
              <p className="text-[13px] font-semibold leading-tight text-neutral-800">
                {dhakaNow().toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
          <StatCard
            label="Total Orders"
            value={summary.orders.value.toLocaleString("en-US")}
            change={summary.orders.change}
            caption={rangeCaption}
            icon={Package}
            tone="green"
            href="/admin/orders"
          />
          <StatCard
            label="Total Revenue"
            value={formatPrice(summary.revenue.value)}
            change={summary.revenue.change}
            caption={rangeCaption}
            icon={TrendingUp}
            tone="blue"
            href="/admin/reports"
          />
          <StatCard
            label="Total Products"
            value={summary.products.value.toLocaleString("en-US")}
            change={summary.products.change}
            caption={rangeCaption}
            icon={ShoppingBag}
            tone="orange"
            href="/admin/products"
          />
          <StatCard
            label="Total Customers"
            value={summary.customers.value.toLocaleString("en-US")}
            change={summary.customers.change}
            caption={rangeCaption}
            icon={Users}
            tone="pink"
            href="/admin/customers"
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-5">
          <Card className="lg:col-span-3">
            <CardHeader
              title="Sales Overview"
              subtitle={range === "all" ? "All time" : `Last ${range.replace("d", " days")}`}
              action={<RangeTabs base="/admin" params={searchParams} current={range} />}
            />
            <SalesChart points={series} />
            <SeriesTable points={series} />
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader title="Order Status" subtitle="Share of orders by state" />
            {slices.length === 0 ? (
              <p className="py-12 text-center text-sm text-neutral-400">
                No orders in this period yet.
              </p>
            ) : (
              <DonutChart slices={slices} total={statusTotal} totalLabel="Total Orders" />
            )}
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader
              title="Latest Orders"
              action={
                <Link href="/admin/orders" className="text-xs font-semibold text-brand hover:underline">
                  View all
                </Link>
              }
            />
            {latest.rows.length === 0 ? (
              <p className="py-10 text-center text-sm text-neutral-400">No orders yet.</p>
            ) : (
              <TableScroll>
                <table className="w-full min-w-[420px] border-collapse">
                  <thead>
                    <tr className="border-b border-neutral-100">
                      <Th>Order ID</Th>
                      <Th>Customer</Th>
                      <Th className="text-right">Total</Th>
                      <Th>Status</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {latest.rows.slice(0, 5).map((order) => (
                      <tr key={order.id} className="border-b border-neutral-50 last:border-0">
                        <Td>
                          <Link
                            href={`/admin/orders/${order.id}`}
                            className="font-semibold text-brand hover:underline"
                          >
                            #{order.orderNumber}
                          </Link>
                        </Td>
                        <Td>
                          <span className="block truncate text-[13px]">{order.customerName}</span>
                          <span className="block text-[11px] text-neutral-400">
                            {formatRelative(order.placedAt)}
                          </span>
                        </Td>
                        <Td className="whitespace-nowrap text-right font-semibold">
                          {formatPrice(order.total)}
                        </Td>
                        <Td>
                          <StatusPill status={order.status} />
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableScroll>
            )}
          </Card>

          <Card>
            <CardHeader
              title="Top Products"
              action={
                <Link
                  href="/admin/products"
                  className="text-xs font-semibold text-brand hover:underline"
                >
                  View all
                </Link>
              }
            />
            {topProducts.length === 0 ? (
              <p className="py-10 text-center text-sm text-neutral-400">
                No sales in this period yet.
              </p>
            ) : (
              <ul className="space-y-3">
                {topProducts.map((product) => (
                  <li key={product.product_id} className="flex items-center gap-3">
                    <Thumb src={product.image} alt="" size={40} />
                    <div className="min-w-0 flex-1">
                      {product.stillListed ? (
                        <Link
                          href={`/admin/products/${product.product_id}`}
                          className="block truncate text-[13px] font-medium text-neutral-800 hover:text-brand"
                        >
                          {product.name}
                        </Link>
                      ) : (
                        <p
                          title="This product is no longer in the catalog"
                          className="truncate text-[13px] font-medium text-neutral-500"
                        >
                          {product.name}
                        </p>
                      )}
                      <p className="text-[11px] text-neutral-400">{product.units} sold</p>
                    </div>
                    <span className="shrink-0 whitespace-nowrap text-[13px] font-semibold text-neutral-800">
                      {formatPrice(product.revenue)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <Card className="border-brand/20 bg-brand-tint/40">
          <div className="flex flex-wrap items-center gap-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white">
              <ShieldCheck className="h-5 w-5 text-brand" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-neutral-800">Keep Your Store Safe</p>
              <p className="text-xs text-neutral-500">
                Every admin sign-in and privileged change is recorded in the audit log.
              </p>
            </div>
            <Link
              href="/admin/settings"
              className="rounded-xl bg-brand px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-brand-dark"
            >
              View Details
            </Link>
          </div>
        </Card>
      </div>

      <div className="min-w-0 space-y-5 xl:col-span-4">
        <div className="hidden items-center gap-2.5 rounded-2xl border border-black/[0.05] bg-white px-4 py-3 shadow-[0_1px_2px_rgba(16,24,40,0.04)] xl:flex">
          <CalendarDays className="h-4 w-4 text-brand" />
          <div>
            <p className="text-[11px] leading-tight text-neutral-400">Today</p>
            <p className="text-[13px] font-semibold leading-tight text-neutral-800">
              {dhakaNow().toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </p>
          </div>
        </div>

        <Card>
          <CardHeader title="Quick Actions" subtitle="Jump straight to the thing you need" />
          <ul className="space-y-2">
            {QUICK_ACTIONS.map((action) => (
              <li key={action.href + action.label}>
                <Link
                  href={action.href}
                  className="flex items-center gap-3 rounded-xl border border-neutral-100 px-3 py-2.5 transition hover:border-brand/30 hover:bg-brand-tint/40"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-tint">
                    <action.icon className="h-4 w-4 text-brand-dark" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-semibold text-neutral-800">
                      {action.label}
                    </span>
                    <span className="block truncate text-[11px] text-neutral-400">
                      {action.detail}
                    </span>
                  </span>
                  <span aria-hidden className="shrink-0 text-neutral-300">
                    ›
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <CardHeader title="Recent Activity" />
          {activity.length === 0 ? (
            <p className="py-8 text-center text-sm text-neutral-400">Nothing has happened yet.</p>
          ) : (
            <ul className="space-y-3.5">
              {activity.map((entry) => (
                <li key={entry.id} className="flex gap-3">
                  <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-tint text-[11px]">
                    {entry.kind === "order" ? "🛒" : null}
                    {entry.kind === "product" ? "📦" : null}
                    {entry.kind === "customer" ? "👤" : null}
                    {entry.kind === "review" ? "⭐" : null}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-neutral-800">
                      {entry.title}
                    </p>
                    <p className="truncate text-[11px] text-neutral-400">
                      {entry.detail} · {formatRelative(entry.at)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader
            title="Recent Customers"
            action={
              <Link
                href="/admin/customers"
                className="text-xs font-semibold text-brand hover:underline"
              >
                View all
              </Link>
            }
          />
          {latest.rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-neutral-400">No customers yet.</p>
          ) : (
            <ul className="space-y-3">
              {latest.rows.slice(0, 4).map((order) => (
                <li key={order.id} className="flex items-center gap-3">
                  <Avatar src={order.customerAvatar} name={order.customerName} size={34} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-neutral-800">
                      {order.customerName}
                    </p>
                    <p className="truncate text-[11px] text-neutral-400">
                      {order.customerEmail ?? "No email on file"}
                    </p>
                  </div>
                  <span className="shrink-0 whitespace-nowrap text-[12px] font-semibold text-neutral-700">
                    {formatPrice(order.total)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
