"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { ArrowLeft, Clock, Search, Star, X } from "lucide-react";
import Image from "@/components/ui/StoreImage";
import { formatPrice } from "@/lib/format";

/** One search result, as `/api/search` sends it. */
export interface SearchHit {
  id: string;
  name: string;
  image: string;
  price: number;
  oldPrice: number;
  discountPercent: number;
  rating: number;
  reviews: number;
  inStock: boolean;
}

/** An answer, tagged with the query it answers. */
interface Answer {
  query: string;
  hits: SearchHit[];
  total: number;
  failed: boolean;
}

/** The search sheet the header's search control opens.
 *
 * Every page outside the home page used to have a search icon that did
 * nothing, or a pill that navigated to the home page and left the shopper to
 * find the box for themselves. This is the search itself: it opens over
 * whatever page is showing, takes the keyboard straight away, and lists real
 * products that go to their own page when tapped.
 *
 * Results come from `/api/search`, which filters the cached catalog on the
 * server and sends back only the matches. Typing is debounced and each new
 * request aborts the one before it, so a fast typist on mobile data makes one
 * request rather than one per letter. What is on screen is derived from the
 * query rather than stored beside it -- an answer only shows while it is the
 * answer to what is typed now -- which is what makes a slow reply for an
 * earlier word unable to appear under a later one.
 *
 * Answers already seen are kept for the life of the sheet, so backspacing
 * through a word costs nothing.
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
  const [text, setText] = useState("");
  const [answer, setAnswer] = useState<Answer | null>(null);
  // Read once, on mount: the sheet is only ever mounted in the browser, after
  // a tap, so there is no server render for this to disagree with.
  const [recent, setRecent] = useState<string[]>(readRecent);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  // Answers already fetched this session, keyed by the trimmed query.
  const answers = useRef(new Map<string, Answer>());

  const query = text.trim();
  // An answer belongs to one query. Anything else is out of date, and showing
  // it under a newer query would be showing the wrong results.
  const result = answer && answer.query === query ? answer : null;

  // Focus the field and pin the page behind it. A sheet over a page that still
  // scrolls underneath feels broken on a phone, the same reason the menu
  // drawer does this.
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

  useEffect(() => {
    if (!open || query.length === 0) return;

    const cached = answers.current.get(query);
    const controller = new AbortController();

    // Two waits in one timer. A query answered before is due immediately and
    // only goes through the timer so that the state change lands in a
    // callback rather than in the body of this effect. A new one waits long
    // enough that typing a word is one request, and short enough that a pause
    // feels like an answer rather than a wait.
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
        const body = (await response.json()) as { products?: SearchHit[]; total?: number };
        const products = body.products ?? [];
        const fresh: Answer = {
          query,
          hits: products,
          total: body.total ?? products.length,
          failed: false,
        };
        answers.current.set(query, fresh);
        setAnswer(fresh);
      } catch (error) {
        // An aborted request is this effect being replaced by the next
        // keystroke, not a failure -- leaving the state alone is correct, and
        // a failure is not cached so the next keystroke can retry.
        if ((error as Error)?.name === "AbortError") return;
        setAnswer({ query, hits: [], total: 0, failed: true });
      }
    }, cached ? 0 : 220);

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

  // Portalled to the body: the headers that own this state are sticky and
  // z-indexed, and a sheet left inside one is trapped in its stacking context
  // with the bottom tab bar painting over it.
  return createPortal(
    <div
      className={`fixed inset-0 z-50 flex flex-col bg-white transition-opacity duration-150 ease-out motion-reduce:transition-none ${
        open ? "opacity-100" : "pointer-events-none opacity-0"
      }`}
      role="dialog"
      aria-modal="true"
      aria-label="Search products"
      // Closed, the sheet stays mounted so it can open again without being
      // rebuilt. `inert` is what keeps that mounted copy out of the way: no
      // tab stops inside it, and nothing in it read out by a screen reader.
      inert={!open}
      onKeyDown={(event) => {
        if (event.key === "Escape") onClose();
      }}
    >
      <div className="bg-brand-dark px-2.5 pb-2.5 pt-[calc(env(safe-area-inset-top)+0.5rem)] text-white">
        <div className="mx-auto flex w-full max-w-shell items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close search"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <ArrowLeft className="h-5 w-5" strokeWidth={2.25} />
          </button>

          <form
            role="search"
            onSubmit={(event) => {
              event.preventDefault();
              remember(query);
              // The results are already on screen, so the only thing left for
              // the enter key to do is put the keyboard away.
              inputRef.current?.blur();
            }}
            className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-full bg-white pl-3 pr-1"
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
              className="min-w-0 flex-1 bg-transparent text-[13px] text-ink outline-none placeholder:text-ink-faint [&::-webkit-search-cancel-button]:hidden"
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
          </form>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto overscroll-contain">
        <div className="mx-auto w-full max-w-shell">
          {query.length === 0 ? (
            <RecentSearches
              terms={recent}
              onPick={(term) => {
                setText(term);
                inputRef.current?.focus();
              }}
              onClear={() => {
                setRecent([]);
                writeRecent([]);
              }}
            />
          ) : result === null ? (
            <Hint>Searching...</Hint>
          ) : result.failed ? (
            <Hint>Search is unavailable right now. Check your connection and try again.</Hint>
          ) : result.hits.length === 0 ? (
            <Hint>No products match &ldquo;{query}&rdquo;.</Hint>
          ) : (
            <>
              <p className="px-4 pb-1 pt-3 text-[11px] font-semibold text-ink-muted">
                {result.total} {result.total === 1 ? "product" : "products"} for &ldquo;{query}
                &rdquo;
              </p>
              <ul className="pb-[env(safe-area-inset-bottom)]">
                {result.hits.map((hit) => (
                  <li key={hit.id}>
                    <Link
                      // A list of results is exactly where prefetching hurts:
                      // thirty RSC round trips for pages nobody has asked for,
                      // competing with the one tap that actually follows.
                      prefetch={false}
                      href={`/product/${hit.id}`}
                      onClick={() => {
                        remember(query);
                        onClose();
                      }}
                      className="flex items-center gap-3 border-b border-line-soft px-4 py-2.5 active:bg-brand-mist"
                    >
                      <span className="relative block h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-brand-mist">
                        <Image
                          src={hit.image}
                          alt={hit.name}
                          fill
                          sizes="56px"
                          className="h-full w-full object-cover"
                        />
                      </span>

                      <span className="min-w-0 flex-1">
                        <span className="line-clamp-2 block text-[12.5px] font-semibold text-ink">
                          {hit.name}
                        </span>
                        <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                          <span className="text-[13px] font-extrabold text-brand-darkest">
                            {formatPrice(hit.price)}
                          </span>
                          {hit.oldPrice > hit.price && (
                            <span className="text-[10.5px] text-ink-faint line-through">
                              {formatPrice(hit.oldPrice)}
                            </span>
                          )}
                          {hit.discountPercent > 0 && (
                            <span className="text-[10.5px] font-bold text-accent-red">
                              -{hit.discountPercent}%
                            </span>
                          )}
                        </span>
                        <span className="mt-0.5 flex items-center gap-1 text-[10px] text-ink-muted">
                          <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                          {hit.rating.toFixed(1)}
                          <span>({hit.reviews})</span>
                          {!hit.inStock && (
                            <span className="ml-1 font-semibold text-accent-red">Out of stock</span>
                          )}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

function Hint({ children }: { children: React.ReactNode }) {
  return <p className="px-4 py-10 text-center text-[12.5px] text-ink-muted">{children}</p>;
}

function RecentSearches({
  terms,
  onPick,
  onClear,
}: {
  terms: string[];
  onPick: (term: string) => void;
  onClear: () => void;
}) {
  if (terms.length === 0) {
    return <Hint>Type to search the whole shop.</Hint>;
  }

  return (
    <div className="px-4 pt-3">
      <div className="flex items-center justify-between">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.12em] text-ink-muted">
          Recent searches
        </h2>
        <button
          type="button"
          onClick={onClear}
          className="text-[11px] font-semibold text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          Clear
        </button>
      </div>

      <ul className="mt-1">
        {terms.map((term) => (
          <li key={term}>
            <button
              type="button"
              onClick={() => onPick(term)}
              className="flex min-h-11 w-full items-center gap-2.5 text-left text-[13px] text-ink"
            >
              <Clock className="h-4 w-4 shrink-0 text-ink-faint" strokeWidth={2} />
              <span className="truncate">{term}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Recent searches                                                            */
/* -------------------------------------------------------------------------- */

const RECENT_KEY = "zupona.recentSearches";
const RECENT_LIMIT = 6;

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
