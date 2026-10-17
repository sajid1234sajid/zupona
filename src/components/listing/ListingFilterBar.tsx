"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, SlidersHorizontal, Star, X } from "lucide-react";
import type { Facet, ListingFacets } from "@/lib/listing";
import {
  LISTING_SORTS,
  PRICE_PRESETS,
  clearFilters,
  hasFilters,
  listingQuery,
  parsePrice,
  priceLabel,
  toggleIn,
  type ListingFilters,
  type ListingSort,
} from "@/lib/listingParams";

type Panel = "sort" | "category" | "price" | "size" | "color" | "brand" | null;

/** The filter row above a product listing, its drawer, and the chips that
 * say what is applied.
 *
 * Every control writes the URL and lets the server answer, so the list, the
 * total and the count beside each option always come from the same pass and
 * Back walks through the filters a shopper tried. Only options that would
 * show something are offered: a size row appears when the results come in
 * sizes, a brand row when they carry brands. */
export default function ListingFilterBar({
  basePath,
  filters,
  facets,
  total,
  defaultSort = "relevance",
}: {
  basePath: string;
  filters: ListingFilters;
  facets: ListingFacets;
  total: number;
  defaultSort?: ListingSort;
}) {
  const router = useRouter();
  const [panel, setPanel] = useState<Panel>(null);
  const [drawer, setDrawer] = useState(false);
  const [pending, startTransition] = useTransition();
  const rowRef = useRef<HTMLDivElement | null>(null);

  // A click anywhere outside the open dropdown closes it.
  useEffect(() => {
    if (!panel) return;
    const close = (event: MouseEvent) => {
      if (!rowRef.current?.contains(event.target as Node)) setPanel(null);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [panel]);

  useEffect(() => {
    if (!drawer) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setDrawer(false);
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKey);
    };
  }, [drawer]);

  function go(next: ListingFilters, keepOpen = false) {
    if (!keepOpen) setPanel(null);
    const query = listingQuery(next, defaultSort);
    startTransition(() => {
      router.replace(query ? `${basePath}?${query}` : basePath, { scroll: false });
    });
  }

  const activeCount =
    (filters.category ? 1 : 0) +
    (filters.price ? 1 : 0) +
    filters.sizes.length +
    filters.colors.length +
    filters.brands.length +
    (filters.deals ? 1 : 0) +
    (filters.freeDelivery ? 1 : 0) +
    (filters.rating4 ? 1 : 0);

  const sortLabel = LISTING_SORTS.find((s) => s.id === filters.sort)?.label ?? "Relevance";
  const categoryLabel = facets.categories.find((c) => c.value === filters.category)?.label;

  const chip = (active: boolean) =>
    `inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-[12.5px] font-semibold transition-colors ${
      active
        ? "border-brand bg-brand-tint text-brand-dark"
        : "border-line bg-white text-ink hover:border-brand/50"
    }`;

  const dropdown = (id: Exclude<Panel, null>, label: string, active: boolean, body: React.ReactNode) => (
    <div className="relative shrink-0">
      <button
        type="button"
        aria-expanded={panel === id}
        onClick={() => {
          // On a phone the row scrolls sideways, which would clip a dropdown
          // hanging off it; the drawer holds every one of these instead.
          if (!window.matchMedia("(min-width: 700px)").matches) {
            setDrawer(true);
            return;
          }
          setPanel(panel === id ? null : id);
        }}
        className={chip(active)}
      >
        {label}
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${panel === id ? "rotate-180" : ""}`} />
      </button>
      {panel === id ? (
        <div className="absolute left-0 top-11 z-30 max-h-[60vh] w-64 overflow-y-auto rounded-2xl border border-line bg-white p-1.5 shadow-[0_12px_32px_-12px_rgba(0,35,28,0.35)]">
          {body}
        </div>
      ) : null}
    </div>
  );

  const optionRow = (label: React.ReactNode, selected: boolean, onClick: () => void, count?: number, key?: string) => (
    <button
      key={key}
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-[13px] hover:bg-brand-mist ${
        selected ? "font-semibold text-brand-dark" : "text-ink"
      }`}
    >
      <span className="flex-1">{label}</span>
      {typeof count === "number" ? <span className="text-[11.5px] text-ink-faint">{count}</span> : null}
      {selected ? <Check className="h-4 w-4 text-brand" /> : null}
    </button>
  );

  const facetList = (facet: Facet[], selected: string[], field: "sizes" | "colors" | "brands") =>
    facet.map((f) =>
      optionRow(
        f.label,
        selected.map((s) => s.toLowerCase()).includes(f.value),
        () => go({ ...filters, [field]: toggleIn(selected.map((s) => s.toLowerCase()), f.value) }, true),
        f.count,
        f.value
      )
    );

  const applied: { label: string; clear: ListingFilters }[] = [];
  if (filters.category) applied.push({ label: categoryLabel?.replace(/^› /, "") ?? "Category", clear: { ...filters, category: null } });
  if (filters.price) applied.push({ label: priceLabel(filters.price), clear: { ...filters, price: null } });
  for (const s of filters.sizes) applied.push({ label: `Size ${s.toUpperCase()}`, clear: { ...filters, sizes: filters.sizes.filter((v) => v !== s) } });
  for (const c of filters.colors) {
    const label = facets.colors.find((f) => f.value === c.toLowerCase())?.label ?? c;
    applied.push({ label, clear: { ...filters, colors: filters.colors.filter((v) => v !== c) } });
  }
  for (const b of filters.brands) {
    const label = facets.brands.find((f) => f.value === b.toLowerCase())?.label ?? b;
    applied.push({ label, clear: { ...filters, brands: filters.brands.filter((v) => v !== b) } });
  }
  if (filters.deals) applied.push({ label: "Deals", clear: { ...filters, deals: false } });
  if (filters.freeDelivery) applied.push({ label: "Free delivery", clear: { ...filters, freeDelivery: false } });
  if (filters.rating4) applied.push({ label: "4★ & up", clear: { ...filters, rating4: false } });

  return (
    <div className={pending ? "opacity-70 transition-opacity" : "transition-opacity"}>
      <div
        ref={rowRef}
        className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 no-scrollbar tab:mx-0 tab:flex-wrap tab:overflow-visible tab:px-0"
      >
        <button type="button" onClick={() => setDrawer(true)} className={chip(activeCount > 0)}>
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Filters{activeCount > 0 ? ` (${activeCount})` : ""}
        </button>

        {dropdown(
          "sort",
          `Sort: ${sortLabel}`,
          filters.sort !== defaultSort,
          LISTING_SORTS.map((s) =>
            optionRow(s.label, s.id === filters.sort, () => go({ ...filters, sort: s.id }), undefined, s.id)
          )
        )}

        {facets.categories.length > 1 || filters.category
          ? dropdown(
              "category",
              categoryLabel ? categoryLabel.replace(/^› /, "") : "Category",
              Boolean(filters.category),
              [
                optionRow("All categories", !filters.category, () => go({ ...filters, category: null }), undefined, "all"),
                ...facets.categories.map((c) =>
                  optionRow(c.label, c.value === filters.category, () => go({ ...filters, category: c.value }), c.count, c.value)
                ),
              ]
            )
          : null}

        {dropdown(
          "price",
          filters.price ? priceLabel(filters.price) : "Price",
          Boolean(filters.price),
          <PricePanel
            filters={filters}
            facets={facets}
            onApply={(price) => go({ ...filters, price })}
          />
        )}

        {facets.sizes.length > 0
          ? dropdown("size", filters.sizes.length ? `Size (${filters.sizes.length})` : "Size", filters.sizes.length > 0, facetList(facets.sizes, filters.sizes, "sizes"))
          : null}
        {facets.colors.length > 0
          ? dropdown("color", filters.colors.length ? `Color (${filters.colors.length})` : "Color", filters.colors.length > 0, facetList(facets.colors, filters.colors, "colors"))
          : null}
        {facets.brands.length > 0
          ? dropdown("brand", filters.brands.length ? `Brand (${filters.brands.length})` : "Brand", filters.brands.length > 0, facetList(facets.brands, filters.brands, "brands"))
          : null}

        {facets.deals > 0 || filters.deals ? (
          <button type="button" onClick={() => go({ ...filters, deals: !filters.deals })} className={chip(filters.deals)}>
            Deals
          </button>
        ) : null}
        {facets.freeDelivery > 0 || filters.freeDelivery ? (
          <button type="button" onClick={() => go({ ...filters, freeDelivery: !filters.freeDelivery })} className={chip(filters.freeDelivery)}>
            Free delivery
          </button>
        ) : null}
        {facets.rating4 > 0 || filters.rating4 ? (
          <button type="button" onClick={() => go({ ...filters, rating4: !filters.rating4 })} className={chip(filters.rating4)}>
            <Star className="h-3.5 w-3.5 fill-rating text-rating" /> 4 & up
          </button>
        ) : null}
      </div>

      {applied.length > 0 ? (
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          {applied.map((a) => (
            <button
              key={a.label}
              type="button"
              onClick={() => go(a.clear)}
              className="inline-flex h-7 items-center gap-1 rounded-full bg-brand px-2.5 text-[11.5px] font-semibold text-white"
            >
              {a.label}
              <X className="h-3 w-3" strokeWidth={3} />
            </button>
          ))}
          <button
            type="button"
            onClick={() => go(clearFilters(filters))}
            className="px-1.5 text-[12px] font-semibold text-brand hover:underline"
          >
            Clear all
          </button>
        </div>
      ) : null}

      {drawer ? (
        <div className="fixed inset-0 z-50 flex" role="dialog" aria-modal="true" aria-label="Filters">
          <button type="button" aria-label="Close filters" onClick={() => setDrawer(false)} className="absolute inset-0 bg-heading/40" />
          <div className="relative flex h-full w-full max-w-[380px] flex-col bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-line-soft px-4 py-3">
              <h2 className="text-[16px] font-bold text-heading">Filters</h2>
              <button type="button" onClick={() => setDrawer(false)} aria-label="Close" className="grid h-9 w-9 place-items-center rounded-full hover:bg-brand-mist">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-2">
              <DrawerSection title="Sort by">
                {LISTING_SORTS.map((sort) =>
                  optionRow(sort.label, sort.id === filters.sort, () => go({ ...filters, sort: sort.id }, true), undefined, sort.id)
                )}
              </DrawerSection>
              {facets.categories.length > 0 ? (
                <DrawerSection title="Category">
                  {optionRow("All categories", !filters.category, () => go({ ...filters, category: null }, true), undefined, "all")}
                  {facets.categories.map((c) =>
                    optionRow(c.label, c.value === filters.category, () => go({ ...filters, category: c.value }, true), c.count, c.value)
                  )}
                </DrawerSection>
              ) : null}
              <DrawerSection title="Price">
                <PricePanel filters={filters} facets={facets} onApply={(price) => go({ ...filters, price }, true)} />
              </DrawerSection>
              {facets.sizes.length > 0 ? <DrawerSection title="Size">{facetList(facets.sizes, filters.sizes, "sizes")}</DrawerSection> : null}
              {facets.colors.length > 0 ? <DrawerSection title="Color">{facetList(facets.colors, filters.colors, "colors")}</DrawerSection> : null}
              {facets.brands.length > 0 ? <DrawerSection title="Brand">{facetList(facets.brands, filters.brands, "brands")}</DrawerSection> : null}
              <DrawerSection title="More">
                {optionRow("Deals only", filters.deals, () => go({ ...filters, deals: !filters.deals }, true), facets.deals, "deals")}
                {optionRow("Free delivery", filters.freeDelivery, () => go({ ...filters, freeDelivery: !filters.freeDelivery }, true), facets.freeDelivery, "free")}
                {optionRow("4★ & up", filters.rating4, () => go({ ...filters, rating4: !filters.rating4 }, true), facets.rating4, "rating")}
              </DrawerSection>
            </div>

            <div className="flex gap-2 border-t border-line-soft p-3">
              <button
                type="button"
                disabled={!hasFilters(filters)}
                onClick={() => go(clearFilters(filters), true)}
                className="h-11 flex-1 rounded-full border border-brand text-[13.5px] font-bold text-brand-dark disabled:opacity-40"
              >
                Reset
              </button>
              <button
                type="button"
                onClick={() => setDrawer(false)}
                className="h-11 flex-[1.6] rounded-full bg-brand text-[13.5px] font-bold text-white"
              >
                {pending ? "Updating…" : `Show ${total} result${total === 1 ? "" : "s"}`}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function DrawerSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-b border-line-soft py-3 last:border-0">
      <h3 className="px-3 pb-1 text-[12px] font-bold uppercase tracking-wide text-ink-faint">{title}</h3>
      {children}
    </section>
  );
}

/** The four price shortcuts with their counts, and a min/max pair. */
function PricePanel({
  filters,
  facets,
  onApply,
}: {
  filters: ListingFilters;
  facets: ListingFacets;
  onApply: (price: ListingFilters["price"]) => void;
}) {
  const [min, setMin] = useState(filters.price ? String(filters.price.min || "") : "");
  const [max, setMax] = useState(filters.price?.max != null ? String(filters.price.max) : "");
  const current = filters.price ? `${filters.price.min}-${filters.price.max ?? ""}` : "";

  return (
    <div>
      {PRICE_PRESETS.map((preset) => {
        const count = facets.prices.find((p) => p.value === preset.id)?.count ?? 0;
        const selected = current === preset.id;
        return (
          <button
            key={preset.id}
            type="button"
            disabled={count === 0 && !selected}
            onClick={() => onApply(selected ? null : parsePrice(preset.id))}
            className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-[13px] hover:bg-brand-mist disabled:opacity-40 ${
              selected ? "font-semibold text-brand-dark" : "text-ink"
            }`}
          >
            <span className="flex-1">{preset.label}</span>
            <span className="text-[11.5px] text-ink-faint">{count}</span>
            {selected ? <Check className="h-4 w-4 text-brand" /> : null}
          </button>
        );
      })}
      <form
        className="mt-1 flex items-center gap-1.5 px-3 pb-1"
        onSubmit={(event) => {
          event.preventDefault();
          onApply(parsePrice(`${min.replace(/\D/g, "")}-${max.replace(/\D/g, "")}`));
        }}
      >
        <input
          inputMode="numeric"
          aria-label="Minimum price"
          placeholder="Min ৳"
          value={min}
          onChange={(e) => setMin(e.target.value)}
          className="h-9 w-full min-w-0 rounded-lg border border-line px-2.5 text-[13px] outline-none focus:border-brand"
        />
        <span className="text-ink-faint">–</span>
        <input
          inputMode="numeric"
          aria-label="Maximum price"
          placeholder="Max ৳"
          value={max}
          onChange={(e) => setMax(e.target.value)}
          className="h-9 w-full min-w-0 rounded-lg border border-line px-2.5 text-[13px] outline-none focus:border-brand"
        />
        <button type="submit" className="h-9 shrink-0 rounded-lg bg-brand px-3 text-[12.5px] font-bold text-white">
          Go
        </button>
      </form>
    </div>
  );
}
