import Link from "next/link";
import { Ban, Eye, ShieldCheck, UserPlus, Users } from "lucide-react";
import { PAGE_SIZE, getCustomerStats, listCustomers } from "@/lib/adminData";
import { formatDate, formatPrice, formatRelative } from "@/lib/format";
import FilterBar from "@/components/admin/FilterBar";
import {
  Avatar,
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
import { setCustomerStatusAction } from "./actions";

export const metadata = { title: "Customers" };

function one(value: string | string[] | undefined): string | undefined {
  const single = Array.isArray(value) ? value[0] : value;
  return single || undefined;
}

export default async function CustomersPage(props: PageProps<"/admin/customers">) {
  const searchParams = await props.searchParams;

  const filter = {
    search: one(searchParams.search),
    status: one(searchParams.status),
    role: one(searchParams.role),
    page: Math.max(1, Number(one(searchParams.page) ?? 1) || 1),
  };

  const [customers, stats] = await Promise.all([listCustomers(filter), getCustomerStats()]);

  return (
    <>
      <PageHeader
        title="Customers"
        subtitle="Everyone with a Zupona account"
        breadcrumb={["Customers"]}
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <StatCard label="Total Accounts" value={stats.total.toLocaleString("en-US")} icon={Users} tone="green" />
        <StatCard label="Active" value={stats.active.toLocaleString("en-US")} icon={ShieldCheck} tone="blue" />
        <StatCard
          label="New This Month"
          value={stats.newThisMonth.toLocaleString("en-US")}
          icon={UserPlus}
          tone="orange"
        />
        <StatCard
          label="Suspended / Banned"
          value={stats.blocked.toLocaleString("en-US")}
          icon={Ban}
          tone="red"
        />
      </div>

      <Card>
        <FilterBar
          base="/admin/customers"
          searchPlaceholder="Search by name, email or phone…"
          selects={[
            {
              name: "status",
              allLabel: "All Status",
              options: [
                { value: "active", label: "Active" },
                { value: "suspended", label: "Suspended" },
                { value: "banned", label: "Banned" },
              ],
            },
            {
              name: "role",
              allLabel: "All Roles",
              options: [
                { value: "customer", label: "Customer" },
                { value: "seller", label: "Seller" },
                { value: "support", label: "Support" },
                { value: "admin", label: "Admin" },
              ],
            },
          ]}
        />

        {customers.rows.length === 0 ? (
          <EmptyState
            title="No customers match these filters"
            detail="New shoppers appear here as soon as they create an account."
            action={
              <Link href="/admin/customers" className={buttonStyles.secondary}>
                Clear filters
              </Link>
            }
          />
        ) : (
          <>
            <TableScroll>
              <table className="w-full min-w-[860px] border-collapse">
                <thead>
                  <tr className="border-b border-neutral-100">
                    <Th className="pl-4 lg:pl-3">Customer</Th>
                    <Th>Contact</Th>
                    <Th>Role</Th>
                    <Th className="text-right">Orders</Th>
                    <Th className="text-right">Total Spent</Th>
                    <Th className="text-right">Points</Th>
                    <Th>Last Order</Th>
                    <Th>Status</Th>
                    <Th className="pr-4 text-right lg:pr-3">Action</Th>
                  </tr>
                </thead>
                <tbody>
                  {customers.rows.map((customer) => (
                    <tr
                      key={customer.id}
                      className="border-b border-neutral-50 transition last:border-0 hover:bg-neutral-50/60"
                    >
                      <Td className="pl-4 lg:pl-3">
                        <div className="flex items-center gap-2.5">
                          <Avatar src={customer.avatarUrl} name={customer.name} size={34} />
                          <div className="min-w-0">
                            <Link
                              href={`/admin/customers/${customer.id}`}
                              className="block max-w-[10rem] truncate font-medium text-neutral-800 hover:text-brand"
                            >
                              {customer.name}
                            </Link>
                            <p className="text-[11px] text-neutral-400">
                              Joined {formatDate(customer.createdAt)}
                            </p>
                          </div>
                        </div>
                      </Td>
                      <Td>
                        <p className="max-w-[12rem] truncate text-[13px] text-neutral-600">
                          {customer.email ?? "—"}
                        </p>
                        <p className="text-[11px] text-neutral-400">{customer.phone ?? "—"}</p>
                      </Td>
                      <Td>
                        <StatusPill status={customer.role} />
                      </Td>
                      <Td className="text-right text-neutral-600">{customer.orderCount}</Td>
                      <Td className="whitespace-nowrap text-right font-semibold">
                        {formatPrice(customer.totalSpent)}
                      </Td>
                      <Td className="text-right text-neutral-600">{customer.points}</Td>
                      <Td className="whitespace-nowrap text-[12px] text-neutral-500">
                        {customer.lastOrderAt ? formatRelative(customer.lastOrderAt) : "Never"}
                      </Td>
                      <Td>
                        <StatusPill status={customer.status} />
                      </Td>
                      <Td className="pr-4 lg:pr-3">
                        <div className="flex items-center justify-end gap-0.5">
                          <Link
                            href={`/admin/customers/${customer.id}`}
                            title="Open profile"
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-400 transition hover:bg-neutral-100 hover:text-brand"
                          >
                            <Eye className="h-4 w-4" />
                          </Link>
                          {customer.role !== "admin" ? (
                            <form action={setCustomerStatusAction}>
                              <input type="hidden" name="userId" value={customer.id} />
                              <input
                                type="hidden"
                                name="status"
                                value={customer.status === "active" ? "suspended" : "active"}
                              />
                              <button
                                type="submit"
                                title={
                                  customer.status === "active"
                                    ? "Suspend this account"
                                    : "Restore this account"
                                }
                                className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-400 transition hover:bg-red-50 hover:text-red-600"
                              >
                                <Ban className="h-4 w-4" />
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
              base="/admin/customers"
              params={{ search: filter.search, status: filter.status, role: filter.role }}
              page={filter.page}
              total={customers.total}
              pageSize={PAGE_SIZE}
              noun="customers"
            />
          </>
        )}
      </Card>
    </>
  );
}
