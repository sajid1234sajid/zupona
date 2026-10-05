import Link from "next/link";
import { notFound } from "next/navigation";
import { CircleDollarSign, Clock, HandCoins, Wallet } from "lucide-react";
import { getCurrentSeller, requireApprovedSeller } from "@/lib/sellers";
import {
  describePayoutAccount,
  getPayoutAccount,
  getSellerBalance,
  listSellerEarnings,
  listSellerPayouts,
} from "@/lib/sellerPayouts";
import { formatDate, formatPrice } from "@/lib/format";
import {
  Card,
  CardHeader,
  EmptyState,
  PageHeader,
  Pagination,
  StatCard,
  StatusPill,
  TableScroll,
  Td,
  Th,
} from "@/components/admin/ui";
import { one } from "@/components/seller/ui";
import PayoutAccountForm from "@/components/seller/PayoutAccountForm";

export const metadata = { title: "Finance" };

const EARNINGS_PAGE_SIZE = 15;

export default async function SellerFinancePage(props: PageProps<"/seller/finance">) {
  const seller = await getCurrentSeller();
  if (!seller) notFound();

  const searchParams = await props.searchParams;
  const page = Math.max(1, Number(one(searchParams.page) ?? 1) || 1);

  const [{ asAdmin }, balance, payouts, earnings, account] = await Promise.all([
    requireApprovedSeller(),
    getSellerBalance(seller.id),
    listSellerPayouts(seller.id),
    listSellerEarnings(seller.id, { page, pageSize: EARNINGS_PAGE_SIZE }),
    getPayoutAccount(seller.id),
  ]);

  return (
    <>
      <PageHeader
        title="Finance"
        subtitle="What you've earned, what's on its way to you, and where it's sent"
        breadcrumb={["Finance"]}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <StatCard
          label="Ready for payout"
          value={formatPrice(balance.payable)}
          caption={`${balance.payableCount} delivered order${balance.payableCount === 1 ? "" : "s"}`}
          change={null}
          icon={HandCoins}
          tone="green"
        />
        <StatCard
          label="On the way"
          value={formatPrice(balance.inProgress)}
          icon={Clock}
          tone="orange"
        />
        <StatCard label="Paid to you" value={formatPrice(balance.paidOut)} icon={Wallet} tone="blue" />
        <StatCard
          label="Earned all time"
          value={formatPrice(balance.lifetimeNet)}
          icon={CircleDollarSign}
          tone="violet"
        />
      </div>

      <p className="mt-3 rounded-xl bg-white px-4 py-3 text-[12px] leading-relaxed text-neutral-500 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        You earn your items&rsquo; price less Zupona&rsquo;s {seller.commissionRate}% commission.
        An order becomes <span className="font-semibold text-neutral-700">ready for payout</span>{" "}
        once it is delivered; Zupona then sends it to your payout account below. Orders still being
        confirmed or delivered are <span className="font-semibold text-neutral-700">on the way</span>.
      </p>

      <div className="mt-5 grid gap-5 xl:grid-cols-12">
        <div className="min-w-0 space-y-5 xl:col-span-8">
          <Card>
            <CardHeader title="Payouts" subtitle="Money Zupona has sent you" />
            {payouts.length === 0 ? (
              <EmptyState
                title="No payouts yet"
                detail="Your first payout appears here once Zupona sends your delivered orders' earnings."
              />
            ) : (
              <TableScroll>
                <table className="w-full min-w-[560px] border-collapse">
                  <thead>
                    <tr className="border-b border-neutral-100">
                      <Th className="pl-4 lg:pl-3">Date</Th>
                      <Th className="text-right">Orders</Th>
                      <Th className="text-right">Sales</Th>
                      <Th className="text-right">Commission</Th>
                      <Th className="text-right">Paid</Th>
                      <Th className="pr-4 lg:pr-3">Reference</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {payouts.map((payout) => (
                      <tr key={payout.id} className="border-b border-neutral-50 last:border-0">
                        <Td className="whitespace-nowrap pl-4 lg:pl-3">
                          {formatDate(payout.paidAt ?? payout.createdAt)}
                          {payout.status !== "paid" ? (
                            <span className="ml-2">
                              <StatusPill status={payout.status} />
                            </span>
                          ) : null}
                        </Td>
                        <Td className="text-right text-neutral-600">{payout.orderCount}</Td>
                        <Td className="whitespace-nowrap text-right">{formatPrice(payout.grossSales)}</Td>
                        <Td className="whitespace-nowrap text-right text-red-600">
                          −{formatPrice(payout.commission)}
                        </Td>
                        <Td className="whitespace-nowrap text-right font-bold text-brand">
                          {formatPrice(payout.netPayout)}
                        </Td>
                        <Td className="pr-4 font-mono text-[12px] text-neutral-500 lg:pr-3">
                          {payout.reference ?? "—"}
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableScroll>
            )}
          </Card>

          <Card>
            <CardHeader title="Earnings by order" subtitle="Your statement, newest first" />
            {earnings.rows.length === 0 ? (
              <EmptyState title="No orders yet" detail="Each order you sell appears here with what you earn from it." />
            ) : (
              <>
                <TableScroll>
                  <table className="w-full min-w-[620px] border-collapse">
                    <thead>
                      <tr className="border-b border-neutral-100">
                        <Th className="pl-4 lg:pl-3">Order</Th>
                        <Th>Status</Th>
                        <Th className="text-right">Sales</Th>
                        <Th className="text-right">Commission</Th>
                        <Th className="text-right">You earn</Th>
                        <Th className="pr-4 lg:pr-3">Payout</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {earnings.rows.map((row) => (
                        <tr key={row.suborderId} className="border-b border-neutral-50 last:border-0">
                          <Td className="pl-4 lg:pl-3">
                            <Link
                              href={`/seller/orders/${row.orderNumber}`}
                              className="font-semibold text-brand hover:underline"
                            >
                              #{row.orderNumber}
                            </Link>
                            <p className="text-[11px] text-neutral-400">{formatDate(row.placedAt)}</p>
                          </Td>
                          <Td>
                            <StatusPill status={row.status} />
                          </Td>
                          <Td className="whitespace-nowrap text-right">{formatPrice(row.subtotal)}</Td>
                          <Td className="whitespace-nowrap text-right text-red-600">
                            −{formatPrice(row.commission)}
                          </Td>
                          <Td className="whitespace-nowrap text-right font-semibold">{formatPrice(row.net)}</Td>
                          <Td className="pr-4 text-[12px] lg:pr-3">
                            {row.payoutStatus === "paid" ? (
                              <span className="font-semibold text-emerald-600">Paid</span>
                            ) : row.payoutStatus ? (
                              <StatusPill status={row.payoutStatus} />
                            ) : row.status === "delivered" ? (
                              <span className="font-medium text-amber-600">Ready</span>
                            ) : row.status === "cancelled" || row.status === "returned" ? (
                              <span className="text-neutral-400">—</span>
                            ) : (
                              <span className="text-neutral-400">After delivery</span>
                            )}
                          </Td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </TableScroll>
                <Pagination
                  base="/seller/finance"
                  params={{}}
                  page={page}
                  total={earnings.total}
                  pageSize={EARNINGS_PAGE_SIZE}
                  noun="orders"
                />
              </>
            )}
          </Card>
        </div>

        <div className="min-w-0 xl:col-span-4">
          <Card>
            <CardHeader title="Payout account" subtitle={describePayoutAccount(account)} />
            <PayoutAccountForm
              method={account.method}
              accountName={account.accountName}
              accountNumber={account.accountNumber}
              bankName={account.bankName}
              branch={account.branch}
              asAdmin={asAdmin}
            />
          </Card>
        </div>
      </div>
    </>
  );
}
