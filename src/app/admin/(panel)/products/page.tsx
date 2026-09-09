import Link from "next/link";
import { AlertTriangle, CheckCircle2, FileText, Package, Plus, XCircle } from "lucide-react";
import { listBrands } from "@/lib/catalog";
import {
  PAGE_SIZE,
  asRange,
  getProductStats,
  getSalesSeries,
  getTopCategories,
  listAdminProducts,
  listCategoryOptions,
  listOrders,
} from "@/lib/adminData";
import { formatPrice, formatRelative } from "@/lib/format";
import { BarList } from "@/components/admin/charts";
import SalesChart from "@/components/admin/SalesChart";
import FilterBar from "@/components/admin/FilterBar";
import ProductTable from "@/components/admin/ProductTable";
import RangeTabs from "@/components/admin/RangeTabs";
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

export const metadata = { title: "Products" };

/** searchParams values are `string | string[]`; every filter here is
 * single-valued, so the first entry is the one that counts. */
function one(value: string | string[] | undefined): string | undefined {
  const single = Array.isArray(value) ? value[0] : value;
  return single || undefined;
}

export default async function ProductsPage(props: PageProps<"/admin/products">) {
  const searchParams = await props.searchParams;

  const filter = {
    search: one(searchParams.search),
    categoryId: one(searchParams.category),
    brandId: one(searchParams.brand),
    status: one(searchParams.status),
    range: asRange(one(searchParams.range), "all"),
    page: Math.max(1, Number(one(searchParams.page) ?? 1) || 1),
  };

  const chartRange = asRange(one(searchParams.range), "7d");

  const [products, stats, categories, brands, series, topCategories, recentOrders] =
    await Promise.all([
      listAdminProducts(filter),
      getProductStats(),
      listCategoryOptions(),
      listBrands(),
      getSalesSeries(chartRange),
      getTopCategories(5, chartRange),
      listOrders({ page: 1 }),
    ]);

  return (
    <>
      <PageHeader
        title="Products"
        subtitle="Manage your store products"
        breadcrumb={["Products", "All Products"]}
        action={
          <Link href="/admin/products/new" className={buttonStyles.primary}>
            <Plus className="h-4 w-4" />
            Add Product
          </Link>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-5 lg:gap-4">
        <StatCard label="Total Products" value={String(stats.total)} icon={Package} tone="green" />
        <StatCard
          label="Published"
          value={String(stats.published)}
          icon={CheckCircle2}
          tone="green"
          href="/admin/products?status=active"
        />
        <StatCard
          label="Draft"
          value={String(stats.draft)}
          icon={FileText}
          tone="blue"
          href="/admin/products?status=draft"
        />
        <StatCard label="Low Stock" value={String(stats.lowStock)} icon={AlertTriangle} tone="orange" />
        <StatCard label="Out of Stock" value={String(stats.outOfStock)} icon={XCircle} tone="red" />
      </div>

      <div className="grid gap-5 xl:grid-cols-12">
        <div className="min-w-0 xl:col-span-9">
          <Card padded={false} className="p-4 lg:p-5">
            <FilterBar
              base="/admin/products"
              searchPlaceholder="Search product name, brand, category…"
              selects={[
                {
                  name: "category",
                  allLabel: "All Categories",
                  options: categories.map((category) => ({
                    value: category.id,
                    label: category.label.replace(/— /g, "· "),
                  })),
                },
                {
                  name: "brand",
                  allLabel: "All Brands",
                  options: brands.map((brand) => ({ value: brand.id, label: brand.name })),
                },
                {
                  name: "status",
                  allLabel: "All Status",
                  options: [
                    { value: "active", label: "Published" },
                    { value: "draft", label: "Draft" },
                    { value: "pending_review", label: "Pending review" },
                    { value: "archived", label: "Archived" },
                  ],
                },
              ]}
            />

            {products.rows.length === 0 ? (
              <EmptyState
                title="No products match these filters"
                detail="Try clearing the search or picking a different category."
                action={
                  <Link href="/admin/products" className={buttonStyles.secondary}>
                    Clear filters
                  </Link>
                }
              />
            ) : (
              <>
                <ProductTable rows={products.rows} />
                <Pagination
                  base="/admin/products"
                  params={{
                    search: filter.search,
                    category: filter.categoryId,
                    brand: filter.brandId,
                    status: filter.status,
                    range: one(searchParams.range),
                  }}
                  page={filter.page}
                  total={products.total}
                  pageSize={PAGE_SIZE}
                  noun="products"
                />
              </>
            )}
          </Card>
        </div>

        <div className="min-w-0 space-y-4 xl:col-span-3">
          <Card>
            <CardHeader
              title="Sales Overview"
              action={
                <RangeTabs
                  base="/admin/products"
                  params={searchParams}
                  current={chartRange}
                  compact
                />
              }
            />
            <SalesChart points={series} />
          </Card>

          <Card>
            <CardHeader title="Top Categories" subtitle="By revenue in this window" />
            {topCategories.length === 0 ? (
              <p className="py-6 text-center text-sm text-neutral-400">No sales yet.</p>
            ) : (
              <BarList
                rows={topCategories.map((category) => ({
                  label: category.name,
                  value: category.revenue,
                  meta: `${category.units} sold`,
                }))}
                format={formatPrice}
              />
            )}
          </Card>

          <Card>
            <CardHeader
              title="Recent Orders"
              action={
                <Link href="/admin/orders" className="text-xs font-semibold text-brand hover:underline">
                  View All
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
            <p className="text-[13px] font-bold text-neutral-800">💡 Quick Tip</p>
            <p className="mt-1 text-xs leading-relaxed text-neutral-600">
              Keep stock counts current — a product that sells out while still listed as available
              costs you the order and the customer.
            </p>
          </Card>
        </div>
      </div>
    </>
  );
}
