import Link from "next/link";
import { Check, Clock, Store, X } from "lucide-react";
import { PAGE_SIZE, listAdminSellers } from "@/lib/adminData";
import { formatDate, formatPrice } from "@/lib/format";
import FilterBar from "@/components/admin/FilterBar";
import {
  Card,
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
import { setCommissionAction, setSellerStatusAction } from "./actions";

export const metadata = { title: "Distributors" };

function one(value: string | string[] | undefined): string | undefined {
  const single = Array.isArray(value) ? value[0] : value;
  return single || undefined;
}

export default async function DistributorsPage(props: PageProps<"/admin/distributors">) {
  const searchParams = await props.searchParams;

  const filter = {
    search: one(searchParams.search),
    status: one(searchParams.status),
    page: Math.max(1, Number(one(searchParams.page) ?? 1) || 1),
  };

  // Counts come from unfiltered pages so the tiles describe the whole
  // marketplace, not just what the current filter shows.
  const [sellers, all, pending, approved] = await Promise.all([
    listAdminSellers(filter),
    listAdminSellers({ page: 1 }),
    listAdminSellers({ status: "pending", page: 1 }),
    listAdminSellers({ status: "approved", page: 1 }),
  ]);

  return (
    <>
      <PageHeader
        title="Distributors"
        subtitle="Stores selling on the Zupona marketplace"
        breadcrumb={["Distributors"]}
      />

      <div className="mb-5 grid grid-cols-3 gap-3 lg:gap-4">
        <StatCard label="Total Stores" value={all.total.toLocaleString("en-US")} icon={Store} tone="green" />
        <StatCard
          label="Approved"
          value={approved.total.toLocaleString("en-US")}
          icon={Check}
          tone="blue"
          href="/admin/distributors?status=approved"
        />
        <StatCard
          label="Awaiting Review"
          value={pending.total.toLocaleString("en-US")}
          icon={Clock}
          tone="orange"
          href="/admin/distributors?status=pending"
        />
      </div>

      <Card>
        <FilterBar
          base="/admin/distributors"
          searchPlaceholder="Search by store name or owner…"
          selects={[
            {
              name: "status",
              allLabel: "All Status",
              options: [
                { value: "pending", label: "Pending" },
                { value: "approved", label: "Approved" },
                { value: "suspended", label: "Suspended" },
                { value: "rejected", label: "Rejected" },
              ],
            },
          ]}
        />

        {sellers.rows.length === 0 ? (
          <EmptyState
            title="No distributors yet"
            detail="Stores appear here once someone applies to sell on Zupona."
            action={
              <Link href="/admin/distributors" className={buttonStyles.secondary}>
                Clear filters
              </Link>
            }
          />
        ) : (
          <>
            <TableScroll>
              <table className="w-full min-w-[900px] border-collapse">
                <thead>
                  <tr className="border-b border-neutral-100">
                    <Th className="pl-4 lg:pl-3">Store</Th>
                    <Th>Owner</Th>
                    <Th className="text-right">Products</Th>
                    <Th className="text-right">Orders</Th>
                    <Th className="text-right">Gross Sales</Th>
                    <Th className="text-right">Commission</Th>
                    <Th>Status</Th>
                    <Th className="pr-4 text-right lg:pr-3">Action</Th>
                  </tr>
                </thead>
                <tbody>
                  {sellers.rows.map((seller) => (
                    <tr
                      key={seller.id}
                      className="border-b border-neutral-50 transition last:border-0 hover:bg-neutral-50/60"
                    >
                      <Td className="pl-4 lg:pl-3">
                        <div className="flex items-center gap-2.5">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-neutral-100 bg-neutral-50">
                            {seller.logoUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={seller.logoUrl} alt="" className="h-full w-full object-cover" />
                            ) : (
                              <Store className="h-4 w-4 text-neutral-300" />
                            )}
                          </span>
                          <div className="min-w-0">
                            <p className="max-w-[10rem] truncate font-medium text-neutral-800">
                              {seller.storeName}
                            </p>
                            <p className="text-[11px] text-neutral-400">
                              Joined {formatDate(seller.createdAt)}
                            </p>
                          </div>
                        </div>
                      </Td>
                      <Td>
                        <p className="max-w-[10rem] truncate text-[13px] text-neutral-700">
                          {seller.ownerName}
                        </p>
                        <p className="max-w-[10rem] truncate text-[11px] text-neutral-400">
                          {seller.ownerEmail ?? "—"}
                        </p>
                      </Td>
                      <Td className="text-right text-neutral-600">{seller.productCount}</Td>
                      <Td className="text-right text-neutral-600">{seller.orderCount}</Td>
                      <Td className="whitespace-nowrap text-right font-semibold">
                        {formatPrice(seller.grossSales)}
                      </Td>
                      <Td>
                        <form
                          action={setCommissionAction}
                          className="flex items-center justify-end gap-1.5"
                        >
                          <input type="hidden" name="sellerId" value={seller.id} />
                          <input
                            name="commissionRate"
                            type="number"
                            step="0.1"
                            min={0}
                            max={100}
                            defaultValue={seller.commissionRate}
                            aria-label={`Commission rate for ${seller.storeName}`}
                            className="h-9 w-16 rounded-lg border border-neutral-200 px-2 text-right text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/15"
                          />
                          <button
                            type="submit"
                            className="rounded-lg border border-neutral-200 px-2 py-1.5 text-[11px] font-semibold text-neutral-600 transition hover:border-brand hover:text-brand"
                          >
                            %
                          </button>
                        </form>
                      </Td>
                      <Td>
                        <StatusPill status={seller.status} />
                      </Td>
                      <Td className="pr-4 lg:pr-3">
                        <div className="flex items-center justify-end gap-0.5">
                          {seller.status !== "approved" ? (
                            <form action={setSellerStatusAction}>
                              <input type="hidden" name="sellerId" value={seller.id} />
                              <input type="hidden" name="status" value="approved" />
                              <button
                                type="submit"
                                title="Approve this store"
                                className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-400 transition hover:bg-emerald-50 hover:text-emerald-600"
                              >
                                <Check className="h-4 w-4" />
                              </button>
                            </form>
                          ) : null}
                          {seller.status !== "suspended" ? (
                            <form action={setSellerStatusAction}>
                              <input type="hidden" name="sellerId" value={seller.id} />
                              <input type="hidden" name="status" value="suspended" />
                              <button
                                type="submit"
                                title="Suspend (also unpublishes their products)"
                                className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-400 transition hover:bg-red-50 hover:text-red-600"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </form>
                          ) : null}
                        </div>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableScroll>

            <Pagination
              base="/admin/distributors"
              params={{ search: filter.search, status: filter.status }}
              page={filter.page}
              total={sellers.total}
              pageSize={PAGE_SIZE}
              noun="distributors"
            />
          </>
        )}
      </Card>
    </>
  );
}
