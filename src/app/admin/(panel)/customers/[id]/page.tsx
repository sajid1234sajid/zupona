import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BadgeCheck, Mail, MapPin, Phone } from "lucide-react";
import { getCustomerDetail } from "@/lib/adminData";
import { formatAddressLine, formatDateTime, formatPrice } from "@/lib/format";
import {
  Avatar,
  Card,
  CardHeader,
  PageHeader,
  StatusPill,
  Td,
  Th,
  TableScroll,
  buttonStyles,
  fieldStyles,
} from "@/components/admin/ui";
import { adjustPointsAction, setCustomerRoleAction, setCustomerStatusAction } from "../actions";

export async function generateMetadata(props: PageProps<"/admin/customers/[id]">) {
  const { id } = await props.params;
  const customer = await getCustomerDetail(id);
  return { title: customer ? customer.name : "Customer" };
}

export default async function CustomerDetailPage(props: PageProps<"/admin/customers/[id]">) {
  const { id } = await props.params;
  const customer = await getCustomerDetail(id);
  if (!customer) notFound();

  const spent = customer.orders
    .filter((order) => order.status !== "cancelled")
    .reduce((sum, order) => sum + order.total, 0);

  return (
    <>
      <PageHeader
        title={customer.name}
        subtitle={`Customer since ${formatDateTime(customer.createdAt)}`}
        breadcrumb={["Customers", customer.name]}
        action={
          <Link href="/admin/customers" className={buttonStyles.secondary}>
            <ArrowLeft className="h-4 w-4" />
            All customers
          </Link>
        }
      />

      <div className="grid gap-5 xl:grid-cols-12">
        <div className="min-w-0 space-y-4 xl:col-span-8">
          <Card>
            <div className="flex flex-wrap items-center gap-4">
              <Avatar src={customer.avatarUrl} name={customer.name} size={64} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-lg font-bold text-neutral-900">{customer.name}</p>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <StatusPill status={customer.role} />
                  <StatusPill status={customer.status} />
                  {customer.emailVerified ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600">
                      <BadgeCheck className="h-3.5 w-3.5" />
                      Email verified
                    </span>
                  ) : null}
                </div>
              </div>
            </div>

            <dl className="mt-4 grid gap-3 border-t border-neutral-100 pt-4 sm:grid-cols-3">
              {[
                ["Orders", String(customer.orders.length)],
                ["Lifetime value", formatPrice(spent)],
                ["Loyalty points", customer.points.toLocaleString("en-US")],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-xs text-neutral-400">{label}</dt>
                  <dd className="mt-0.5 text-lg font-bold text-neutral-900">{value}</dd>
                </div>
              ))}
            </dl>
          </Card>

          <Card>
            <CardHeader title={`Order history (${customer.orders.length})`} />
            {customer.orders.length === 0 ? (
              <p className="py-8 text-center text-sm text-neutral-400">
                This customer hasn&apos;t ordered anything yet.
              </p>
            ) : (
              <TableScroll>
                <table className="w-full min-w-[480px] border-collapse">
                  <thead>
                    <tr className="border-b border-neutral-100">
                      <Th className="pl-4 lg:pl-3">Order</Th>
                      <Th>Placed</Th>
                      <Th>Status</Th>
                      <Th className="pr-4 text-right lg:pr-3">Total</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {customer.orders.map((order) => (
                      <tr key={order.id} className="border-b border-neutral-50 last:border-0">
                        <Td className="pl-4 lg:pl-3">
                          <Link
                            href={`/admin/orders/${order.id}`}
                            className="font-semibold text-brand hover:underline"
                          >
                            #{order.order_number}
                          </Link>
                        </Td>
                        <Td className="whitespace-nowrap text-[12px] text-neutral-500">
                          {formatDateTime(order.placed_at)}
                        </Td>
                        <Td>
                          <StatusPill status={order.status} />
                        </Td>
                        <Td className="whitespace-nowrap pr-4 text-right font-semibold lg:pr-3">
                          {formatPrice(order.total)}
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableScroll>
            )}
          </Card>

          <Card>
            <CardHeader title="Saved addresses" />
            {customer.addresses.length === 0 ? (
              <p className="py-6 text-sm text-neutral-400">No saved addresses.</p>
            ) : (
              <ul className="space-y-3">
                {customer.addresses.map((address, index) => (
                  <li key={`${address.label}-${index}`} className="flex gap-2.5 text-sm">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-neutral-400" />
                    <div className="min-w-0">
                      <p className="font-medium text-neutral-800">
                        {address.full_name}
                        <span className="ml-2 rounded-md bg-neutral-100 px-1.5 py-0.5 text-[10px] font-normal text-neutral-500">
                          {address.label}
                        </span>
                        {address.is_default === 1 ? (
                          <span className="ml-1.5 rounded-md bg-brand-tint px-1.5 py-0.5 text-[10px] font-normal text-brand-dark">
                            Default
                          </span>
                        ) : null}
                      </p>
                      <p className="text-neutral-500">
                        {formatAddressLine({
                          line1: address.line1,
                          area: address.area,
                          city: address.city,
                          postalCode: address.postal_code,
                        })}
                      </p>
                      <p className="text-[12px] text-neutral-400">{address.phone}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="min-w-0 space-y-4 xl:col-span-4">
          <Card>
            <CardHeader title="Contact" />
            <ul className="space-y-2.5 text-sm">
              <li className="flex items-center gap-2 text-neutral-700">
                <Mail className="h-4 w-4 shrink-0 text-neutral-400" />
                <span className="min-w-0 truncate">{customer.email ?? "No email on file"}</span>
              </li>
              <li className="flex items-center gap-2 text-neutral-700">
                <Phone className="h-4 w-4 shrink-0 text-neutral-400" />
                <span className="min-w-0 truncate">{customer.phone ?? "No phone on file"}</span>
              </li>
            </ul>
            <p className="mt-3 border-t border-neutral-100 pt-3 text-[11px] text-neutral-400">
              Last signed in{" "}
              {customer.lastLoginAt ? formatDateTime(customer.lastLoginAt) : "never"}
            </p>
          </Card>

          <Card>
            <CardHeader title="Account status" />
            <form action={setCustomerStatusAction} className="flex items-center gap-2">
              <input type="hidden" name="userId" value={customer.id} />
              <select
                name="status"
                defaultValue={customer.status}
                aria-label="Account status"
                className={fieldStyles}
              >
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
                <option value="banned">Banned</option>
              </select>
              <button type="submit" className={buttonStyles.secondary}>
                Apply
              </button>
            </form>
            <p className="mt-2 text-[11px] text-neutral-400">
              Suspending signs the account out everywhere immediately.
            </p>
          </Card>

          <Card>
            <CardHeader title="Role" />
            <form action={setCustomerRoleAction} className="flex items-center gap-2">
              <input type="hidden" name="userId" value={customer.id} />
              <select name="role" defaultValue={customer.role} aria-label="Role" className={fieldStyles}>
                <option value="customer">Customer</option>
                <option value="seller">Seller</option>
                <option value="support">Support</option>
                <option value="admin">Admin</option>
              </select>
              <button type="submit" className={buttonStyles.secondary}>
                Apply
              </button>
            </form>
            <p className="mt-2 text-[11px] text-neutral-400">
              Admin and Support roles can sign in to this panel.
            </p>
          </Card>

          <Card>
            <CardHeader title="Loyalty points" subtitle={`Balance: ${customer.points}`} />
            <form action={adjustPointsAction} className="space-y-2.5">
              <input type="hidden" name="userId" value={customer.id} />
              <input
                name="points"
                type="number"
                placeholder="e.g. 100 or -50"
                aria-label="Points to add or remove"
                className={fieldStyles}
              />
              <input
                name="reason"
                maxLength={120}
                placeholder="Reason (shown to the customer)"
                className={fieldStyles}
              />
              <button type="submit" className={`${buttonStyles.secondary} w-full`}>
                Adjust balance
              </button>
            </form>
          </Card>
        </div>
      </div>
    </>
  );
}
