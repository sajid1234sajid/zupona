import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CalendarDays,
  Check,
  ChevronRight,
  Heart,
  House,
  Lock,
  MapPin,
  Phone,
  Receipt,
  Truck,
  Wallet,
} from "lucide-react";
import { requireUser } from "@/lib/session";
import { getOrder } from "@/lib/orders";
import { formatBdPhone } from "@/lib/checkout";
import { formatPrice } from "@/lib/format";
import LeafBackdrop from "@/components/checkout/LeafBackdrop";
import ZuponaMark from "@/components/brand/ZuponaMark";
import SuccessBurst from "@/components/checkout/SuccessBurst";
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
      value: placedAt
        .toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
        .replace("Sept", "Sep"),
      note: placedAt.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
      pill: null,
    },
    {
      icon: Wallet,
      label: "Payment Method",
      value: order.paymentLabel,
      note: order.paymentLabel === "Cash on Delivery" ? "Pay when you receive" : "Confirmed",
      pill: null,
    },
    {
      icon: Truck,
      label: "Delivery Type",
      value: order.deliveryMethodName,
      note: order.deliveryEta,
      pill: formatPrice(order.shippingFee),
    },
  ];

  const places = [
    { icon: Building2, label: "Division", value: order.addressCity || "—" },
    { icon: MapPin, label: "Thana", value: order.addressArea || "—" },
    { icon: House, label: "Address", value: order.addressLine },
  ];

  return (
    <div className="relative mx-auto flex min-h-screen w-full max-w-md flex-col overflow-hidden bg-brand-mist">
      <LeafBackdrop />

      <div className="relative flex flex-1 flex-col pb-8">
        <header className="flex items-center gap-2 px-4 pb-1 pt-4">
          <Link
            href="/account/orders"
            aria-label="Back to my orders"
            className="-ml-1 shrink-0 rounded-full p-1 text-brand-darkest active:bg-brand-tint"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <ZuponaMark className="h-10 w-10 shrink-0" />
          <div className="min-w-0 leading-tight">
            <p className="text-[21px] font-extrabold leading-none text-brand-darkest">Zupona</p>
            <p className="truncate text-[11px] font-medium text-brand">Trusted Online Shop</p>
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-1.5 text-right">
            <Lock className="h-4 w-4 text-brand-darkest" />
            <div className="leading-tight">
              <p className="text-[12px] font-bold text-brand-darkest">Secure Checkout</p>
              <p className="text-[9px] text-ink-slate">Your information is safe</p>
            </div>
          </div>
        </header>

        {/* ---------------- the moment of success ---------------- */}
        <section className="flex flex-col items-center px-4 pb-6 pt-3 text-center">
          <SuccessBurst />
          <h1 className="mt-3 text-[30px] font-extrabold leading-none text-brand-darkest">
            Order Confirmed!
          </h1>
          <p className="mt-2.5 text-[14px] text-ink-slate">
            Your order has been placed successfully.
          </p>
          <p className="mt-1.5 flex items-center gap-1.5 text-[13px] font-medium text-brand-dark">
            Thank you for shopping with Zupona!
            <Heart className="h-[15px] w-[15px] fill-brand text-brand" />
          </p>
        </section>

        <div className="flex flex-col gap-3.5 px-4">
          {/* ---------------- order id and the three facts ---------------- */}
          <section className="rounded-2xl border border-line bg-white p-4 shadow-card">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-dark">
                <Receipt className="h-[22px] w-[22px] text-white" strokeWidth={2} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[12px] font-semibold text-brand">Order ID</p>
                <p className="truncate text-[18px] font-extrabold leading-tight text-heading">
                  #{order.orderNumber}
                </p>
              </div>
              <span className="flex shrink-0 items-center gap-1 rounded-full bg-brand px-2.5 py-1.5 text-[11px] font-bold text-white">
                <Check className="h-3.5 w-3.5" strokeWidth={3} />
                Confirmed
              </span>
            </div>

            <div className="mt-4 grid grid-cols-[0.79fr_1.08fr_1.13fr] border-t border-line-soft pt-3.5">
              {facts.map(({ icon: Icon, label, value, note, pill }, index) => (
                <div
                  key={label}
                  className={`flex min-w-0 items-start gap-1 px-0.5 first:pl-0 last:pr-0 ${
                    index > 0 ? "border-l border-line-soft" : ""
                  }`}
                >
                  <span className="mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-tint">
                    <Icon className="h-[11px] w-[11px] text-brand" strokeWidth={2.5} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[10px] font-medium leading-tight text-ink-slate">{label}</p>
                    <p className="mt-0.5 text-[10px] font-bold leading-tight text-heading">{value}</p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-1 text-[9.5px] leading-tight text-ink-slate">
                      {note}
                      {pill && (
                        <span className="rounded-full bg-brand-tint px-1.5 py-px font-bold text-brand-dark">
                          {pill}
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ---------------- what was bought, and what it cost ---------------- */}
          <section className="rounded-2xl border border-line bg-white p-4 shadow-card">
            {order.items.map((item) => {
              const discount =
                item.oldPrice > item.price
                  ? Math.round(((item.oldPrice - item.price) / item.oldPrice) * 100)
                  : 0;
              return (
                <div key={item.id} className="flex items-start gap-3">
                  <span className="relative h-[62px] w-[62px] shrink-0 overflow-hidden rounded-xl bg-brand-mist">
                    {item.image && (
                      <Image
                        src={item.image}
                        alt=""
                        fill
                        unoptimized
                        sizes="62px"
                        className="object-cover"
                      />
                    )}
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-bold leading-tight text-heading">
                      {item.name}
                    </p>
                    <p className="mt-1 truncate text-[12px] text-ink-slate">
                      {item.color ? `${item.color}  •  ` : ""}Qty: {item.quantity}
                    </p>
                  </div>

                  <div className="shrink-0 text-right">
                    {discount > 0 && (
                      <span className="inline-block rounded-full bg-brand px-2 py-0.5 text-[10px] font-bold text-white">
                        {discount}% OFF
                      </span>
                    )}
                    {item.oldPrice > item.price && (
                      <p className="mt-1 text-[11px] text-ink-faint line-through">
                        {formatPrice(item.oldPrice * item.quantity)}
                      </p>
                    )}
                    <p className="mt-0.5 text-[17px] font-extrabold leading-none text-brand-dark">
                      {formatPrice(item.price * item.quantity)}
                    </p>
                  </div>
                </div>
              );
            })}

            <div className="mt-3.5 rounded-xl bg-brand-tint/50 px-3 py-2.5">
              <div className="flex items-center justify-between text-[12px] text-ink-slate">
                <span>Item Price (after discount)</span>
                <span className="font-bold text-heading">{formatPrice(order.subtotal)}</span>
              </div>
              <div className="mt-1.5 flex items-center justify-between text-[12px] text-ink-slate">
                <span>Delivery Charge</span>
                <span className="font-bold text-heading">{formatPrice(order.shippingFee)}</span>
              </div>
              <div className="mt-2.5 flex items-center justify-between border-t border-brand/15 pt-2.5">
                <span className="text-[15px] font-bold text-brand-darkest">Total Amount</span>
                <span className="text-[20px] font-extrabold leading-none text-brand-darkest">
                  {formatPrice(order.total)}
                </span>
              </div>
              {order.pointsEarned > 0 && (
                <p className="mt-2 text-right text-[10.5px] font-semibold text-brand">
                  +{order.pointsEarned} Zupona points earned
                </p>
              )}
            </div>
          </section>

          {/* ---------------- where it is going ---------------- */}
          <section className="rounded-2xl border border-line bg-white p-4 shadow-card">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-dark">
                <MapPin className="h-[22px] w-[22px] text-white" strokeWidth={2} />
              </span>
              <div className="min-w-0">
                <h2 className="text-[16px] font-bold leading-tight text-heading">Delivery Address</h2>
                <p className="mt-1.5 truncate text-[15px] font-bold leading-tight text-heading">
                  {order.addressFullName}
                </p>
              </div>
            </div>

            <p className="mt-2 flex items-center gap-1.5 text-[12px] text-ink-slate">
              <Phone className="h-3.5 w-3.5 text-brand" strokeWidth={2.25} />
              {formatBdPhone(order.addressPhone)}
            </p>

            <div className="mt-3.5 grid grid-cols-[0.8fr_0.95fr_1.25fr] border-t border-line-soft pt-3.5">
              {places.map(({ icon: Icon, label, value }, index) => (
                <div
                  key={label}
                  className={`flex min-w-0 items-start gap-1 px-0.5 first:pl-0 last:pr-0 ${
                    index > 0 ? "border-l border-line-soft" : ""
                  }`}
                >
                  <span className="mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-tint">
                    <Icon className="h-[11px] w-[11px] text-brand" strokeWidth={2.5} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[10px] font-medium leading-tight text-ink-slate">{label}</p>
                    <p className="mt-0.5 break-words text-[10.5px] font-bold leading-snug text-heading">
                      {value}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ---------------- where it has got to ---------------- */}
          <Link
            href={`/account/orders/${order.id}`}
            className="block rounded-2xl border border-line bg-white p-4 shadow-card"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-dark">
                <Truck className="h-[22px] w-[22px] text-white" strokeWidth={2} />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="text-[15px] font-bold leading-tight text-heading">
                  Your order is on the way!
                </h2>
                <p className="mt-0.5 text-[11.5px] text-ink-slate">
                  We&apos;ll notify you with every delivery update.
                </p>
              </div>
              <ChevronRight className="h-5 w-5 shrink-0 text-ink-faint" />
            </div>

            <div className="mt-3.5 rounded-xl bg-brand-tint/50 px-3 py-3.5">
              <OrderProgress steps={order.steps} eta={order.deliveryEta} />
            </div>
          </Link>

          <Link
            href="/"
            className="mt-1 flex min-h-[52px] items-center justify-center gap-2.5 rounded-full btn-brand text-[15px] font-bold text-white"
          >
            <House className="h-[18px] w-[18px]" />
            Continue Shopping
            <ArrowRight className="h-[18px] w-[18px]" />
          </Link>

          <div className="flex items-center gap-3 pb-2 pt-1">
            <span className="h-px flex-1 bg-line" />
            <p className="flex shrink-0 items-center gap-1.5 text-[11.5px] text-ink-slate">
              Thank you for choosing Zupona
              <Heart className="h-3.5 w-3.5 fill-brand text-brand" />
            </p>
            <span className="h-px flex-1 bg-line" />
          </div>
        </div>
      </div>
    </div>
  );
}
