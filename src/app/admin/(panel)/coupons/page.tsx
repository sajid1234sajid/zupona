import { CheckCircle2, Power, Ticket, TrendingDown, Trash2 } from "lucide-react";
import { listAdminCoupons } from "@/lib/adminData";
import { formatDate, formatPrice, parseDbDate } from "@/lib/format";
import CouponForm from "@/components/admin/CouponForm";
import {
  Card,
  CardHeader,
  EmptyState,
  PageHeader,
  StatCard,
  StatusPill,
  Td,
  Th,
  TableScroll,
} from "@/components/admin/ui";
import { deleteCouponAction, toggleCouponAction } from "./actions";

export const metadata = { title: "Coupons" };

/** What a coupon is doing right now, which is not the same as its `is_active`
 * flag: a live coupon can still be scheduled, expired or fully claimed. */
function couponState(coupon: {
  isActive: boolean;
  startsAt: string | null;
  endsAt: string | null;
  usageLimit: number | null;
  usageCount: number;
}): { status: string; label: string } {
  if (!coupon.isActive) return { status: "draft", label: "Disabled" };

  const now = Date.now();
  const starts = parseDbDate(coupon.startsAt);
  const ends = parseDbDate(coupon.endsAt);

  if (starts && starts.getTime() > now) return { status: "pending", label: "Scheduled" };
  if (ends && ends.getTime() < now) return { status: "archived", label: "Expired" };
  if (coupon.usageLimit !== null && coupon.usageCount >= coupon.usageLimit) {
    return { status: "archived", label: "Fully claimed" };
  }
  return { status: "active", label: "Live" };
}

function describe(coupon: { discountType: string; discountValue: number }): string {
  if (coupon.discountType === "free_shipping") return "Free shipping";
  if (coupon.discountType === "percent") return `${coupon.discountValue}% off`;
  return `${formatPrice(coupon.discountValue)} off`;
}

export default async function CouponsPage() {
  const coupons = await listAdminCoupons();

  const live = coupons.filter((coupon) => couponState(coupon).label === "Live").length;
  const redemptions = coupons.reduce((sum, coupon) => sum + coupon.usageCount, 0);
  const givenAway = coupons.reduce((sum, coupon) => sum + coupon.redeemedTotal, 0);

  return (
    <>
      <PageHeader
        title="Coupons"
        subtitle="Discount codes and how much they've cost you"
        breadcrumb={["Coupons"]}
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <StatCard label="All Coupons" value={String(coupons.length)} icon={Ticket} tone="green" />
        <StatCard label="Live Now" value={String(live)} icon={CheckCircle2} tone="blue" />
        <StatCard label="Times Redeemed" value={String(redemptions)} icon={Power} tone="orange" />
        <StatCard label="Discount Given" value={formatPrice(givenAway)} icon={TrendingDown} tone="pink" />
      </div>

      <div className="grid gap-5 xl:grid-cols-12">
        <div className="min-w-0 xl:col-span-8">
          <Card>
            <CardHeader title="All Coupons" />
            {coupons.length === 0 ? (
              <EmptyState
                title="No coupons yet"
                detail="Create your first discount code with the form beside this."
              />
            ) : (
              <TableScroll>
                <table className="w-full min-w-[760px] border-collapse">
                  <thead>
                    <tr className="border-b border-neutral-100">
                      <Th className="pl-4 lg:pl-3">Code</Th>
                      <Th>Discount</Th>
                      <Th>Conditions</Th>
                      <Th className="text-right">Used</Th>
                      <Th className="text-right">Given away</Th>
                      <Th>Validity</Th>
                      <Th>State</Th>
                      <Th className="pr-4 text-right lg:pr-3">Action</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {coupons.map((coupon) => {
                      const state = couponState(coupon);
                      return (
                        <tr
                          key={coupon.id}
                          className="border-b border-neutral-50 transition last:border-0 hover:bg-neutral-50/60"
                        >
                          <Td className="pl-4 lg:pl-3">
                            <p className="font-bold tracking-wide text-neutral-800">{coupon.code}</p>
                            {coupon.description ? (
                              <p className="max-w-[12rem] truncate text-[11px] text-neutral-400">
                                {coupon.description}
                              </p>
                            ) : null}
                          </Td>
                          <Td className="whitespace-nowrap font-medium">{describe(coupon)}</Td>
                          <Td className="text-[12px] text-neutral-500">
                            {coupon.minOrderAmount > 0
                              ? `Min ${formatPrice(coupon.minOrderAmount)}`
                              : "No minimum"}
                            {coupon.maxDiscountAmount
                              ? ` · Max ${formatPrice(coupon.maxDiscountAmount)}`
                              : ""}
                            <span className="block text-neutral-400">
                              {coupon.perUserLimit} per customer
                            </span>
                          </Td>
                          <Td className="whitespace-nowrap text-right text-neutral-600">
                            {coupon.usageCount}
                            {coupon.usageLimit === null ? "" : ` / ${coupon.usageLimit}`}
                          </Td>
                          <Td className="whitespace-nowrap text-right font-semibold">
                            {formatPrice(coupon.redeemedTotal)}
                          </Td>
                          <Td className="whitespace-nowrap text-[12px] text-neutral-500">
                            {coupon.startsAt || coupon.endsAt ? (
                              <>
                                {coupon.startsAt ? formatDate(coupon.startsAt) : "Now"}
                                {" → "}
                                {coupon.endsAt ? formatDate(coupon.endsAt) : "No end"}
                              </>
                            ) : (
                              "Always"
                            )}
                          </Td>
                          <Td>
                            <StatusPill status={state.status} label={state.label} />
                          </Td>
                          <Td className="pr-4 lg:pr-3">
                            <div className="flex items-center justify-end gap-0.5">
                              <form action={toggleCouponAction}>
                                <input type="hidden" name="couponId" value={coupon.id} />
                                <button
                                  type="submit"
                                  title={coupon.isActive ? "Disable" : "Enable"}
                                  className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-400 transition hover:bg-neutral-100 hover:text-brand"
                                >
                                  <Power className="h-4 w-4" />
                                </button>
                              </form>
                              <form action={deleteCouponAction}>
                                <input type="hidden" name="couponId" value={coupon.id} />
                                <button
                                  type="submit"
                                  title={
                                    coupon.usageCount > 0
                                      ? "Already redeemed — this disables it instead of deleting"
                                      : "Delete"
                                  }
                                  className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-400 transition hover:bg-red-50 hover:text-red-600"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </form>
                            </div>
                          </Td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </TableScroll>
            )}
          </Card>
        </div>

        <div className="min-w-0 xl:col-span-4">
          <CouponForm />
        </div>
      </div>
    </>
  );
}
