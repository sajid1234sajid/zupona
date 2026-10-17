"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ChevronRight, Clock, LayoutGrid, Search, Star, TrendingUp, X } from "lucide-react";
import Image from "@/components/ui/StoreImage";
import { formatPrice } from "@/lib/format";

/** One search result, as `/api/search` sends it. */
export interface SearchHit {
  id: string;
  slug: string;
  name: string;
  image: string;
  price: number;
  oldPrice: number;
  discountPercent: number;
  rating: number;
  reviews: number;
  inStock: boolean;
}

interface CategoryHit {
  id: string;
  name: string;
  href: string;
}

/** An answer, tagged with the query it answers. */
interface Answer {
  query: string;
  hits: SearchHit[];
  total: number;
  suggestions: string[];
  categories: CategoryHit[];
  corrected: string | null;
  failed: boolean;
}

interface Popular {
  q: string;
  thumb: string | null;
}

/** Products shown under the suggestions; the rest are a tap away on /search. */
const PRODUCT_ROWS = 4;

/** The search panel the header's search control opens.
 *
 * On a phone it covers the page; from the `tab` breakpoint up it is a panel
 * hanging under a search field at the top, over a dimmed page, the way large
 * shops do it on a laptop.
 *
 * Empty, it offers the shopper's recent searches and what is popular right
 * now. As they type it offers ways to finish the words (typo-tolerant, so
 * "shrt" offers "shirt"), the first few matching products and any matching
 * departments; Enter, or "See all", opens the full results page with its
 * filters. The arrow keys move through the suggestions and products.
 *
 * Results come from `/api/search`, which filters the cached catalog on the
 * server and sends back only the matches. Typing is debounced and each new
 * request aborts the one before it, so a fast typist on mobile data makes one
 * request rather than one per letter. What is on screen is derived from the
 * query rather than stored beside it -- an answer only shows while it is the
 * answer to what is typed now -- which is what makes a slow reply for an
 * earlier word unable to appear under a later one. Answers already seen are
 * kept for the life of the sheet, so backspacing through a word costs nothing.
 *
 * Mounted by its launcher only once the shopper has actually asked for it,
 * and kept mounted afterwards so opening it again is immediate. */
export default function SearchSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [answer, setAnswer] = useState<Answer | null>(null);
  // Read once, on mount: the sheet is only ever mounted in the browser, after
  // a tap, so there is no server render for this to disagree with.
  const [recent, setRecent] = useState<string[]>(readRecent);
  const [popular, setPopular] = useState<Popular[] | null>(null);
  const [active, setActive] = useState(-1);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const answers = useRef(new Map<string, Answer>());

  const query = text.trim();
  const result = answer && answer.query === query ? answer : null;

  // Focus the field and pin the page behind it.
  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    returnFocusRef.current = document.activeElement as HTMLElement | null;
    // A frame late: focusing a field inside a sheet that has not painted yet
    // leaves the keyboard closed on Android.
    const frame = requestAnimationFrame(() => inputRef.current?.focus());

    return () => {
      document.body.style.overflow = previousOverflow;
      cancelAnimationFrame(frame);
      returnFocusRef.current?.focus();
    };
  }, [open]);

  // "Popular right now", fetched the first time the sheet opens.
  useEffect(() => {
    if (!open || popular !== null) return;
    const controller = new AbortController();
    fetch("/api/search/popular", { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : { queries: [] }))
      .then((body) => setPopular((body as { queries?: Popular[] }).queries ?? []))
      .catch((error) => {
        if ((error as Error)?.name !== "AbortError") setPopular([]);
      });
    return () => controller.abort();
  }, [open, popular]);

  useEffect(() => {
    // Two characters before asking: one letter matches half the catalog.
    if (!open || query.length < 2) return;

    const cached = answers.current.get(query);
    const controller = new AbortController();

    const timer = setTimeout(async () => {
      if (cached) {
        setAnswer(cached);
        return;
      }

      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`Search failed: ${response.status}`);
        const body = (await response.json()) as Partial<Answer> & {
          products?: SearchHit[];
        };
        const products = body.products ?? [];
        const fresh: Answer = {
          query,
          hits: products,
          total: body.total ?? products.length,
          suggestions: body.suggestions ?? [],
          categories: body.categories ?? [],
          corrected: body.corrected ?? null,
          failed: false,
        };
        answers.current.set(query, fresh);
        setAnswer(fresh);
      } catch (error) {
        // An aborted request is this effect being replaced by the next
        // keystroke, not a failure; a failure is not cached so the next
        // keystroke can retry.
        if ((error as Error)?.name === "AbortError") return;
        setAnswer({
          query,
          hits: [],
          total: 0,
          suggestions: [],
          categories: [],
          corrected: null,
          failed: true,
        });
      }
    }, cached ? 0 : 150);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [open, query]);

  function remember(term: string) {
    const trimmed = term.trim();
    if (!trimmed) return;
    const next = [trimmed, ...recent.filter((item) => item !== trimmed)].slice(0, RECENT_LIMIT);
    setRecent(next);
    writeRecent(next);
  }

  function forget(term: string) {
    const next = recent.filter((item) => item !== term);
    setRecent(next);
    writeRecent(next);
  }

  function searchFor(term: string) {
    const trimmed = term.trim();
    if (!trimmed) return;
    remember(trimmed);
    onClose();
    router.push(`/search?q=${encodeURIComponent(trimmed)}`);
  }

  // What the arrow keys move through: the suggestions, then the products.
  const navigable = useMemo((): { href: string; term?: string }[] => {
    if (!result || result.failed) return [];
    return [
      ...result.suggestions.map((s) => ({ href: `/search?q=${encodeURIComponent(s)}`, term: s })),
      ...result.hits.slice(0, PRODUCT_ROWS).map((hit) => ({ href: `/products/${hit.slug}` })),
    ];
  }, [result]);

  // A new list starts with nothing highlighted.
  const [highlightFor, setHighlightFor] = useState<Answer | null>(null);
  if (highlightFor !== result) {
    setHighlightFor(result);
    setActive(-1);
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === "Escape") {
      onClose();
      return;
    }
    if (navigable.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((i) => (i + 1) % navigable.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((i) => (i <= 0 ? navigable.length - 1 : i - 1));
    }
  }

  const suggestionCount = result?.suggestions.length ?? 0;

  // Portalled to the body: the headers that own this state are sticky and
  // z-indexed, and a sheet left inside one is trapped in its stacking context
  // with the bottom tab bar painting over it.
  return createPortal(
    <div
      className={`fixed inset-0 z-50 flex flex-col bg-white transition-opacity duration-150 ease-out motion-reduce:transition-none tab:bg-heading/40 ${
        open ? "opacity-100" : "pointer-events-none opacity-0"
      }`}
      role="dialog"
      aria-modal="true"
      aria-label="Search products"
      // Closed, the sheet stays mounted so it can open again without being
      // rebuilt. `inert` keeps that mounted copy out of the way.
      inert={!open}
      onKeyDown={onKeyDown}
      onMouseDown={(event) => {
        // On a laptop, a click on the dimmed page outside the panel closes it.
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="bg-brand-dark px-2.5 pb-2.5 pt-[calc(env(safe-area-inset-top)+0.5rem)] text-white tab:bg-white tab:px-6 tab:py-3 tab:shadow-sm">
        <div className="mx-auto flex w-full max-w-shell items-center gap-2 tab:max-w-[760px]">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close search"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white tab:text-ink tab:hover:bg-brand-mist"
          >
            <ArrowLeft className="h-5 w-5" strokeWidth={2.25} />
          </button>

          <form
            role="search"
            onSubmit={(event) => {
              event.preventDefault();
              const pick = active >= 0 ? navigable[active] : null;
              if (pick) {
                if (pick.term) remember(pick.term);
                else remember(query);
                onClose();
                router.push(pick.href);
                return;
              }
              searchFor(query);
            }}
            className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-full bg-white pl-3 pr-1 tab:h-11 tab:bg-brand-mist tab:ring-2 tab:ring-brand"
          >
            <Search className="h-4 w-4 shrink-0 text-ink-muted" strokeWidth={2.25} />
            <input
              ref={inputRef}
              type="search"
              value={text}
              onChange={(event) => setText(event.target.value)}
              enterKeyHint="search"
              autoComplete="off"
              placeholder="Search for products, brands and more..."
              aria-label="Search for products, brands and more"
              aria-activedescendant={active >= 0 ? `search-opt-${active}` : undefined}
              className="min-w-0 flex-1 bg-transparent text-[13px] text-ink outline-none placeholder:text-ink-faint tab:text-sm [&::-webkit-search-cancel-button]:hidden"
            />
            {text.length > 0 && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => {
                  setText("");
                  inputRef.current?.focus();
                }}
                className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-ink-muted"
              >
                <X className="h-4 w-4" strokeWidth={2.5} />
              </button>
            )}
            <button
              type="submit"
              aria-label="Search"
              className="hidden h-8 shrink-0 items-center rounded-full bg-brand px-4 text-[13px] font-bold text-white tab:flex"
            >
              Search
            </button>
          </form>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto overscroll-contain tab:flex-none tab:overflow-visible tab:px-6">
        <div className="mx-auto w-full max-w-shell pb-[env(safe-area-inset-bottom)] tab:mt-2 tab:max-h-[70vh] tab:max-w-[760px] tab:overflow-y-auto tab:rounded-2xl tab:bg-white tab:pb-2 tab:shadow-[0_18px_40px_-16px_rgba(0,35,28,0.45)]">
          {query.length < 2 ? (
            <>
              <RecentSearches
                terms={recent}
                onPick={searchFor}
                onRemove={forget}
                onClear={() => {
                  setRecent([]);
                  writeRecent([]);
                }}
              />
              <PopularSearches items={popular} onPick={searchFor} />
            </>
          ) : result === null ? (
            <Hint>Searching...</Hint>
          ) : result.failed ? (
            <Hint>Search is unavailable right now. Check your connection and try again.</Hint>
          ) : result.hits.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <p className="text-[13.5px] font-semibold text-ink">
                No products match &ldquo;{query}&rdquo;.
              </p>
              {popular && popular.length > 0 ? (
                <>
                  <p className="mt-1 text-[12px] text-ink-muted">Try:</p>
                  <div className="mt-2 flex flex-wrap justify-center gap-2">
                    {popular.slice(0, 6).map((item) => (
                      <button
                        key={item.q}
                        type="button"
                        onClick={() => searchFor(item.q)}
                        className="h-8 rounded-full border border-line px-3 text-[12.5px] font-semibold text-ink hover:border-brand"
                      >
                        {item.q}
                      </button>
                    ))}
                  </div>
                </>
              ) : null}
              <Link
                href="/categories"
                prefetch={false}
                onClick={onClose}
                className="mt-4 inline-flex h-10 items-center gap-2 rounded-full bg-brand px-4 text-[13px] font-bold text-white"
              >
                <LayoutGrid className="h-4 w-4" /> Browse categories
              </Link>
            </div>
          ) : (
            <>
              {result.corrected ? (
                <p className="px-4 pt-3 text-[12px] text-ink-muted">
                  No exact match for &ldquo;{query}&rdquo;. Showing results for{" "}
                  <strong className="text-ink">{result.corrected}</strong>
                </p>
              ) : null}

              {result.suggestions.length > 0 ? (
                <ul className="pt-1.5" role="listbox" aria-label="Suggestions">
                  {result.suggestions.map((suggestion, i) => (
                    <li key={suggestion} id={`search-opt-${i}`} role="option" aria-selected={active === i}>
                      <button
                        type="button"
                        onMouseEnter={() => setActive(i)}
                        onClick={() => searchFor(suggestion)}
                        className={`flex min-h-10 w-full items-center gap-3 px-4 text-left text-[13.5px] text-ink ${
                          active === i ? "bg-brand-mist" : ""
                        }`}
                      >
                        <Search className="h-4 w-4 shrink-0 text-ink-faint" strokeWidth={2} />
                        <Highlighted text={suggestion} query={result.corrected ?? query} />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}

              {result.categories.length > 0 ? (
                <div className="flex flex-wrap gap-2 px-4 pt-2">
                  {result.categories.map((category) => (
                    <Link
                      key={category.id}
                      href={category.href}
                      prefetch={false}
                      onClick={() => {
                        remember(query);
                        onClose();
                      }}
                      className="inline-flex h-8 items-center gap-1.5 rounded-full bg-brand-tint px-3 text-[12px] font-semibold text-brand-dark"
                    >
                      <LayoutGrid className="h-3.5 w-3.5" />
                      {category.name}
                    </Link>
                  ))}
                </div>
              ) : null}

              <p className="px-4 pb-1 pt-3 text-[11px] font-bold uppercase tracking-[0.1em] text-ink-muted">
                Products
              </p>
              <ul>
                {result.hits.slice(0, PRODUCT_ROWS).map((hit, i) => {
                  const index = suggestionCount + i;
                  return (
                    <li key={hit.id} id={`search-opt-${index}`} role="option" aria-selected={active === index}>
                      <Link
                        // A list of results is exactly where prefetching hurts.
                        prefetch={false}
                        href={`/products/${hit.slug}`}
                        onMouseEnter={() => setActive(index)}
                        onClick={() => {
                          remember(query);
                          onClose();
                        }}
                        className={`flex items-center gap-3 border-b border-line-soft px-4 py-2.5 active:bg-brand-mist ${
                          active === index ? "bg-brand-mist" : ""
                        }`}
                      >
                        <span className="relative block h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-brand-mist">
                          <Image src={hit.image} alt={hit.name} fill sizes="56px" className="h-full w-full object-cover" />
                        </span>

                        <span className="min-w-0 flex-1">
                          <span className="line-clamp-2 block text-[12.5px] font-semibold text-ink">{hit.name}</span>
                          <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                            <span className="text-[13px] font-extrabold text-price">{formatPrice(hit.price)}</span>
                            {hit.oldPrice > hit.price && (
                              <span className="text-[10.5px] text-price-was line-through">{formatPrice(hit.oldPrice)}</span>
                            )}
                            {hit.discountPercent > 0 && (
                              <span className="text-[10.5px] font-bold text-discount">-{hit.discountPercent}%</span>
                            )}
                          </span>
                          {/* A rating is only worth showing once someone has given one:
                              "★ 0.0 (0)" reads as a product nobody wants. */}
                          {hit.reviews > 0 || !hit.inStock ? (
                            <span className="mt-0.5 flex items-center gap-1 text-[10px] text-ink-muted">
                              {hit.reviews > 0 ? (
                                <>
                                  <Star className="h-3 w-3 fill-rating text-rating" />
                                  {hit.rating.toFixed(1)}
                                  <span>({hit.reviews})</span>
                                </>
                              ) : null}
                              {!hit.inStock && (
                                <span className="ml-1 font-semibold text-accent-red">Out of stock</span>
                              )}
                            </span>
                          ) : null}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
              <button
                type="button"
                onClick={() => searchFor(query)}
                className="flex w-full items-center justify-center gap-1 px-4 py-3 text-[13px] font-bold text-brand hover:bg-brand-mist"
              >
                See all {result.total} {result.total === 1 ? "result" : "results"}
                <ChevronRight className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

/** The suggestion with the part that was typed in bold. */
function Highlighted({ text, query }: { text: string; query: string }) {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  const parts = text.split(" ");
  return (
    <span className="truncate">
      {parts.map((word, i) => {
        const term = terms.find((t) => word.startsWith(t));
        return (
          <span key={i}>
            {i > 0 ? " " : ""}
            {term ? (
              <>
                <strong className="font-bold">{word.slice(0, term.length)}</strong>
                {word.slice(term.length)}
              </>
            ) : (
              word
            )}
          </span>
        );
      })}
    </span>
  );
}

function Hint({ children }: { children: React.ReactNode }) {
  return <p className="px-4 py-10 text-center text-[12.5px] text-ink-muted">{children}</p>;
}

function RecentSearches({
  terms,
  onPick,
  onRemove,
  onClear,
}: {
  terms: string[];
  onPick: (term: string) => void;
  onRemove: (term: string) => void;
  onClear: () => void;
}) {
  if (terms.length === 0) return null;

  return (
    <div className="px-4 pt-3">
      <div className="flex items-center justify-between">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.12em] text-ink-muted">Recent searches</h2>
        <button
          type="button"
          onClick={onClear}
          className="text-[11px] font-semibold text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          Clear all
        </button>
      </div>

      <ul className="mt-1">
        {terms.map((term) => (
          <li key={term} className="flex items-center">
            <button
              type="button"
              onClick={() => onPick(term)}
              className="flex min-h-11 flex-1 items-center gap-2.5 text-left text-[13px] text-ink"
            >
              <Clock className="h-4 w-4 shrink-0 text-ink-faint" strokeWidth={2} />
              <span className="truncate">{term}</span>
            </button>
            <button
              type="button"
              onClick={() => onRemove(term)}
              aria-label={`Remove ${term}`}
              className="grid h-9 w-9 place-items-center rounded-full text-ink-faint hover:bg-brand-mist"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PopularSearches({ items, onPick }: { items: Popular[] | null; onPick: (term: string) => void }) {
  if (items === null) return <Hint>Type to search the whole shop.</Hint>;
  if (items.length === 0) return <Hint>Type to search the whole shop.</Hint>;
  return (
    <div className="px-4 pb-4 pt-4">
      <h2 className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-ink-muted">
        <TrendingUp className="h-3.5 w-3.5 text-urgency" />
        Popular right now
      </h2>
      <div className="mt-2.5 flex flex-wrap gap-2">
        {items.map((item) => (
          <button
            key={item.q}
            type="button"
            onClick={() => onPick(item.q)}
            className="inline-flex h-9 items-center gap-2 rounded-full border border-line bg-white pl-1 pr-3.5 text-[12.5px] font-semibold text-ink hover:border-brand"
          >
            {item.thumb ? (
              <span className="relative block h-7 w-7 overflow-hidden rounded-full bg-brand-mist">
                <Image src={item.thumb} alt="" fill sizes="28px" className="object-cover" />
              </span>
            ) : null}
            {item.q}
          </button>
        ))}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Recent searches                                                            */
/* -------------------------------------------------------------------------- */

const RECENT_KEY = "zupona.recentSearches";
const RECENT_LIMIT = 8;

/** Storage can throw outright in a private window, and the stored value can be
 * anything an earlier version wrote, so both sides are defensive: a search box
 * must never be the thing that breaks a page. */
function readRecent(): string[] {
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string").slice(0, RECENT_LIMIT)
      : [];
  } catch {
    return [];
  }
}

function writeRecent(terms: string[]) {
  try {
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(terms));
  } catch {
    /* Storage is a convenience here; a refusal is not worth surfacing. */
  }
}
