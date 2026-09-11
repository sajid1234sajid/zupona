import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import ProductHeader from "@/components/layout/ProductHeader";
import BottomNav from "@/components/layout/BottomNav";
import CartItemRow from "@/components/cart/CartItemRow";
import { requireUser } from "@/lib/session";
import { getCartItems, cartSubtotal } from "@/lib/cart";
import { getDeliveryMethod } from "@/lib/checkout";
import { getDeliveryFees } from "@/lib/shopSettings";
import { formatPrice } from "@/lib/format";

export default async function CartPage() {
  const user = await requireUser();
  const items = await getCartItems(user.id);
  const subtotal = cartSubtotal(items);
  const fees = await getDeliveryFees();
  const shippingFee = items.length > 0 ? getDeliveryMethod("standard", fees).fee : 0;
  const total = subtotal + shippingFee;

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-brand-mist pb-40">
      <ProductHeader />
      <main className="flex-1 px-4 pt-4">
        <h1 className="text-lg font-bold text-heading">My Cart</h1>

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
          <>
            <div className="mt-3 flex flex-col gap-3">
              {items.map((item) => (
                <CartItemRow key={item.id} item={item} />
              ))}
            </div>

            <div className="mt-4 space-y-2 rounded-2xl bg-white p-4 shadow-card">
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
            </div>
          </>
        )}
      </main>

      {items.length > 0 && (
        <div className="fixed inset-x-0 bottom-16 z-10 mx-auto max-w-md border-t border-line bg-white px-4 py-3">
          <Link
            href="/checkout"
            className="flex w-full items-center justify-center rounded-xl bg-brand-darkest py-3.5 text-sm font-semibold text-white"
          >
            Proceed to Checkout · {formatPrice(total)}
          </Link>
        </div>
      )}
      <BottomNav />
    </div>
  );
}
