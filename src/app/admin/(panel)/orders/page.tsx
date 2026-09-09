import Link from "next/link";
import {
  Banknote,
  CheckCircle2,
  Clock,
  Eye,
  Package,
  Settings2,
  ShoppingCart,
  Truck,
} from "lucide-react";
import {
  PAGE_SIZE,
  asRange,
  getOrderCounts,
  getOrderInsights,
  listOrders,
} from "@/lib/adminData";
import { formatDateTime, formatPrice } from "@/lib/format";
import FilterBar from "@/components/admin/FilterBar";
import RangeTabs, { withParam } from "@/components/admin/RangeTabs";
import {
  Avatar,
  Card,
  CardHeader,
  EmptyState,
  PageHeader,
  Pagination,
  StatCard,
  StatusPill,
  Td,
  Th,
  TableScroll,
  buttonStyles,
} from "@/components/admin/ui";

export const metadata = { title: "Orders" };

function one(value: string | string[] | undefined): string | undefined {
  const single = Array.isArray(value) ? value[0] : value;
  return single || undefined;
}

const TABS = [
  { key: "all", label: "All" },
  { key: "placed", label: "Pending" },
  { key: "confirmed", label: "Processing" },
  { key: "shipped", label: "Shipped" },
  { key: "delivered", label: "Delivered" },
  { key: "cancelled", label: "Cancelled" },
] as const;

export default async function OrdersPage(props: PageProps<"/admin/orders">) {
  const searchParams = await props.searchParams;

  const status = one(searchParams.status) ?? "all";
  const range = asRange(one(searchParams.range), "all");
  const page = Math.max(1, Number(one(searchParams.page) ?? 1) || 1);

  const filter = {
    search: one(searchParams.search),
    status,
    paymentStatus: one(searchParams.payment),
    range,
    page,
  };

  const [orders, counts, insights] = await Promise.all([
    listOrders(filter),
    getOrderCounts(filter),
    getOrderInsights(),
  ]);

  return (
    <>
      <PageHeader
        title="Orders"
        subtitle="Manage and track all customer orders"
        breadcrumb={["Orders"]}
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-5 lg:gap-4">
        <StatCard
          label="Total Orders"
          value={counts.all.toLocaleString("en-US")}
          icon={ShoppingCart}
          tone="green"
        />
        <StatCard
          label="Pending"
          value={counts.placed.toLocaleString("en-US")}
          icon={Clock}
          tone="orange"
          href="/admin/orders?status=placed"
        />
        <StatCard
          label="Processing"
          value={counts.confirmed.toLocaleString("en-US")}
          icon={Settings2}
          tone="blue"
          href="/admin/orders?status=confirmed"
        />
        <StatCard
          label="Shipped"
          value={counts.shipped.toLocaleString("en-US")}
          icon={Truck}
          tone="violet"
          href="/admin/orders?status=shipped"
        />
        <StatCard
          label="Delivered"
          value={counts.delivered.toLocaleString("en-US")}
          icon={CheckCircle2}
          tone="green"
          href="/admin/orders?status=delivered"
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-12">
        <div className="min-w-0 xl:col-span-9">
          <Card>
            <div className="mb-4 flex flex-wrap gap-1.5">
              {TABS.map((tab) => {
                const active = status === tab.key;
                return (
                  <Link
                    key={tab.key}
                    href={`/admin/orders${withParam(searchParams, "status", tab.key === "all" ? undefined : tab.key)}`}
                    aria-current={active ? "true" : undefined}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition ${
                      active
                        ? "bg-brand text-white"
                        : "border border-neutral-200 text-neutral-600 hover:border-brand hover:text-brand"
                    }`}
                  >
                    {tab.label}
                    <span className={active ? "text-white/70" : "text-neutral-400"}>
                      {counts[tab.key] ?? 0}
                    </span>
                  </Link>
                );
              })}
            </div>

            <FilterBar
              base="/admin/orders"
              searchPlaceholder="Search order ID, customer name or phone…"
              selects={[
                {
                  name: "payment",
                  allLabel: "All Payments",
                  options: [
                    { value: "paid", label: "Paid" },
                    { value: "pending", label: "Payment pending" },
                    { value: "refunded", label: "Refunded" },
                    { value: "failed", label: "Failed" },
                  ],
                },
              ]}
            >
              <RangeTabs base="/admin/orders" params={searchParams} current={range} compact />
            </FilterBar>

            {orders.rows.length === 0 ? (
              <EmptyState
                title="No orders match these filters"
                detail="Orders placed on the storefront show up here straight away."
                action={
                  <Link href="/admin/orders" className={buttonStyles.secondary}>
                    Clear filters
                  </Link>
                }
              />
            ) : (
              <>
                <TableScroll>
                  <table className="w-full min-w-[780px] border-collapse">
                    <thead>
                      <tr className="border-b border-neutral-100">
                        <Th className="pl-4 lg:pl-3">Order ID</Th>
                        <Th>Customer</Th>
                        <Th className="text-right">Items</Th>
                        <Th className="text-right">Total</Th>
                        <Th>Payment</Th>
                        <Th>Order Status</Th>
                        <Th>Date</Th>
                        <Th className="pr-4 text-right lg:pr-3">Action</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {orders.rows.map((order) => (
                        <tr
                          key={order.id}
                          className="border-b border-neutral-50 transition last:border-0 hover:bg-neutral-50/60"
                        >
                          <Td className="pl-4 lg:pl-3">
                            <Link
                              href={`/admin/orders/${order.id}`}
                              className="whitespace-nowrap font-semibold text-brand hover:underline"
                            >
                              #{order.orderNumber}
                            </Link>
                          </Td>
                          <Td>
                            <div className="flex items-center gap-2.5">
                              <Avatar
                                src={order.customerAvatar}
                                name={order.customerName}
                                size={30}
                              />
                              <div className="min-w-0">
                                <p className="max-w-[9rem] truncate text-[13px] font-medium">
                                  {order.customerName}
                                </p>
                                <p className="max-w-[9rem] truncate text-[11px] text-neutral-400">
                                  {order.customerEmail ?? "—"}
                                </p>
                              </div>
                            </div>
                          </Td>
                          <Td className="text-right text-neutral-500">{order.itemCount}</Td>
                          <Td className="whitespace-nowrap text-right font-semibold">
                            {formatPrice(order.total)}
                          </Td>
                          <Td>
                            <StatusPill status={order.paymentStatus} />
                          </Td>
                          <Td>
                            <StatusPill status={order.status} />
                          </Td>
                          <Td className="whitespace-nowrap text-[12px] text-neutral-500">
                            {formatDateTime(order.placedAt)}
                          </Td>
                          <Td className="pr-4 text-right lg:pr-3">
                            <Link
                              href={`/admin/orders/${order.id}`}
                              title="Open order"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-neutral-400 transition hover:bg-neutral-100 hover:text-brand"
                            >
                              <Eye className="h-4 w-4" />
                            </Link>
                          </Td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </TableScroll>

                <Pagination
                  base="/admin/orders"
                  params={{
                    search: filter.search,
                    status: status === "all" ? undefined : status,
                    payment: filter.paymentStatus,
                    range: one(searchParams.range),
                  }}
                  page={page}
                  total={orders.total}
                  pageSize={PAGE_SIZE}
                  noun="orders"
                />
              </>
            )}
          </Card>
        </div>

        <div className="min-w-0 space-y-4 xl:col-span-3">
          <Card>
            <CardHeader title="Order Insights" />
            <ul className="space-y-3">
              {[
                {
                  icon: Package,
                  label: "Today's Orders",
                  value: insights.todayOrders.toLocaleString("en-US"),
                },
                {
                  icon: Banknote,
                  label: "COD Orders",
                  value: insights.codOrders.toLocaleString("en-US"),
                },
                {
                  icon: ShoppingCart,
                  label: "Avg. Order Value",
                  value: formatPrice(insights.averageOrderValue),
                },
              ].map((item) => (
                <li key={item.label} className="flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-tint">
                    <item.icon className="h-4 w-4 text-brand-dark" />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[13px] text-neutral-600">
                    {item.label}
                  </span>
                  <span className="shrink-0 text-[13px] font-bold text-neutral-900">
                    {item.value}
                  </span>
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <CardHeader title="Needs attention" />
            {counts.placed === 0 ? (
              <p className="py-4 text-sm text-neutral-400">
                Every order has been confirmed. Nothing waiting.
              </p>
            ) : (
              <>
                <p className="text-sm text-neutral-600">
                  <strong className="text-neutral-900">{counts.placed}</strong> order
                  {counts.placed === 1 ? " is" : "s are"} still awaiting confirmation.
                </p>
                <Link
                  href="/admin/orders?status=placed"
                  className={`${buttonStyles.primary} mt-3 w-full`}
                >
                  Review them
                </Link>
              </>
            )}
          </Card>

          <Card className="border-brand/20 bg-brand-tint/40">
            <p className="text-[13px] font-bold text-neutral-800">💡 Quick Tip</p>
            <p className="mt-1 text-xs leading-relaxed text-neutral-600">
              Adding a tracking number automatically marks the order as shipped and notifies the
              customer — you don&apos;t need to do both.
            </p>
          </Card>
        </div>
      </div>
    </>
  );
}
