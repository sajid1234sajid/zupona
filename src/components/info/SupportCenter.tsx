"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Search, X } from "lucide-react";

export interface ResolvedTopic {
  id: string;
  title: string;
  items: { q: string; a: string }[];
}

/** One edit apart: a slip of the finger ("delivry", "retrun") still finds
 * the answer. Only for words of four letters or more, where a single typo is
 * unlikely to land on a different real word. */
function nearlyEqual(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++;
      j++;
      continue;
    }
    if (++edits > 1) return false;
    if (a.length > b.length) i++;
    else if (b.length > a.length) j++;
    else if (a[i + 1] === b[j] && a[i] === b[j + 1]) {
      // a swapped pair counts as one slip
      i += 2;
      j += 2;
    } else {
      i++;
      j++;
    }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

const words = (text: string) => text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];

/** How well an entry answers the query: every word typed must appear, as the
 * start of a word or one typo away from one. The question counts double. */
function score(query: string[], q: string, a: string): number {
  const qWords = words(q);
  const aWords = words(a);
  let total = 0;
  for (const term of query) {
    const hit = (w: string) => w.startsWith(term) || (term.length >= 4 && nearlyEqual(term, w));
    if (qWords.some(hit)) total += 2;
    else if (aWords.some(hit)) total += 1;
    else return 0;
  }
  return total;
}

/** The searchable list of questions behind /support.
 *
 * Everything is in the page already -- a few dozen short answers -- so the
 * search runs in the browser as the shopper types, with no request. With no
 * query it is a topic list beside the questions of the chosen topic; with
 * one, it is the matching questions from every topic, best first. */
export default function SupportCenter({ topics }: { topics: ResolvedTopic[] }) {
  const [query, setQuery] = useState("");
  const [topicId, setTopicId] = useState(topics[0]?.id ?? "");
  const [open, setOpen] = useState<string | null>(null);

  const terms = useMemo(() => words(query), [query]);

  const results = useMemo(() => {
    if (terms.length === 0) return null;
    return topics
      .flatMap((topic) => topic.items.map((item) => ({ ...item, topic: topic.title })))
      .map((item) => ({ item, s: score(terms, item.q, item.a) }))
      .filter((entry) => entry.s > 0)
      .sort((x, y) => y.s - x.s)
      .map((entry) => entry.item);
  }, [terms, topics]);

  const topic = topics.find((t) => t.id === topicId) ?? topics[0];
  const shown = results ?? topic.items.map((item) => ({ ...item, topic: topic.title }));

  return (
    <div>
      <div className="rounded-2xl bg-[linear-gradient(105deg,var(--color-brand-dark)_0%,var(--color-brand)_100%)] p-4 tab:p-7">
        <label htmlFor="help-search" className="block text-[15px] font-bold text-white tab:text-xl">
          Hi, how can we help you?
        </label>
        <div className="relative mt-3">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
          <input
            id="help-search"
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setOpen(null);
            }}
            placeholder="Search: delivery fee, return, cancel order…"
            autoComplete="off"
            className="h-12 w-full rounded-full border-0 bg-white pl-10 pr-10 text-[14px] text-ink outline-none ring-2 ring-transparent placeholder:text-ink-faint focus:ring-brand-leaf"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="absolute right-3 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full text-ink-muted hover:bg-brand-mist"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      </div>

      <div className="mt-5 tab:grid tab:grid-cols-[200px_1fr] tab:gap-6">
        {/* Topics: a scrolling chip row on a phone, a list on a laptop. */}
        <div
          role="tablist"
          aria-label="Help topics"
          className={`-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] tab:mx-0 tab:flex-col tab:gap-0.5 tab:px-0 ${results ? "opacity-50" : ""}`}
        >
          {topics.map((t) => {
            const active = !results && t.id === topic.id;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => {
                  setTopicId(t.id);
                  setQuery("");
                  setOpen(null);
                }}
                className={`shrink-0 whitespace-nowrap rounded-full px-3.5 py-2 text-left text-[13px] font-semibold tab:rounded-lg ${
                  active
                    ? "bg-brand text-white tab:bg-brand-tint tab:text-brand-dark"
                    : "bg-brand-mist text-ink-muted hover:text-brand-darkest tab:bg-transparent tab:hover:bg-brand-mist"
                }`}
              >
                {t.title}
              </button>
            );
          })}
        </div>

        <div className="mt-3 tab:mt-0">
          {results ? (
            <p className="mb-2 text-[12.5px] text-ink-muted">
              {results.length === 0
                ? `Nothing matches “${query.trim()}”. Try another word, or contact us below.`
                : `${results.length} answer${results.length === 1 ? "" : "s"} for “${query.trim()}”`}
            </p>
          ) : (
            <h2 className="mb-2 text-[15px] font-bold text-heading">{topic.title}</h2>
          )}
          <ul className="divide-y divide-line-soft overflow-hidden rounded-2xl border border-line-soft">
            {shown.map((item) => {
              const key = `${item.topic}:${item.q}`;
              const expanded = open === key || (results !== null && results.length === 1);
              return (
                <li key={key}>
                  <button
                    type="button"
                    aria-expanded={expanded}
                    onClick={() => setOpen(expanded ? null : key)}
                    className="flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-brand-mist"
                  >
                    <span className="flex-1">
                      {results ? (
                        <span className="block text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
                          {item.topic}
                        </span>
                      ) : null}
                      <span className="block text-[13.5px] font-semibold text-heading tab:text-[14.5px]">
                        {item.q}
                      </span>
                    </span>
                    <ChevronDown
                      className={`h-4 w-4 shrink-0 text-ink-muted transition-transform ${expanded ? "rotate-180" : ""}`}
                    />
                  </button>
                  {expanded ? (
                    <p className="px-4 pb-4 text-[13px] leading-relaxed text-ink-slate tab:text-[14px]">
                      {item.a}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}
