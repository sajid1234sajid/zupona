"use client";

import { useMemo, useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowUpDown,
  Check,
  CheckCheck,
  Flame,
  LoaderCircle,
  ShoppingCart,
  Trash2,
  TrendingDown,
  X,
} from "lucide-react";
import type { WishlistEntry, WishlistSort } from "@/types";
import { WISHLIST_SORTS } from "@/lib/wishlistSorts";
import { formatPrice } from "@/lib/format";
import {
  moveToCartAction,
  removeFromWishlistAction,
  removeManyFromWishlistAction,
} from "@/app/wishlist/actions";

/** The wishlist list, its selection mode and its bulk actions.
 *
 * A saved item is only worth saving if it is easy to act on later, so every
 * row carries one primary action (move to cart) and one destructive one
 * (remove), and selection mode turns both into bulk operations rather than
 * making the shopper repeat a tap fifteen times.
 *
 * Removals are optimistic — the row disappears immediately and the server
 * action runs behind it. `router.refresh()` then reconciles: if the delete
 * failed, the row comes back rather than the list quietly lying.
 */
export default function WishlistClient({
  entries,
  sort,
}: {
  entries: WishlistEntry[];
  sort: WishlistSort;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const [sortOpen, setSortOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const visible = useMemo(
    () => entries.filter((entry) => !removed.has(entry.product.id)),
    [entries, removed]
  );

  const activeSortLabel =
    WISHLIST_SORTS.find((option) => option.id === sort)?.label ?? "Recently added";

  function toggleSelected(productId: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return next;
    });
  }

  function selectAll() {
    setSelected(new Set(visible.map((entry) => entry.product.id)));
  }

  function exitSelectMode() {
    setSelecting(false);
    setSelected(new Set());
  }

  function applySort(next: WishlistSort) {
    setSortOpen(false);
    router.push(next === "recent" ? "/wishlist" : `/wishlist?sort=${next}`, { scroll: false });
  }

  function move(productIds: string[]) {
    if (productIds.length === 0) return;
    setRemoved((current) => new Set([...current, ...productIds]));
    exitSelectMode();

    startTransition(async () => {
      const result = await moveToCartAction(productIds);
      setNotice(
        result.moved === 1
          ? "Moved to cart"
          : `${result.moved} items moved to cart`
      );
      router.refresh();
    });
  }

  function remove(productIds: string[]) {
    if (productIds.length === 0) return;
    setRemoved((current) => new Set([...current, ...productIds]));
    exitSelectMode();

    startTransition(async () => {
      if (productIds.length === 1) await removeFromWishlistAction(productIds[0]);
      else await removeManyFromWishlistAction(productIds);
      setNotice(productIds.length === 1 ? "Removed" : `${productIds.length} items removed`);
      router.refresh();
    });
  }

  const allSelected = selected.size > 0 && selected.size === visible.length;

  return (
    <>
      {/* Toolbar */}
      <div className="mt-3 flex items-center gap-2">
        <button
          onClick={() => setSortOpen(true)}
          className="flex items-center gap-1 rounded-full border border-line bg-white px-2.5 py-1 text-[10px] font-semibold text-ink-slate"
        >
          <ArrowUpDown className="h-3 w-3" />
          {activeSortLabel}
        </button>

        <button
          onClick={() => (selecting ? exitSelectMode() : setSelecting(true))}
          className={`ml-auto flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold transition-colors ${
            selecting
              ? "bg-heading text-white"
              : "border border-line bg-white text-ink-slate"
          }`}
        >
          {selecting ? <X className="h-3 w-3" /> : <CheckCheck className="h-3 w-3" />}
          {selecting ? "Cancel" : "Select"}
        </button>

        {!selecting && visible.length > 1 && (
          <button
            onClick={() => move(visible.map((entry) => entry.product.id))}
            disabled={pending}
            className="flex items-center gap-1 rounded-full bg-brand px-2.5 py-1 text-[10px] font-semibold text-white disabled:opacity-60"
          >
            <ShoppingCart className="h-3 w-3" />
            Move all
          </button>
        )}
      </div>

      {selecting && (
        <div className="mt-2 flex items-center gap-2 rounded-lg bg-white px-2.5 py-2 shadow-card">
          <button
            onClick={() => (allSelected ? setSelected(new Set()) : selectAll())}
            className="text-[10px] font-semibold text-brand"
          >
            {allSelected ? "Clear all" : "Select all"}
          </button>
          <span className="text-[10px] text-ink-slate">{selected.size} selected</span>
          <div className="ml-auto flex items-center gap-1.5">
            <button
              onClick={() => remove([...selected])}
              disabled={selected.size === 0 || pending}
              className="flex items-center gap-1 rounded-full border border-line px-2.5 py-1 text-[10px] font-semibold text-ink-slate disabled:opacity-40"
            >
              <Trash2 className="h-3 w-3" />
              Remove
            </button>
            <button
              onClick={() => move([...selected])}
              disabled={selected.size === 0 || pending}
              className="flex items-center gap-1 rounded-full bg-brand px-2.5 py-1 text-[10px] font-semibold text-white disabled:opacity-40"
            >
              <ShoppingCart className="h-3 w-3" />
              Move to cart
            </button>
          </div>
        </div>
      )}

      {/* Rows */}
      <div className="mt-2.5 flex flex-col gap-2">
        {visible.map((entry) => {
          const { product } = entry;
          const sellingPrice = entry.flashPrice ?? product.price;
          const isSelected = selected.has(product.id);

          return (
            <div
              key={product.id}
              className={`flex gap-2.5 rounded-xl bg-white p-2 shadow-card ${
                isSelected ? "ring-2 ring-brand" : ""
              }`}
            >
              {selecting && (
                <button
                  onClick={() => toggleSelected(product.id)}
                  aria-label={isSelected ? `Deselect ${product.name}` : `Select ${product.name}`}
                  aria-pressed={isSelected}
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center self-start rounded-md border ${
                    isSelected ? "border-brand bg-brand" : "border-line bg-white"
                  }`}
                >
                  {isSelected && <Check className="h-3.5 w-3.5 text-white" />}
                </button>
              )}

              <Link
                href={`/product/${product.id}`}
                className="relative h-[76px] w-[76px] shrink-0 overflow-hidden rounded-lg bg-brand-mist"
              >
                <Image
                  src={product.image}
                  alt={product.name}
                  fill
                  sizes="76px"
                  className="object-cover"
                />
                {product.discountPercent > 0 && (
                  <span className="absolute left-1 top-1 rounded bg-brand px-1 text-[10px] font-bold text-white">
                    -{product.discountPercent}%
                  </span>
                )}
              </Link>

              <div className="min-w-0 flex-1">
                <Link href={`/product/${product.id}`} className="block">
                  <p className="truncate text-[12px] font-semibold text-heading">
                    {product.name}
                  </p>
                  <p className="text-[9px] text-ink-slate">{entry.categoryName}</p>
                </Link>

                <div className="mt-0.5 flex items-baseline gap-1.5">
                  <span
                    className={`text-[13px] font-bold ${
                      entry.flashPrice !== null ? "text-accent-red" : "text-heading"
                    }`}
                  >
                    {formatPrice(sellingPrice)}
                  </span>
                  {product.oldPrice > sellingPrice && (
                    <span className="text-[9.5px] text-ink-slate line-through">
                      {formatPrice(product.oldPrice)}
                    </span>
                  )}
                </div>

                <div className="mt-1 flex flex-wrap items-center gap-1">
                  {entry.priceDrop > 0 && (
                    <span className="flex items-center gap-0.5 rounded bg-brand-tint px-1.5 py-0.5 text-[10px] font-bold text-brand-dark">
                      <TrendingDown className="h-2.5 w-2.5" />
                      Dropped {formatPrice(entry.priceDrop)} since you saved it
                    </span>
                  )}
                  {entry.flashPrice !== null && (
                    <span className="flex items-center gap-0.5 rounded bg-accent-red/10 px-1.5 py-0.5 text-[10px] font-bold text-accent-red">
                      <Flame className="h-2.5 w-2.5" />
                      In flash sale
                    </span>
                  )}
                  {entry.inCart && (
                    <span className="rounded bg-brand-mist px-1.5 py-0.5 text-[10px] font-semibold text-ink-slate">
                      Already in cart
                    </span>
                  )}
                </div>

                {!selecting && (
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <button
                      onClick={() => move([product.id])}
                      disabled={pending}
                      className="flex flex-1 items-center justify-center gap-1 rounded-md bg-brand py-1 text-[10px] font-semibold text-white disabled:opacity-60"
                    >
                      {pending ? (
                        <LoaderCircle className="h-3 w-3 animate-spin" />
                      ) : (
                        <>
                          <ShoppingCart className="h-3 w-3" />
                          Move to cart
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => remove([product.id])}
                      disabled={pending}
                      aria-label={`Remove ${product.name} from wishlist`}
                      className="flex h-[22px] w-[26px] items-center justify-center rounded-md border border-line text-ink-slate disabled:opacity-60"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {visible.length === 0 && (
        <p className="mt-8 text-center text-xs text-ink-slate">
          Everything here has been moved or removed.
        </p>
      )}

      {/* Sort sheet */}
      {sortOpen && (
        <div className="fixed inset-0 z-40 flex items-end justify-center">
          <button
            aria-label="Close sort options"
            onClick={() => setSortOpen(false)}
            className="absolute inset-0 bg-black/40"
          />
          <div className="relative w-full max-w-md rounded-t-2xl bg-white pb-6 pt-3 shadow-xl">
            <div className="flex items-center justify-between px-4 pb-2">
              <p className="text-sm font-bold text-heading">Sort wishlist</p>
              <button aria-label="Close" onClick={() => setSortOpen(false)}>
                <X className="h-4 w-4 text-ink-slate" />
              </button>
            </div>
            {WISHLIST_SORTS.map((option) => (
              <button
                key={option.id}
                onClick={() => applySort(option.id)}
                className="flex w-full items-center justify-between px-4 py-2.5 text-left text-[13px] text-ink"
              >
                <span className={option.id === sort ? "font-semibold text-brand" : undefined}>
                  {option.label}
                </span>
                {option.id === sort && <Check className="h-4 w-4 text-brand" />}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Result toast */}
      {notice && (
        <div
          role="status"
          className="pointer-events-none fixed inset-x-0 bottom-20 z-30 mx-auto flex max-w-md justify-center px-4"
        >
          <div className="pointer-events-auto flex items-center gap-2 rounded-full bg-heading/90 px-4 py-2 text-[11px] font-semibold text-white shadow-lg">
            <Check className="h-3.5 w-3.5 text-brand-light" />
            {notice}
            <Link href="/cart" className="underline">
              View cart
            </Link>
            <button onClick={() => setNotice(null)} aria-label="Dismiss">
              <X className="h-3.5 w-3.5 text-brand-tint" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
