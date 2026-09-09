"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ShoppingCart, Zap, LoaderCircle } from "lucide-react";
import type { ProductColor } from "@/types";
import { addToCartAction } from "@/app/cart/actions";

export default function ProductPurchasePanel({
  productId,
  colors,
}: {
  productId: string;
  colors: ProductColor[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState(0);
  const [cartPending, startCartTransition] = useTransition();
  const [buyPending, startBuyTransition] = useTransition();
  const [added, setAdded] = useState(false);

  const selectedColor = colors[selected]?.name ?? "";

  function handleAddToCart() {
    startCartTransition(async () => {
      await addToCartAction(productId, selectedColor);
      setAdded(true);
      router.refresh();
    });
  }

  function handleBuyNow() {
    startBuyTransition(async () => {
      await addToCartAction(productId, selectedColor);
      router.push("/checkout");
    });
  }

  return (
    <>
      {colors.length > 0 && (
        <div className="px-4 pt-3">
          <p className="text-sm font-bold text-neutral-800">Color</p>
          <div className="mt-1.5 flex gap-4">
            {colors.map((color, index) => (
              <button
                key={color.name}
                onClick={() => setSelected(index)}
                className="flex flex-col items-center gap-1"
              >
                <span
                  className={`flex h-10 w-10 items-center justify-center rounded-full ring-2 ring-offset-2 ${
                    index === selected ? "ring-brand" : "ring-transparent"
                  }`}
                >
                  <span
                    className="h-7 w-7 rounded-full border border-black/10"
                    style={{ background: color.swatch }}
                  />
                </span>
                <span className="max-w-[64px] truncate text-[9px] text-neutral-500">
                  {color.name}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="fixed inset-x-0 bottom-16 z-10 mx-auto flex max-w-md gap-3 border-t border-neutral-200 bg-white px-4 py-3">
        <button
          onClick={handleAddToCart}
          disabled={cartPending}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-brand py-2.5 text-sm font-semibold text-brand-darkest disabled:opacity-70"
        >
          {cartPending ? (
            <LoaderCircle className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <ShoppingCart className="h-4 w-4" />
              {added ? "Added to Cart" : "Add to Cart"}
            </>
          )}
        </button>
        <button
          onClick={handleBuyNow}
          disabled={buyPending}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-brand-darkest py-2.5 text-sm font-semibold text-white disabled:opacity-70"
        >
          {buyPending ? (
            <LoaderCircle className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <Zap className="h-4 w-4 fill-white" />
              Buy Now
            </>
          )}
        </button>
      </div>
    </>
  );
}
