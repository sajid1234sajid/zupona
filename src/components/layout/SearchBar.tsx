"use client";

import { Search } from "lucide-react";
import { useProductSearch } from "@/components/search/SearchProvider";

/** The storefront search box.
 *
 * The text is held in `SearchProvider` rather than here, because the results
 * appear in the product grid further down the page. Typing filters live, so
 * submitting has nothing left to do -- the button is kept because the design
 * has one, and it re-focuses the field rather than reloading the page.
 *
 * `size="large"` is the laptop header's version: the same box on a light
 * header instead of the green one, at a readable size. */
export default function SearchBar({ size = "compact" }: { size?: "compact" | "large" }) {
  const { query, setQuery } = useProductSearch();
  const large = size === "large";

  return (
    <form
      role="search"
      onSubmit={(event) => event.preventDefault()}
      className={
        large
          ? "flex h-11 min-w-0 flex-1 items-center gap-2 rounded-full bg-brand-mist pl-4 pr-1.5 ring-1 ring-line focus-within:ring-2 focus-within:ring-brand"
          : "flex h-9 min-w-0 flex-1 items-center gap-2 rounded-full bg-white pl-3 pr-1 shadow-[0_2px_8px_rgba(0,0,0,0.12)]"
      }
    >
      <Search className="h-4 w-4 shrink-0 text-ink-muted" strokeWidth={2.25} />
      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search for products, brands and more..."
        aria-label="Search for products, brands and more"
        className={`min-w-0 flex-1 bg-transparent ${large ? "text-sm" : "text-[11px]"} text-ink placeholder:text-ink-faint outline-none [&::-webkit-search-cancel-button]:hidden`}
      />
      <button
        type="submit"
        aria-label="Search"
        className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand text-white"
      >
        <Search className="h-3.5 w-3.5" strokeWidth={2.5} />
      </button>
    </form>
  );
}
