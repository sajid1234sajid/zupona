"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import Image from "@/components/ui/StoreImage";
import { useRouter } from "next/navigation";
import { Heart } from "lucide-react";
import type { StoreProductCard } from "@/lib/storefront";
import { formatPrice } from "@/lib/format";
import { toggleWishlistAction } from "@/app/wishlist/actions";

function SimilarCard({
  product,
  initiallyWishlisted,
  isSignedIn,
}: {
  product: StoreProductCard;
  initiallyWishlisted: boolean;
  isSignedIn: boolean;
}) {
  const router = useRouter();
  const [wishlisted, setWishlisted] = useState(initiallyWishlisted);
  const [pending, startTransition] = useTransition();
  const href = `/product/${product.id}`;

  function toggleWishlist() {
    // A redirect thrown inside the action is not followed from a click handler,
    // so a guest is sent to sign in here instead of the tap doing nothing.
    if (!isSignedIn) {
      router.push("/account/login");
      return;
    }
    setWishlisted((value) => !value);
    startTransition(async () => {
      await toggleWishlistAction(product.id);
      router.refresh();
    });
  }

  return (
    <li className="min-w-0 overflow-hidden rounded-xl border border-line bg-white">
      <div className="relative">
        <Link prefetch={false} href={href} className="relative block aspect-square bg-mint">
          <Image
            src={product.image}
            alt={product.name}
            fill
            sizes="(min-width: 1024px) 220px, (min-width: 700px) 25vw, 50vw"
            className="object-cover"
            unoptimized={product.image.startsWith("/api/media/")}
          />
        </Link>
        <button
          type="button"
          onClick={toggleWishlist}
          disabled={pending}
          aria-pressed={wishlisted}
          aria-label={wishlisted ? `Remove ${product.name} from wishlist` : `Add ${product.name} to wishlist`}
          className="absolute bottom-1.5 right-1.5 grid h-9 w-9 place-items-center rounded-full bg-white/95 shadow-card focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          <Heart
            className={`h-[18px] w-[18px] ${wishlisted ? "fill-accent-red text-accent-red" : "text-ink-muted"}`}
          />
        </button>
      </div>

      <Link prefetch={false} href={href} className="block p-2">
        <h3 className="line-clamp-2 min-h-[2.5em] text-[13px] font-semibold leading-tight text-heading">
          {product.name}
        </h3>
        <p className="mt-1 flex flex-wrap items-baseline gap-x-1.5">
          <span className="text-[15px] font-extrabold text-brand">{formatPrice(product.price)}</span>
          {product.discountPercent > 0 && (
            <>
              <span className="text-[11px] text-ink-faint line-through">{formatPrice(product.oldPrice)}</span>
              <span className="text-[11px] font-bold text-brand">({product.discountPercent}% OFF)</span>
            </>
          )}
        </p>
      </Link>
    </li>
  );
}

/** Other products from the same department, most popular first. */
export default function SimilarProducts({
  products,
  wishlistIds,
  isSignedIn,
}: {
  products: StoreProductCard[];
  wishlistIds: string[];
  isSignedIn: boolean;
}) {
  if (products.length === 0) return null;
  const saved = new Set(wishlistIds);

  return (
    <section id="similar" aria-labelledby="similar-title" className="scroll-mt-4">
      <h2 id="similar-title" className="text-base font-extrabold text-heading">
        Similar Products
      </h2>
      <ul className="mt-2.5 grid grid-cols-2 gap-2.5 tab:grid-cols-4 lg:grid-cols-6">
        {products.map((product) => (
          <SimilarCard
            key={product.id}
            product={product}
            initiallyWishlisted={saved.has(product.id)}
            isSignedIn={isSignedIn}
          />
        ))}
      </ul>
    </section>
  );
}
