import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AlertTriangle,
  Banknote,
  CheckCircle2,
  ChevronRight,
  Circle,
  Clock,
  HandCoins,
  MessageSquare,
  PackageX,
  Plus,
  ShoppingCart,
  Truck,
  Wallet,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { getCurrentSeller, getSellerStats } from "@/lib/sellers";
import {
  getSellerAttention,
  getSellerReviewStats,
  getSellerSalesSeries,
  getSellerSummary,
  getSellerTopProducts,
  listSellerOrders,
} from "@/lib/sellerCenter";
import { getPayoutAccount, getSellerBalance } from "@/lib/sellerPayouts";
import { formatDate, formatPrice, formatRelative } from "@/lib/format";
import { resizedSrc } from "@/lib/image";
import SalesChart from "@/components/admin/SalesChart";
import { Card, CardHeader, PageHeader, StatCard, StatusPill, Thumb, buttonStyles } from "@/components/admin/ui";
import { Row } from "@/components/seller/ui";

export const metadata = { title: "Dashboard" };

interface Task {
  label: string;
  count: number;
  href: string;
  icon: LucideIcon;
  tone: string;
}

export default async function SellerDashboardPage() {
  // The layout has already refused anyone without an approved store, so this
  // only narrows the type -- it is not a second gate.
  const seller = await getCurrentSeller();
  if (!seller) notFound();

  // Everything here depends only on the store, so it is read in one wave.
  const [stats, attention, summary, series, top, recent, balance, account, reviews] = await Promise.all([
    getSellerStats(seller.id),
    getSellerAttention(seller.id),
    getSellerSummary(seller.id, "30d"),
    getSellerSalesSeries(seller.id, "30d"),
    getSellerTopProducts(seller.id, "30d", 5),
    listSellerOrders(seller.id, { page: 1, pageSize: 5 }),
    getSellerBalance(seller.id),
    getPayoutAccount(seller.id),
    getSellerReviewStats(seller.id),
  ]);

  const tasks: Task[] = [
    { label: "Orders to confirm", count: attention.toConfirm, href: "/seller/orders?tab=to_process", icon: ShoppingCart, tone: "text-amber-600 bg-amber-50" },
    { label: "Orders to ship", count: attention.toShip, href: "/seller/orders?tab=to_process", icon: Truck, tone: "text-sky-600 bg-sky-50" },
    { label: "Out of stock", count: attention.outOfStock, href: "/seller/products?tab=out", icon: PackageX, tone: "text-red-600 bg-red-50" },
    { label: "Running low", count: attention.lowStock, href: "/seller/products?tab=low", icon: AlertTriangle, tone: "text-amber-600 bg-amber-50" },
    { label: "Sent back by Zupona", count: attention.rejected, href: "/seller/products?tab=rejected", icon: XCircle, tone: "text-red-600 bg-red-50" },
    { label: "Waiting for review", count: attention.pendingReview, href: "/seller/products?tab=pending_review", icon: Clock, tone: "text-violet-600 bg-violet-50" },
    { label: "Reviews to answer", count: attention.unrepliedReviews, href: "/seller/reviews?filter=unreplied", icon: MessageSquare, tone: "text-emerald-600 bg-emerald-50" },
  ].filter((task) => task.count > 0);

  const setup = [
    { label: "Add your store logo", done: Boolean(seller.logoUrl), href: "/seller/settings" },
    { label: "Tell shoppers about your store", done: Boolean(seller.description), href: "/seller/settings" },
    { label: "Set where your earnings are sent", done: Boolean(account.method && account.accountNumber), href: "/seller/finance" },
    { label: "Add your first product", done: stats.productCount > 0, href: "/seller/products/new" },
    { label: "Get your first product live", done: stats.activeProductCount > 0, href: "/seller/products" },
  ];
  const setupDone = setup.filter((step) => step.done).length;

  return (
    <>
      <PageHeader
        title={`Welcome back, ${seller.storeName}`}
        subtitle="Your sales, your orders and what needs you today"
        breadcrumb={["Dashboard"]}
        action={
          <Link href="/seller/products/new" className={buttonStyles.primary}>
            <Plus className="h-4 w-4" />
            Add Product
          </Link>
        }
      />

      {setupDone < setup.length ? (
        <Card className="mb-5 border-brand/20">
          <CardHeader
            title="Get your store ready to sell"
            subtitle={`${setupDone} of ${setup.length} done`}
          />
          <div className="mb-4 h-2 overflow-hidden rounded-full bg-neutral-100">
            <div
              className="h-full rounded-full bg-brand transition-all"
              style={{ width: `${(setupDone / setup.length) * 100}%` }}
            />
          </div>
          <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {setup.map((step) => (
              <li key={step.label}>
                <Link
                  href={step.href}
                  className={`flex items-center gap-2.5 rounded-xl border px-3.5 py-3 text-[13px] font-medium transition ${
                    step.done
                      ? "border-emerald-100 bg-emerald-50/50 text-emerald-700"
                      : "border-neutral-200 text-neutral-700 hover:border-brand hover:text-brand"
                  }`}
                >
                  {step.done ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                  ) : (
                    <Circle className="h-4 w-4 shrink-0 text-neutral-300" />
                  )}
                  <span className={step.done ? "line-through decoration-emerald-300" : undefined}>
                    {step.label}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Card className="mb-5">
        <CardHeader title="Needs your attention" />
        {tasks.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-emerald-700">
            <CheckCircle2 className="h-4 w-4" />
            You&rsquo;re all caught up. Nothing is waiting on you.
          </p>
        ) : (
          <ul className="grid grid-cols-2 gap-2.5 md:grid-cols-3 xl:grid-cols-4">
            {tasks.map((task) => (
              <li key={task.label}>
                <Link
                  href={task.href}
                  className="flex items-center gap-3 rounded-xl border border-neutral-100 p-3 transition hover:border-brand/40 hover:shadow-sm"
                >
                  <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${task.tone}`}>
                    <task.icon className="h-5 w-5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-xl font-bold leading-tight text-neutral-900">{task.count}</span>
                    <span className="block truncate text-[12px] text-neutral-500">{task.label}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4 xl:gap-4">
        <StatCard
          label="Sales · 30 days"
          value={formatPrice(summary.revenue.value)}
          change={summary.revenue.change}
          caption="vs previous 30 days"
          icon={Banknote}
          tone="green"
          href="/seller/analytics"
        />
        <StatCard
          label="Orders · 30 days"
          value={String(summary.orders.value)}
          change={summary.orders.change}
          caption="vs previous 30 days"
          icon={ShoppingCart}
          tone="blue"
          href="/seller/orders"
        />
        <StatCard
          label="Ready for payout"
          value={formatPrice(balance.payable)}
          icon={HandCoins}
          tone="orange"
          href="/seller/finance"
        />
        <StatCard
          label="Earned all time"
          value={formatPrice(stats.netEarnings)}
          icon={Wallet}
          tone="violet"
          href="/seller/finance"
        />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-12">
        <div className="min-w-0 space-y-5 xl:col-span-8">
          <Card>
            <CardHeader
              title="Sales · last 30 days"
              action={
                <Link href="/seller/analytics" className="text-xs font-semibold text-brand hover:underline">
                  Analytics
                </Link>
              }
            />
            <SalesChart points={series} />
          </Card>

          <Card>
            <CardHeader
              title="Latest orders"
              action={
                <Link href="/seller/orders" className="text-xs font-semibold text-brand hover:underline">
                  View all
                </Link>
              }
            />
            {recent.rows.length === 0 ? (
              <p className="py-6 text-center text-sm text-neutral-400">
                No orders yet. They appear here the moment a customer buys.
              </p>
            ) : (
              <ul className="divide-y divide-neutral-100">
                {recent.rows.map((order) => (
                  <li key={order.suborderId}>
                    <Link
                      href={`/seller/orders/${order.orderNumber}`}
                      className="-mx-2 flex items-center gap-3 rounded-xl px-2 py-2.5 transition hover:bg-neutral-50"
                    >
                      <Thumb src={order.image ? resizedSrc(order.image, 128) : null} alt="" size={40} />
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-semibold text-neutral-800">#{order.orderNumber}</p>
                        <p className="truncate text-[12px] text-neutral-400">
                          {order.customerName} · {formatRelative(order.placedAt)}
                        </p>
                      </div>
                      <StatusPill status={order.status} />
                      <span className="hidden w-20 shrink-0 text-right text-[13px] font-bold text-neutral-900 sm:block">
                        {formatPrice(order.subtotal)}
                      </span>
                      <ChevronRight className="h-4 w-4 shrink-0 text-neutral-300" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="min-w-0 space-y-5 xl:col-span-4">
          <Card>
            <CardHeader title="Best sellers" subtitle="Last 30 days" />
            {top.length === 0 ? (
              <p className="py-6 text-center text-sm text-neutral-400">No sales yet.</p>
            ) : (
              <ul className="space-y-3">
                {top.map((product) => (
                  <li key={product.productId} className="flex items-center gap-2.5">
                    <Thumb src={product.image ? resizedSrc(product.image, 128) : null} alt="" size={36} />
                    <Link
                      href={`/seller/products/${product.productId}`}
                      className="min-w-0 flex-1 truncate text-[13px] font-medium text-neutral-700 hover:text-brand"
                    >
                      {product.name}
                    </Link>
                    <span className="shrink-0 text-right text-[12px]">
                      <span className="block font-bold text-neutral-900">{formatPrice(product.revenue)}</span>
                      <span className="block text-neutral-400">{product.units} sold</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader title="Your store" subtitle={seller.status === "approved" ? "Approved and selling on Zupona" : `Status: ${seller.status}`} />
            <dl className="divide-y divide-neutral-100 text-sm">
              <Row label="Products live">
                {stats.activeProductCount} of {stats.productCount}
              </Row>
              <Row label="Commission rate">{seller.commissionRate}%</Row>
              <Row label="Rating">
                {reviews.total ? `${reviews.average} ★ (${reviews.total})` : "No reviews yet"}
              </Row>
              <Row label="Selling since">{formatDate(seller.createdAt)}</Row>
            </dl>
          </Card>
        </div>
      </div>
    </>
  );
}
