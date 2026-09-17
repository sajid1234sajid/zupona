import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import ProductHeader from "@/components/layout/ProductHeader";
import DesktopHeader from "@/components/layout/DesktopHeader";
import BottomNav from "@/components/layout/BottomNav";
import CartItemRow from "@/components/cart/CartItemRow";
import { removeUnavailableItemsAction } from "./actions";
import { getShopper } from "@/lib/session";
import { getCartItems, cartSubtotal } from "@/lib/cart";
import { resolveDelivery } from "@/lib/checkout";
import { getShopSettings } from "@/lib/shopSettings";
import { formatPrice } from "@/lib/format";

export default async function CartPage() {
  // A browser that has never added anything has no shopper yet, and simply an
  // empty cart -- not a trip to the sign-in page.
  // The shop's settings are the same for everybody, so they are asked for
  // alongside the session rather than after it -- three waits in a row was
  // three round trips for a screen that needs two.
  const [shopper, settings] = await Promise.all([getShopper(), getShopSettings()]);
  const items = shopper ? await getCartItems(shopper.id) : [];
  const subtotal = cartSubtotal(items);
  // Quoted from the option checkout opens on -- home delivery -- so the two
  // screens agree. Free delivery is the shopper's to choose there, and the
  // cart does not pre-empt a choice they have not made.
  // Counted from the subtotal, not from the number of lines: a cart holding
  // nothing but withdrawn items has nothing to deliver, and quoting a delivery
  // charge against a subtotal of zero showed a total of ৳130 for an order that
  // could not be placed at all.
  const shippingFee = subtotal > 0 ? resolveDelivery("home", subtotal, settings).fee : 0;
  const total = subtotal + shippingFee;

  // Checkout will not open while a withdrawn line is in the cart -- it sends
  // the shopper straight back here, which from a phone is indistinguishable
  // from the button being dead. So the button stops pretending: when there is
  // something in the way it says so, and pressing it clears the way.
  const blocked = items.filter((item) => item.unavailable);
  const blockedLabel =
    blocked.length === 0
      ? ""
      : items.length === blocked.length
        ? "Remove unavailable items"
        : `Remove ${blocked.length} unavailable item${blocked.length > 1 ? "s" : ""} & checkout`;

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-brand-mist pb-40 tab:max-w-none tab:pb-12">
      <div className="tab:hidden">
        <ProductHeader />
      </div>
      <DesktopHeader />
      <main className="flex-1 px-4 pt-4 tab:mx-auto tab:w-full tab:max-w-shell tab:px-6 tab:pt-6">
        <h1 className="text-lg font-bold text-heading tab:text-2xl">My Cart</h1>

        {items.length === 0 ? (
          <div className="mt-10 flex flex-col items-center gap-3 text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-tint">
              <ShoppingCart className="h-7 w-7 text-brand" />
            </span>
            <p className="text-sm font-semibold text-ink">Your cart is empty</p>
            <p className="max-w-xs text-xs text-ink-slate">
              Browse products and add your favorites to the cart.
            </p>
            <Link href="/" className="mt-2 rounded-full bg-brand px-6 py-2.5 text-sm font-semibold text-white">
              Start Shopping
            </Link>
          </div>
        ) : (
          // On a laptop the lines and the totals sit side by side, and the
          // checkout button moves into the totals card instead of a fixed bar.
          <div className="tab:grid tab:grid-cols-[minmax(0,1fr)_340px] tab:items-start tab:gap-6">
            <div className="mt-3 flex flex-col gap-3">
              {items.map((item) => (
                <CartItemRow key={item.id} item={item} />
              ))}
            </div>

            <div className="mt-4 space-y-2 rounded-2xl bg-white p-4 shadow-card tab:sticky tab:top-20 tab:mt-3 tab:p-5">
              <div className="flex items-center justify-between text-sm text-ink-slate">
                <span>Subtotal</span>
                <span className="font-semibold text-heading">{formatPrice(subtotal)}</span>
              </div>
              <div className="flex items-center justify-between text-sm text-ink-slate">
                <span>Delivery charge</span>
                <span className="font-semibold text-heading">{formatPrice(shippingFee)}</span>
              </div>
              <div className="flex items-center justify-between border-t border-line-soft pt-2 text-sm font-bold text-heading">
                <span>Total</span>
                <span>{formatPrice(total)}</span>
              </div>
              {blocked.length > 0 ? (
                <form action={removeUnavailableItemsAction} className="!mt-4 hidden tab:block">
                  <button
                    type="submit"
                    className="flex w-full items-center justify-center rounded-xl bg-brand-darkest py-3.5 text-sm font-semibold text-white transition-colors hover:bg-brand-dark"
                  >
                    {blockedLabel}
                  </button>
                </form>
              ) : (
                <Link
                  href="/checkout"
                  className="!mt-4 hidden w-full items-center justify-center rounded-xl bg-brand-darkest py-3.5 text-sm font-semibold text-white transition-colors hover:bg-brand-dark tab:flex"
                >
                  Proceed to Checkout
                </Link>
              )}
            </div>
          </div>
        )}
      </main>

      {items.length > 0 && (
        <div className="fixed inset-x-0 bottom-16 z-10 mx-auto max-w-md border-t border-line bg-white px-4 py-3 tab:hidden">
          {blocked.length > 0 ? (
            <form action={removeUnavailableItemsAction}>
              <button
                type="submit"
                className="flex w-full items-center justify-center rounded-xl bg-brand-darkest py-3.5 text-sm font-semibold text-white"
              >
                {blockedLabel}
              </button>
            </form>
          ) : (
            <Link
              href="/checkout"
              className="flex w-full items-center justify-center rounded-xl bg-brand-darkest py-3.5 text-sm font-semibold text-white"
            >
              Proceed to Checkout · {formatPrice(total)}
            </Link>
          )}
        </div>
      )}
      <BottomNav />
    </div>
  );
}
