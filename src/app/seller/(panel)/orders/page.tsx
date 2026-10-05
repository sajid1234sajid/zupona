import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { getCurrentSeller } from "@/lib/sellers";
import {
  SELLER_ORDER_TABS,
  SELLER_PAGE_SIZE,
  asOrderTab,
  getSellerOrderCounts,
  listSellerOrders,
} from "@/lib/sellerCenter";
import { formatPrice, formatRelative } from "@/lib/format";
import { resizedSrc } from "@/lib/image";
import FilterBar from "@/components/admin/FilterBar";
import { Card, EmptyState, PageHeader, Pagination, StatusPill, Thumb } from "@/components/admin/ui";
import { Tabs, one } from "@/components/seller/ui";

export const metadata = { title: "Orders" };

export default async function SellerOrdersPage(props: PageProps<"/seller/orders">) {
  const seller = await getCurrentSeller();
  if (!seller) notFound();

  const searchParams = await props.searchParams;
  const tab = asOrderTab(one(searchParams.tab));
  const search = one(searchParams.search);
  const page = Math.max(1, Number(one(searchParams.page) ?? 1) || 1);

  const [orders, counts] = await Promise.all([
    listSellerOrders(seller.id, { tab, search, page }),
    getSellerOrderCounts(seller.id),
  ]);

  const tabHref = (key: string) => {
    const query = new URLSearchParams();
    if (key !== "all") query.set("tab", key);
    if (search) query.set("search", search);
    const text = query.toString();
    return text ? `/seller/orders?${text}` : "/seller/orders";
  };

  return (
    <>
      <PageHeader
        title="Orders"
        subtitle="Confirm, pack and ship what your customers bought"
        breadcrumb={["Orders"]}
      />

      <Tabs
        current={tab}
        items={Object.entries(SELLER_ORDER_TABS).map(([key, def]) => ({
          key,
          label: def.label,
          count: counts[key as keyof typeof counts],
          href: tabHref(key),
          urgent: key === "to_process",
        }))}
      />

      <Card padded={false} className="p-4 lg:p-5">
        <FilterBar base="/seller/orders" searchPlaceholder="Order number, customer name or phone…" />

        {orders.rows.length === 0 ? (
          <EmptyState
            title={counts.all === 0 ? "No orders yet" : "Nothing here"}
            detail={
              counts.all === 0
                ? "When a customer buys one of your products, the order appears here for you to confirm and ship."
                : search
                  ? "No order matches that search."
                  : "No orders in this tab right now."
            }
          />
        ) : (
          <>
            <ul className="divide-y divide-neutral-100">
              {orders.rows.map((order) => (
                <li key={order.suborderId}>
                  <Link
                    href={`/seller/orders/${order.orderNumber}`}
                    className="-mx-2 flex items-center gap-3 rounded-xl px-2 py-3.5 transition hover:bg-neutral-50"
                  >
                    <Thumb src={order.image ? resizedSrc(order.image, 128) : null} alt="" size={52} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="text-[14px] font-bold text-neutral-900">
                          #{order.orderNumber}
                        </span>
                        <StatusPill status={order.status} />
                        {order.paymentStatus !== "paid" && order.status !== "cancelled" ? (
                          <span className="text-[11px] font-medium text-neutral-400">
                            {order.paymentLabel}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-0.5 truncate text-[13px] text-neutral-600">
                        {order.firstItem}
                        {order.lineCount > 1 ? ` + ${order.lineCount - 1} more` : ""}
                        <span className="text-neutral-400"> · {order.units} pcs</span>
                      </p>
                      <p className="mt-0.5 truncate text-[12px] text-neutral-400">
                        {order.customerName}
                        {order.area ? ` · ${order.area}` : ""} · {formatRelative(order.placedAt)}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-[14px] font-bold text-neutral-900">
                        {formatPrice(order.subtotal)}
                      </p>
                      <p className="text-[11px] text-neutral-400">
                        you get {formatPrice(order.net)}
                      </p>
                    </div>
                    <ChevronRight className="hidden h-4 w-4 shrink-0 text-neutral-300 sm:block" />
                  </Link>
                </li>
              ))}
            </ul>

            <Pagination
              base="/seller/orders"
              params={{ tab: tab === "all" ? undefined : tab, search }}
              page={page}
              total={orders.total}
              pageSize={SELLER_PAGE_SIZE}
              noun="orders"
            />
          </>
        )}
      </Card>
    </>
  );
}
