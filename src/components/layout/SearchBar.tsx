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
 * The placeholder is a prop because the same box searches different things
 * depending on the page it is on: products on the home page, categories on the
 * category index. What it actually filters is decided by whichever component
 * reads the shared query, not here. */
export default function SearchBar({
  placeholder = "Search for products, brands and more...",
}: {
  placeholder?: string;
}) {
  const { query, setQuery } = useProductSearch();

  return (
    <form
      role="search"
      onSubmit={(event) => event.preventDefault()}
      className="flex h-9 flex-1 items-center gap-2 rounded-full bg-white pl-3 pr-1 shadow-[0_2px_8px_rgba(0,0,0,0.12)]"
    >
      <Search className="h-4 w-4 shrink-0 text-ink-muted" strokeWidth={2.25} />
      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="min-w-0 flex-1 bg-transparent text-[11px] text-ink placeholder:text-ink-muted/80 outline-none [&::-webkit-search-cancel-button]:hidden"
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
