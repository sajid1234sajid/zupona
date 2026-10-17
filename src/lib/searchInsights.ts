/** What shoppers search for: the log, the "Popular right now" list, and the
 * admin report of searches that found nothing.
 *
 * Every search made on the results page is written to `search_queries` with
 * how many products it found. The searches that found nothing are the most
 * useful rows in it: each is a customer telling the shop what it does not
 * stock, or which word (often Bangla or Banglish) to add to a product's tags
 * so it is found next time. */

import { getDB } from "@/lib/db";
import { cached } from "@/lib/cache";
import { normalize } from "@/lib/productSearch";

/** Records one search. Never throws: a search page must not fail because the
 * log could not be written. */
export async function logSearch(query: string, resultCount: number, userId: string | null) {
  const text = normalize(query).slice(0, 100);
  if (!text) return;
  try {
    const db = await getDB();
    await db
      .prepare("INSERT INTO search_queries (id, user_id, query, results_count) VALUES (?, ?, ?, ?)")
      .bind(crypto.randomUUID(), userId, text, resultCount)
      .run();
  } catch (error) {
    console.error("search log failed", error);
  }
}

/** The site_settings key holding the admin's own list, one query per line. */
export const POPULAR_SEARCHES_SETTING = "popular_searches";

/** "Popular right now": the admin's list when one is set, otherwise the
 * queries searched most in the last seven days that found something.
 * Cached for ten minutes -- it is the same for everyone. */
export async function getPopularSearches(limit = 10): Promise<string[]> {
  return cached(
    `search:popular:${limit}`,
    async () => {
      const db = await getDB();
      const [override, top] = await Promise.all([
        db
          .prepare("SELECT value FROM site_settings WHERE key = ?")
          .bind(POPULAR_SEARCHES_SETTING)
          .first<{ value: string }>(),
        db
          .prepare(
            `SELECT query, COUNT(*) AS n FROM search_queries
             WHERE results_count > 0 AND created_at >= datetime('now', '-7 days')
             GROUP BY query ORDER BY n DESC LIMIT ?`
          )
          .bind(limit)
          .all<{ query: string; n: number }>(),
      ]);
      const manual = (override?.value ?? "")
        .split(/[\n,]/)
        .map((line) => line.trim())
        .filter(Boolean);
      if (manual.length > 0) return manual.slice(0, limit);
      return top.results.map((row) => row.query);
    },
    600
  );
}

export interface SearchReportRow {
  query: string;
  searches: number;
  lastResults: number;
  lastSearchedAt: string;
}

/** For Admin > Search insights: the most searched queries over `days`, and
 * those that found nothing. */
export async function searchReport(days = 30, limit = 50) {
  const db = await getDB();
  const since = `-${Math.max(1, Math.floor(days))} days`;
  const [top, zero, totals] = await Promise.all([
    db
      .prepare(
        `SELECT query, COUNT(*) AS searches, MAX(created_at) AS lastSearchedAt,
                (SELECT results_count FROM search_queries s2 WHERE s2.query = s.query
                 ORDER BY created_at DESC LIMIT 1) AS lastResults
         FROM search_queries s
         WHERE created_at >= datetime('now', ?)
         GROUP BY query ORDER BY searches DESC LIMIT ?`
      )
      .bind(since, limit)
      .all<SearchReportRow>(),
    db
      .prepare(
        `SELECT query, COUNT(*) AS searches, MAX(created_at) AS lastSearchedAt, 0 AS lastResults
         FROM search_queries
         WHERE created_at >= datetime('now', ?) AND results_count = 0
         GROUP BY query ORDER BY searches DESC, lastSearchedAt DESC LIMIT ?`
      )
      .bind(since, limit)
      .all<SearchReportRow>(),
    db
      .prepare(
        `SELECT COUNT(*) AS searches,
                SUM(CASE WHEN results_count = 0 THEN 1 ELSE 0 END) AS zero
         FROM search_queries WHERE created_at >= datetime('now', ?)`
      )
      .bind(since)
      .first<{ searches: number; zero: number | null }>(),
  ]);
  return {
    top: top.results,
    zero: zero.results,
    searches: totals?.searches ?? 0,
    zeroSearches: totals?.zero ?? 0,
  };
}
