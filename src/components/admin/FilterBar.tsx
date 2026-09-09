"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Search } from "lucide-react";

export interface SelectFilter {
  name: string;
  /** Shown as the "no filter" option, e.g. "All Categories". */
  allLabel: string;
  options: { value: string; label: string }[];
}

interface FilterBarProps {
  base: string;
  searchPlaceholder?: string;
  selects?: SelectFilter[];
  /** Extra controls rendered at the end of the row (export buttons, etc). */
  children?: ReactNode;
}

/** The toolbar above every admin table.
 *
 * Filter state lives in the URL, not in component state, so a filtered view can
 * be bookmarked, shared and reloaded. Any change drops `page`, because landing
 * on page 4 of a result set that now has one page is a dead end.
 *
 * The text box waits for a pause in typing rather than navigating on every
 * keystroke -- each navigation is a server round trip to D1. */
export default function FilterBar({
  base,
  searchPlaceholder = "Search…",
  selects = [],
  children,
}: FilterBarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlSearch = searchParams.get("search") ?? "";
  const [term, setTerm] = useState(urlSearch);

  // Keeps the box in step when the URL changes from elsewhere -- a "clear
  // filters" link, or the browser's back button. Adjusting during render
  // rather than in an effect means the input never paints the stale value
  // first and then correct itself.
  const [syncedWith, setSyncedWith] = useState(urlSearch);
  if (syncedWith !== urlSearch) {
    setSyncedWith(urlSearch);
    setTerm(urlSearch);
  }

  const navigate = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams.toString());
    if (value && value !== "all") next.set(key, value);
    else next.delete(key);
    next.delete("page");
    const query = next.toString();
    router.push(query ? `${base}?${query}` : base);
  };

  useEffect(() => {
    if (term === urlSearch) return;
    const timer = setTimeout(() => navigate("search", term.trim()), 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [term]);

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2.5">
      <div className="relative min-w-[200px] flex-1">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
        <input
          type="search"
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          placeholder={searchPlaceholder}
          aria-label={searchPlaceholder}
          className="h-10 w-full rounded-xl border border-neutral-200 bg-white pl-10 pr-3.5 text-sm text-neutral-800 outline-none transition placeholder:text-neutral-400 focus:border-brand focus:ring-2 focus:ring-brand/15"
        />
      </div>

      {selects.map((select) => (
        <select
          key={select.name}
          value={searchParams.get(select.name) ?? "all"}
          onChange={(event) => navigate(select.name, event.target.value)}
          aria-label={select.allLabel}
          className="h-10 rounded-xl border border-neutral-200 bg-white px-3 text-sm text-neutral-700 outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/15"
        >
          <option value="all">{select.allLabel}</option>
          {select.options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ))}

      {children}
    </div>
  );
}
