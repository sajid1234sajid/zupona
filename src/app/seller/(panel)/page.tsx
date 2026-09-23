import { notFound } from "next/navigation";
import { Package, Percent, ShoppingCart, Wallet } from "lucide-react";
import { getCurrentSeller, getSellerStats } from "@/lib/sellers";
import { formatDate, formatPrice } from "@/lib/format";
import { Card, CardHeader, PageHeader, StatCard } from "@/components/admin/ui";

export const metadata = { title: "Dashboard" };

export default async function SellerDashboardPage() {
  // The layout has already refused anyone without an approved store, so this
  // only narrows the type -- it is not a second gate.
  const seller = await getCurrentSeller();
  if (!seller) notFound();

  const stats = await getSellerStats(seller.id);

  return (
    <>
      <PageHeader
        title={`Welcome back, ${seller.storeName}`}
        subtitle="Your sales, your products and what you are owed"
        breadcrumb={["Dashboard"]}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Net earnings"
          value={formatPrice(stats.netEarnings)}
          caption="after commission"
          icon={Wallet}
          tone="green"
        />
        <StatCard
          label="Orders"
          value={String(stats.orderCount)}
          caption="excluding cancelled"
          icon={ShoppingCart}
          tone="blue"
        />
        <StatCard
          label="Products live"
          value={`${stats.activeProductCount} of ${stats.productCount}`}
          caption="active in the shop"
          icon={Package}
          tone="violet"
        />
        <StatCard
          label="Awaiting payout"
          value={formatPrice(stats.pendingPayout)}
          caption="not yet paid out"
          icon={Percent}
          tone="orange"
        />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-12">
        <div className="min-w-0 xl:col-span-7">
          <Card>
            <CardHeader
              title="How your earnings are worked out"
              subtitle="Every figure here comes from your own orders only"
            />
            <dl className="divide-y divide-neutral-100 text-sm">
              <div className="flex items-center justify-between gap-3 py-2.5">
                <dt className="text-neutral-500">Gross sales</dt>
                <dd className="font-semibold text-neutral-800">{formatPrice(stats.grossSales)}</dd>
              </div>
              <div className="flex items-center justify-between gap-3 py-2.5">
                <dt className="text-neutral-500">
                  Zupona commission
                  <span className="ml-1.5 text-neutral-400">({seller.commissionRate}%)</span>
                </dt>
                <dd className="font-semibold text-red-600">
                  −{formatPrice(stats.commissionOwed)}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3 py-2.5">
                <dt className="font-medium text-neutral-700">Your earnings</dt>
                <dd className="text-base font-bold text-brand">{formatPrice(stats.netEarnings)}</dd>
              </div>
            </dl>
            <p className="mt-3 rounded-xl bg-neutral-50 px-3.5 py-2.5 text-[11px] leading-relaxed text-neutral-500">
              Earnings are held until an order can no longer be returned, then paid to the account
              on your store profile.
            </p>
          </Card>
        </div>

        <div className="min-w-0 xl:col-span-5">
          <Card>
            <CardHeader title="Your store" subtitle="Approved and selling on Zupona" />
            <dl className="divide-y divide-neutral-100 text-sm">
              <div className="flex items-center justify-between gap-3 py-2.5">
                <dt className="text-neutral-500">Store name</dt>
                <dd className="min-w-0 truncate font-medium text-neutral-800">
                  {seller.storeName}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3 py-2.5">
                <dt className="text-neutral-500">Store URL</dt>
                <dd className="min-w-0 truncate font-mono text-[13px] text-neutral-600">
                  /{seller.slug}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3 py-2.5">
                <dt className="text-neutral-500">Commission rate</dt>
                <dd className="font-medium text-neutral-800">{seller.commissionRate}%</dd>
              </div>
              <div className="flex items-center justify-between gap-3 py-2.5">
                <dt className="text-neutral-500">Selling since</dt>
                <dd className="font-medium text-neutral-800">{formatDate(seller.createdAt)}</dd>
              </div>
            </dl>
          </Card>
        </div>
      </div>
    </>
  );
}
