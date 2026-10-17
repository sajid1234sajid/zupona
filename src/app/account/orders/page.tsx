import Link from "next/link";
import DesktopHeader from "@/components/layout/DesktopHeader";
import { ChevronLeft, Package, Search } from "lucide-react";
import BottomNav from "@/components/layout/BottomNav";
import OrderCard from "@/components/order/OrderCard";
import GuaranteeList, { guaranteesFrom } from "@/components/info/Guarantees";
import { requireUser } from "@/lib/session";
import { getOrders } from "@/lib/orders";
import { getPolicyFacts } from "@/lib/policyFacts";
import { getSupportContact } from "@/lib/contact";
import type { Order } from "@/types";

const TABS: { id: string; label: string; match: (order: Order) => boolean }[] = [
  { id: "all", label: "All", match: () => true },
  { id: "to-confirm", label: "To confirm", match: (o) => o.status === "placed" },
  { id: "processing", label: "Processing", match: (o) => o.status === "confirmed" },
  { id: "shipped", label: "Shipped", match: (o) => o.status === "shipped" || o.status === "out_for_delivery" },
  { id: "delivered", label: "Delivered", match: (o) => o.status === "delivered" },
  { id: "cancelled", label: "Cancelled", match: (o) => o.status === "cancelled" },
];

/** Every order, by where it is, with a search by product name or order
 * number. The tab and the search live in the address, so Back returns to the
 * same view. */
export default async function OrdersPage({ searchParams }: PageProps<"/account/orders">) {
  const user = await requireUser();
  const params = await searchParams;
  const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? "";
  const tabId = TABS.some((tab) => tab.id === first(params.tab)) ? first(params.tab) : "all";
  const query = first(params.q).trim().toLowerCase();

  const [orders, facts, contact] = await Promise.all([getOrders(user.id), getPolicyFacts(), getSupportContact()]);
  const searched = query
    ? orders.filter(
        (order) =>
          order.orderNumber.toLowerCase().includes(query) ||
          order.items.some((item) => item.name.toLowerCase().includes(query))
      )
    : orders;
  const tab = TABS.find((entry) => entry.id === tabId) ?? TABS[0];
  const shown = searched.filter(tab.match);
  const href = (id: string) => {
    const search = new URLSearchParams();
    if (id !== "all") search.set("tab", id);
    if (query) search.set("q", query);
    const text = search.toString();
    return text ? `/account/orders?${text}` : "/account/orders";
  };

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-brand-mist pb-20 tab:max-w-none tab:pb-12">
      <DesktopHeader />
      <header className="flex items-center gap-3 border-b border-line-soft bg-white px-4 py-3 tab:mx-auto tab:mt-6 tab:w-full tab:max-w-2xl tab:rounded-2xl tab:border">
        <Link href="/account" aria-label="Back to account">
          <ChevronLeft className="h-5 w-5 text-ink" />
        </Link>
        <h1 className="text-base font-bold text-heading">My Orders</h1>
      </header>
      <main className="flex-1 px-4 pt-4 tab:mx-auto tab:w-full tab:max-w-2xl tab:px-0">
        {orders.length === 0 ? (
          <div className="mt-10 flex flex-col items-center gap-3 text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-tint">
              <Package className="h-7 w-7 text-brand" />
            </span>
            <p className="text-sm font-semibold text-ink">You don&apos;t have any orders yet</p>
            <p className="max-w-xs text-xs text-ink-slate">Your orders will show up here once you place one.</p>
            <Link href="/" className="mt-2 rounded-full bg-brand px-6 py-2.5 text-sm font-semibold text-white">
              Start Shopping
            </Link>
          </div>
        ) : (
          <>
            <form action="/account/orders" className="relative">
              {tabId !== "all" ? <input type="hidden" name="tab" value={tabId} /> : null}
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
              <input
                type="search"
                name="q"
                defaultValue={query}
                placeholder="Search by product name or order ID"
                className="h-11 w-full rounded-xl border border-line bg-white pl-10 pr-3 text-[13px] outline-none focus:border-brand"
              />
            </form>

            <nav aria-label="Order status" className="no-scrollbar -mx-4 mt-3 flex gap-1.5 overflow-x-auto px-4 tab:mx-0 tab:px-0">
              {TABS.map((entry) => {
                const count = searched.filter(entry.match).length;
                const active = entry.id === tab.id;
                return (
                  <Link
                    key={entry.id}
                    href={href(entry.id)}
                    aria-current={active ? "page" : undefined}
                    className={`shrink-0 rounded-full px-3.5 py-1.5 text-[12px] font-semibold ${
                      active ? "bg-brand text-white" : "bg-white text-ink-muted"
                    }`}
                  >
                    {entry.label}
                    {count > 0 ? ` (${count})` : ""}
                  </Link>
                );
              })}
            </nav>

            {shown.length === 0 ? (
              <p className="mt-8 text-center text-[13px] text-ink-slate">
                {query ? `No orders match “${query}”.` : "No orders here."}
              </p>
            ) : (
              <div className="mt-3 flex flex-col gap-3">
                {shown.map((order) => (
                  <OrderCard key={order.id} order={order} supportWhatsapp={contact.whatsapp} />
                ))}
              </div>
            )}

            <section className="mt-6">
              <h2 className="mb-2 text-sm font-bold text-heading">Our promise on every order</h2>
              <GuaranteeList items={guaranteesFrom(facts).slice(0, 4)} />
            </section>
          </>
        )}
      </main>
      <BottomNav />
    </div>
  );
}
