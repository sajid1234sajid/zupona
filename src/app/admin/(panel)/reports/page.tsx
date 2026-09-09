import Link from "next/link";
import { CreditCard, Package, ShoppingCart, TrendingUp, Users } from "lucide-react";
import { getTopProducts } from "@/lib/admin";
import {
  asRange,
  getDashboardSummary,
  getOrdersByCity,
  getRevenueByPayment,
  getSalesSeries,
  getTopCategories,
  getTopCustomers,
} from "@/lib/adminData";
import { formatPrice } from "@/lib/format";
import { BarList, SeriesTable } from "@/components/admin/charts";
import SalesChart from "@/components/admin/SalesChart";
import RangeTabs from "@/components/admin/RangeTabs";
import {
  Avatar,
  Card,
  CardHeader,
  PageHeader,
  StatCard,
  Td,
  Th,
  TableScroll,
} from "@/components/admin/ui";

export const metadata = { title: "Reports" };

function one(value: string | string[] | undefined): string | undefined {
  const single = Array.isArray(value) ? value[0] : value;
  return single || undefined;
}

export default async function ReportsPage(props: PageProps<"/admin/reports">) {
  const searchParams = await props.searchParams;
  const range = asRange(one(searchParams.range), "30d");
  const days = range === "all" ? "all time" : `last ${range.replace("d", " days")}`;

  const [summary, series, byPayment, byCity, topCustomers, topProducts, topCategories] =
    await Promise.all([
      getDashboardSummary(range),
      getSalesSeries(range),
      getRevenueByPayment(range),
      getOrdersByCity(range),
      getTopCustomers(range),
      getTopProducts(8, range === "all" ? 36500 : Number(range.replace("d", ""))),
      getTopCategories(6, range),
    ]);

  const averageOrder =
    summary.orders.value === 0 ? 0 : Math.round(summary.revenue.value / summary.orders.value);

  return (
    <>
      <PageHeader
        title="Reports"
        subtitle={`Sales, products and customers over the ${days}`}
        breadcrumb={["Reports"]}
        action={<RangeTabs base="/admin/reports" params={searchParams} current={range} />}
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <StatCard
          label="Revenue"
          value={formatPrice(summary.revenue.value)}
          change={summary.revenue.change}
          caption={`vs previous ${days}`}
          icon={TrendingUp}
          tone="green"
        />
        <StatCard
          label="Orders"
          value={summary.orders.value.toLocaleString("en-US")}
          change={summary.orders.change}
          caption={`vs previous ${days}`}
          icon={ShoppingCart}
          tone="blue"
        />
        <StatCard
          label="Avg. Order Value"
          value={formatPrice(averageOrder)}
          icon={CreditCard}
          tone="orange"
        />
        <StatCard
          label="New Customers"
          value={summary.customers.value.toLocaleString("en-US")}
          change={summary.customers.change}
          caption={`vs previous ${days}`}
          icon={Users}
          tone="pink"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-12">
        <Card className="xl:col-span-8">
          <CardHeader title="Revenue Over Time" subtitle={`Daily takings, ${days}`} />
          <SalesChart points={series} />
          <SeriesTable points={series} />
        </Card>

        <Card className="xl:col-span-4">
          <CardHeader title="Revenue by Payment Method" />
          {byPayment.length === 0 ? (
            <p className="py-8 text-center text-sm text-neutral-400">No paid orders yet.</p>
          ) : (
            <BarList
              rows={byPayment.map((row) => ({
                label: row.label,
                value: row.revenue,
                meta: `${row.orders} orders`,
              }))}
              format={formatPrice}
            />
          )}
        </Card>

        <Card className="xl:col-span-4">
          <CardHeader title="Top Categories" />
          {topCategories.length === 0 ? (
            <p className="py-8 text-center text-sm text-neutral-400">No sales in this window.</p>
          ) : (
            <BarList
              rows={topCategories.map((row) => ({
                label: row.name,
                value: row.revenue,
                meta: `${row.units} sold`,
              }))}
              format={formatPrice}
            />
          )}
        </Card>

        <Card className="xl:col-span-4">
          <CardHeader title="Orders by City" />
          {byCity.length === 0 ? (
            <p className="py-8 text-center text-sm text-neutral-400">No orders in this window.</p>
          ) : (
            <BarList
              rows={byCity.map((row) => ({
                label: row.city,
                value: row.orders,
                meta: formatPrice(row.revenue),
              }))}
            />
          )}
        </Card>

        <Card className="xl:col-span-4">
          <CardHeader
            title="Top Customers"
            action={
              <Link href="/admin/customers" className="text-xs font-semibold text-brand hover:underline">
                View all
              </Link>
            }
          />
          {topCustomers.length === 0 ? (
            <p className="py-8 text-center text-sm text-neutral-400">No orders in this window.</p>
          ) : (
            <ul className="space-y-3">
              {topCustomers.map((customer) => (
                <li key={customer.id} className="flex items-center gap-3">
                  <Avatar src={customer.avatar_url} name={customer.name} size={32} />
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/admin/customers/${customer.id}`}
                      className="block truncate text-[13px] font-medium text-neutral-800 hover:text-brand"
                    >
                      {customer.name}
                    </Link>
                    <p className="truncate text-[11px] text-neutral-400">
                      {customer.orders} order{customer.orders === 1 ? "" : "s"}
                    </p>
                  </div>
                  <span className="shrink-0 whitespace-nowrap text-[13px] font-semibold text-neutral-800">
                    {formatPrice(customer.spent)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="xl:col-span-12">
          <CardHeader
            title="Best Selling Products"
            subtitle={`By units sold, ${days}`}
            action={
              <Link href="/admin/products" className="text-xs font-semibold text-brand hover:underline">
                All products
              </Link>
            }
          />
          {topProducts.length === 0 ? (
            <p className="flex items-center justify-center gap-2 py-10 text-sm text-neutral-400">
              <Package className="h-4 w-4" />
              No sales in this window.
            </p>
          ) : (
            <TableScroll>
              <table className="w-full min-w-[520px] border-collapse">
                <thead>
                  <tr className="border-b border-neutral-100">
                    <Th className="pl-4 lg:pl-3">#</Th>
                    <Th>Product</Th>
                    <Th className="text-right">Units sold</Th>
                    <Th className="text-right">Revenue</Th>
                    <Th className="pr-4 text-right lg:pr-3">Avg. price</Th>
                  </tr>
                </thead>
                <tbody>
                  {topProducts.map((product, index) => (
                    <tr key={product.product_id} className="border-b border-neutral-50 last:border-0">
                      <Td className="pl-4 text-neutral-400 lg:pl-3">{index + 1}</Td>
                      <Td>
                        <Link
                          href={`/admin/products/${product.product_id}`}
                          className="block max-w-[22rem] truncate font-medium text-neutral-800 hover:text-brand"
                        >
                          {product.name}
                        </Link>
                      </Td>
                      <Td className="text-right text-neutral-600">{product.units}</Td>
                      <Td className="whitespace-nowrap text-right font-semibold">
                        {formatPrice(product.revenue)}
                      </Td>
                      <Td className="whitespace-nowrap pr-4 text-right text-neutral-500 lg:pr-3">
                        {formatPrice(Math.round(product.revenue / Math.max(1, product.units)))}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableScroll>
          )}
        </Card>
      </div>
    </>
  );
}
