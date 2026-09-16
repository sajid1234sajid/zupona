"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "@/components/ui/StoreImage";
import Link from "next/link";
import { Minus, Plus, Trash2 } from "lucide-react";
import type { CartItem } from "@/types";
import { formatPrice } from "@/lib/format";
import { updateCartQuantityAction, removeFromCartAction } from "@/app/cart/actions";

export default function CartItemRow({ item }: { item: CartItem }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function updateQuantity(quantity: number) {
    startTransition(async () => {
      await updateCartQuantityAction(item.id, quantity);
      router.refresh();
    });
  }

  function remove() {
    startTransition(async () => {
      await removeFromCartAction(item.id);
      router.refresh();
    });
  }

  const gone = item.unavailable;

  return (
    <div
      className={`flex gap-3 rounded-2xl bg-white p-3 shadow-card ${pending ? "opacity-60" : ""} ${
        gone ? "border border-dashed border-line" : ""
      }`}
    >
      <Link href={`/product/${item.productId}`} className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-brand-mist">
        <Image src={item.product.image} alt={item.product.name} fill sizes="80px" className="object-cover" />
      </Link>

      <div className="flex flex-1 flex-col justify-between min-w-0">
        <div>
          <Link href={`/product/${item.productId}`} className="line-clamp-1 text-sm font-semibold text-heading">
            {item.product.name}
          </Link>
          {item.color && <p className="mt-0.5 text-xs text-ink-slate">Color: {item.color}</p>}
          {gone && (
            <p className="mt-1 text-xs font-medium text-accent-red">
              No longer available — remove it to check out
            </p>
          )}
        </div>

        <div className="flex items-center justify-between">
          <span
            className={`text-sm font-bold ${gone ? "text-ink-slate line-through" : "text-heading"}`}
          >
            {formatPrice(item.product.price)}
          </span>

          <div className="flex items-center gap-2">
            {/* The stepper is pointless on a line that cannot be bought, and
                asking for more of it would delete the line outright. Remove
                stays, because removing it is the way forward. */}
            <div
              className={`flex items-center gap-2 rounded-full border border-line px-2 py-1 ${
                gone ? "opacity-40" : ""
              }`}
            >
              <button
                aria-label="Decrease quantity"
                disabled={pending || gone}
                onClick={() => updateQuantity(item.quantity - 1)}
                className="text-ink-slate"
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
              <span className="w-4 text-center text-xs font-semibold">{item.quantity}</span>
              <button
                aria-label="Increase quantity"
                disabled={pending || gone}
                onClick={() => updateQuantity(item.quantity + 1)}
                className="text-ink-slate"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
            <button
              aria-label="Remove from cart"
              disabled={pending}
              onClick={remove}
              className="text-accent-red"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
