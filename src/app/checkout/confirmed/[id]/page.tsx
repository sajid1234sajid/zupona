import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowRight,
  BadgeCheck,
  CalendarDays,
  ChevronRight,
  CircleCheckBig,
  House,
  Leaf,
  Lock,
  MapPin,
  Package,
  Truck,
  Wallet,
} from "lucide-react";
import { requireUser } from "@/lib/session";
import { getOrder } from "@/lib/orders";
import { formatBdPhone } from "@/lib/checkout";
import LeafBackdrop from "@/components/checkout/LeafBackdrop";
import OrderSummary from "@/components/checkout/OrderSummary";
import OrderProgress from "@/components/order/OrderProgress";

/** SQLite stores `YYYY-MM-DD HH:MM:SS` in UTC. */
function parsePlacedAt(placedAt: string): Date {
  return new Date(`${placedAt.replace(" ", "T")}Z`);
}

export default async function OrderConfirmedPage({ params }: PageProps<"/checkout/confirmed/[id]">) {
  const user = await requireUser();
  const { id } = await params;
  const order = await getOrder(user.id, id);

  if (!order) notFound();

  const placedAt = parsePlacedAt(order.placedAt);
  const facts = [
    {
      icon: CalendarDays,
      label: "Order Date",
      value: placedAt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
      note: placedAt.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
    },
    {
      icon: Wallet,
      label: "Payment Method",
      value: order.paymentLabel,
      note: order.paymentLabel === "Cash on Delivery" ? "Pay when you receive" : "Confirmed",
    },
    {
      icon: Truck,
      label: "Delivery Type",
      value: order.deliveryMethodName,
      note: order.deliveryEta,
    },
  ];

  return (
    <div className="relative mx-auto flex min-h-screen w-full max-w-md flex-col overflow-hidden bg-gradient-to-b from-brand-tint/60 via-white to-brand-tint/40">
      <LeafBackdrop />

      <div className="relative flex flex-1 flex-col pb-8">
        <header className="flex items-center gap-2 px-4 pb-2 pt-4">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-darkest">
            <Leaf className="h-5 w-5 text-brand-light" />
          </span>
          <div className="min-w-0 leading-tight">
            <p className="text-base font-extrabold text-brand-darkest">Zupona</p>
            <p className="truncate text-[10px] font-medium text-brand">Trusted Online Shop</p>
          </div>
          <span className="ml-auto flex shrink-0 items-center gap-1.5 text-[11px] font-bold text-brand-darkest">
            <Lock className="h-3.5 w-3.5" />
            Secure Checkout
          </span>
        </header>

        <section className="flex flex-col items-center px-4 pb-5 pt-4 text-center">
          <span className="flex h-20 w-20 items-center justify-center rounded-full bg-brand-tint">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand shadow-lg shadow-brand/30">
              <CircleCheckBig className="h-8 w-8 text-white" strokeWidth={2.5} />
            </span>
          </span>
          <h1 className="mt-3 text-2xl font-extrabold text-brand-darkest">Order Confirmed!</h1>
          <p className="mt-1 text-xs text-neutral-500">Your order has been placed successfully.</p>
          <p className="mt-1 text-[11px] font-medium text-brand">
            Thank you for shopping with Zupona 💚
          </p>
        </section>

        <div className="flex flex-col gap-3 px-4">
          <section className="rounded-2xl border border-neutral-100 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-start gap-2">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-tint">
                <Package className="h-4 w-4 text-brand" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] text-neutral-400">Order ID</p>
                <p className="truncate text-sm font-bold text-neutral-800">#{order.orderNumber}</p>
              </div>
              <span className="flex shrink-0 items-center gap-1 rounded-full bg-brand-tint px-2 py-1 text-[9px] font-bold text-brand-dark">
                <BadgeCheck className="h-3 w-3" />
                Confirmed
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 border-y border-dashed border-neutral-200 py-3">
              {facts.map(({ icon: Icon, label, value, note }) => (
                <div key={label} className="min-w-0">
                  <p className="flex items-center gap-1 text-[9px] font-semibold text-neutral-400">
                    <Icon className="h-3 w-3 text-brand" />
                    {label}
                  </p>
                  <p className="mt-1 text-[11px] font-bold leading-tight text-neutral-800">{value}</p>
                  <p className="text-[9px] leading-tight text-neutral-400">{note}</p>
                </div>
              ))}
            </div>

            <div className="pt-3">
              <OrderSummary
                bare
                lines={order.items.map((item) => ({
                  id: item.id,
                  name: item.name,
                  image: item.image,
                  color: item.color,
                  quantity: item.quantity,
                  price: item.price,
                  oldPrice: item.oldPrice,
                }))}
                subtotal={order.subtotal}
                deliveryFee={order.shippingFee}
                total={order.total}
                subtitle=""
              />
              <p className="mt-2 text-center text-[10px] font-semibold text-brand">
                +{order.pointsEarned} Zupona points earned
              </p>
            </div>
          </section>

          <section className="rounded-2xl border border-neutral-100 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand">
                <MapPin className="h-4 w-4 text-white" />
              </span>
              <h2 className="text-sm font-bold text-neutral-800">Delivery Address</h2>
            </div>

            <p className="text-sm font-bold text-neutral-800">{order.addressFullName}</p>
            <p className="text-[11px] text-neutral-400">{formatBdPhone(order.addressPhone)}</p>

            <div className="mt-3 grid grid-cols-3 gap-2 border-t border-dashed border-neutral-200 pt-3">
              <div>
                <p className="text-[9px] font-semibold text-neutral-400">Division</p>
                <p className="text-[11px] font-bold text-neutral-800">{order.addressCity || "—"}</p>
              </div>
              <div>
                <p className="text-[9px] font-semibold text-neutral-400">Thana</p>
                <p className="text-[11px] font-bold text-neutral-800">{order.addressArea || "—"}</p>
              </div>
              <div className="min-w-0">
                <p className="text-[9px] font-semibold text-neutral-400">Address</p>
                <p className="text-[11px] font-bold leading-tight text-neutral-800">{order.addressLine}</p>
              </div>
            </div>
          </section>

          <Link
            href={`/account/orders/${order.id}`}
            className="block rounded-2xl border border-neutral-100 bg-white p-4 shadow-sm"
          >
            <div className="mb-3 flex items-center gap-2">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-tint">
                <Truck className="h-4 w-4 text-brand" />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-bold text-neutral-800">Your order is on the way!</h2>
                <p className="text-[10px] text-neutral-400">
                  We&apos;ll notify you with every delivery update.
                </p>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-neutral-300" />
            </div>

            <OrderProgress steps={order.steps} eta={order.deliveryEta} />
          </Link>

          <Link
            href="/"
            className="mt-1 flex items-center justify-center gap-2 rounded-xl bg-brand-dark py-3.5 text-sm font-bold text-white shadow-lg shadow-brand/25"
          >
            <House className="h-4 w-4" />
            Continue Shopping
            <ArrowRight className="h-4 w-4" />
          </Link>

          <p className="pb-2 text-center text-[10px] text-neutral-400">Thanks for choosing Zupona 💚</p>
        </div>
      </div>
    </div>
  );
}
