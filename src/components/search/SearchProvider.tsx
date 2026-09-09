"use client";

import { createContext, useContext, useMemo, useState } from "react";

/** Shared search text for the storefront shell.
 *
 * The search box lives in the header and the results render further down the
 * page in the product grid, so the text they share cannot belong to either of
 * them. Keeping it in context means the header stays a small presentational
 * component and the grid does not have to know a search box exists. */
interface SearchState {
  query: string;
  setQuery: (value: string) => void;
}

const SearchContext = createContext<SearchState | null>(null);

export function useProductSearch(): SearchState {
  const value = useContext(SearchContext);
  if (!value) {
    throw new Error("useProductSearch must be used inside <SearchProvider>");
  }
  return value;
}

export default function SearchProvider({ children }: { children: React.ReactNode }) {
  const [query, setQuery] = useState("");
  const value = useMemo(() => ({ query, setQuery }), [query]);

  return <SearchContext.Provider value={value}>{children}</SearchContext.Provider>;
}
