import Link from "next/link";
import { notFound } from "next/navigation";
import { Banknote, Package, Receipt, ShoppingCart, Wallet } from "lucide-react";
import { getCurrentSeller } from "@/lib/sellers";
import { asRange } from "@/lib/adminData";
import {
  getSellerProductPerformance,
  getSellerSalesByArea,
  getSellerSalesSeries,
  getSellerStatusMix,
  getSellerSummary,
  getSellerTopProducts,
} from "@/lib/sellerCenter";
import { formatPrice } from "@/lib/format";
import { resizedSrc } from "@/lib/image";
import SalesChart from "@/components/admin/SalesChart";
import RangeTabs from "@/components/admin/RangeTabs";
import { BarList, DonutChart, statusColor } from "@/components/admin/charts";
import {
  Card,
  CardHeader,
  EmptyState,
  PageHeader,
  StatCard,
  StatusPill,
  TableScroll,
  Td,
  Th,
  Thumb,
  statusLabel,
} from "@/components/admin/ui";
import { one } from "@/components/seller/ui";

export const metadata = { title: "Analytics" };

const RANGE_CAPTION: Record<string, string> = {
  "7d": "vs previous 7 days",
  "30d": "vs previous 30 days",
  "90d": "vs previous 90 days",
  all: "all time",
};

export default async function SellerAnalyticsPage(props: PageProps<"/seller/analytics">) {
  const seller = await getCurrentSeller();
  if (!seller) notFound();

  const searchParams = await props.searchParams;
  const range = asRange(one(searchParams.range), "30d");

  // Six independent reads; the database is in Singapore, so they go together.
  const [summary, series, top, areas, mix, performance] = await Promise.all([
    getSellerSummary(seller.id, range),
    getSellerSalesSeries(seller.id, range),
    getSellerTopProducts(seller.id, range, 6),
    getSellerSalesByArea(seller.id, range, 8),
    getSellerStatusMix(seller.id, range),
    getSellerProductPerformance(seller.id, 50),
  ]);

  const caption = RANGE_CAPTION[range];
  const totalViews = performance.reduce((sum, row) => sum + row.views, 0);
  const totalSold = performance.reduce((sum, row) => sum + row.unitsSold, 0);

  return (
    <>
      <PageHeader
        title="Analytics"
        subtitle="How your store is selling, and what shoppers do with your products"
        breadcrumb={["Analytics"]}
        action={<RangeTabs base="/seller/analytics" params={searchParams} current={range} compact />}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5 lg:gap-4">
        <StatCard
          label="Sales"
          value={formatPrice(summary.revenue.value)}
          change={summary.revenue.change}
          caption={caption}
          icon={Banknote}
          tone="green"
        />
        <StatCard
          label="You earned"
          value={formatPrice(summary.net.value)}
          change={summary.net.change}
          caption="after commission"
          icon={Wallet}
          tone="green"
        />
        <StatCard
          label="Orders"
          value={summary.orders.value.toLocaleString("en-US")}
          change={summary.orders.change}
          caption={caption}
          icon={ShoppingCart}
          tone="blue"
        />
        <StatCard
          label="Units sold"
          value={summary.units.value.toLocaleString("en-US")}
          change={summary.units.change}
          caption={caption}
          icon={Package}
          tone="violet"
        />
        <StatCard
          label="Average order"
          value={formatPrice(summary.averageOrder.value)}
          change={summary.averageOrder.change}
          caption={caption}
          icon={Receipt}
          tone="orange"
        />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-12">
        <div className="min-w-0 xl:col-span-8">
          <Card>
            <CardHeader
              title="Sales over time"
              subtitle={`Your items' value per day${range === "all" ? " (last 90 days)" : ""}`}
            />
            <SalesChart points={series} />
          </Card>
        </div>
        <div className="min-w-0 xl:col-span-4">
          <Card className="h-full">
            <CardHeader
              title="Order outcomes"
              subtitle={`${summary.cancelRate}% cancelled in this period`}
            />
            {mix.length === 0 ? (
              <p className="py-10 text-center text-sm text-neutral-400">No orders in this period.</p>
            ) : (
              <DonutChart
                slices={mix.map((slice) => ({
                  label: statusLabel(slice.status),
                  value: slice.count,
                  color: statusColor(slice.status),
                }))}
                total={mix.reduce((sum, slice) => sum + slice.count, 0)}
                totalLabel="orders"
              />
            )}
          </Card>
        </div>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="Best sellers" subtitle="By sales in this period" />
          {top.length === 0 ? (
            <p className="py-8 text-center text-sm text-neutral-400">No sales in this period yet.</p>
          ) : (
            <ul className="space-y-3">
              {top.map((product, index) => (
                <li key={product.productId} className="flex items-center gap-3">
                  <span className="w-4 shrink-0 text-center text-[12px] font-bold text-neutral-400">
                    {index + 1}
                  </span>
                  <Thumb src={product.image ? resizedSrc(product.image, 128) : null} alt="" size={40} />
                  <Link
                    href={`/seller/products/${product.productId}`}
                    className="min-w-0 flex-1 truncate text-[13px] font-medium text-neutral-800 hover:text-brand"
                  >
                    {product.name}
                  </Link>
                  <span className="shrink-0 text-right">
                    <span className="block text-[13px] font-bold text-neutral-900">
                      {formatPrice(product.revenue)}
                    </span>
                    <span className="block text-[11px] text-neutral-400">{product.units} sold</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title="Where your customers are" subtitle="Sales by district" />
          {areas.length === 0 ? (
            <p className="py-8 text-center text-sm text-neutral-400">No sales in this period yet.</p>
          ) : (
            <BarList
              rows={areas.map((area) => ({
                label: area.area,
                value: area.revenue,
                meta: `${area.orders} order${area.orders === 1 ? "" : "s"}`,
              }))}
              format={formatPrice}
            />
          )}
        </Card>
      </div>

      <Card className="mt-5">
        <CardHeader
          title="Product performance"
          subtitle={`All time · ${totalViews.toLocaleString("en-US")} page views, ${totalSold.toLocaleString(
            "en-US"
          )} units sold`}
        />
        {performance.length === 0 ? (
          <EmptyState
            title="No products yet"
            detail="Once your products are live, you'll see how many people look at each one and how many buy."
          />
        ) : (
          <TableScroll>
            <table className="w-full min-w-[720px] border-collapse">
              <thead>
                <tr className="border-b border-neutral-100">
                  <Th className="pl-4 lg:pl-3">Product</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Views</Th>
                  <Th className="text-right">Sold</Th>
                  <Th className="text-right">Conversion</Th>
                  <Th className="text-right">Sales</Th>
                  <Th className="pr-4 text-right lg:pr-3">Rating</Th>
                </tr>
              </thead>
              <tbody>
                {performance.map((row) => (
                  <tr key={row.id} className="border-b border-neutral-50 last:border-0">
                    <Td className="pl-4 lg:pl-3">
                      <Link href={`/seller/products/${row.id}`} className="flex items-center gap-2.5">
                        <Thumb src={row.image ? resizedSrc(row.image, 128) : null} alt="" size={36} />
                        <span className="max-w-[16rem] truncate font-medium text-neutral-800 hover:text-brand">
                          {row.name}
                        </span>
                      </Link>
                    </Td>
                    <Td>
                      <StatusPill status={row.status} label={row.status === "active" ? "Live" : undefined} />
                    </Td>
                    <Td className="text-right text-neutral-600">{row.views.toLocaleString("en-US")}</Td>
                    <Td className="text-right text-neutral-600">{row.unitsSold.toLocaleString("en-US")}</Td>
                    <Td className="text-right">
                      <span
                        className={
                          row.views >= 50 && row.conversion < 1
                            ? "font-semibold text-amber-600"
                            : "text-neutral-600"
                        }
                        title={
                          row.views >= 50 && row.conversion < 1
                            ? "Many people look but few buy: check the price, photos and description"
                            : undefined
                        }
                      >
                        {row.views ? `${row.conversion}%` : "—"}
                      </span>
                    </Td>
                    <Td className="whitespace-nowrap text-right font-semibold">{formatPrice(row.revenue)}</Td>
                    <Td className="pr-4 text-right text-neutral-600 lg:pr-3">
                      {row.ratingCount ? `${row.rating} ★ (${row.ratingCount})` : "—"}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
        )}
        <p className="mt-3 text-[11px] leading-relaxed text-neutral-400">
          Conversion is units sold for every 100 product-page views. A product many people view
          but few buy (highlighted) usually needs a better price, clearer photos or a fuller
          description.
        </p>
      </Card>
    </>
  );
}
