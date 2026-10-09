/** What has shipped lately, for the dashboard's "What's new" card.
 *
 * A push to `main` is a release here, so the commit list is the release list.
 * It is read from the repository's public Atom feed rather than the GitHub
 * API: the API allows 60 unauthenticated calls an hour per address, and a
 * Worker shares its outbound addresses with everyone else's, so it would run
 * dry for reasons that have nothing to do with this shop. The feed has no such
 * budget and needs no token.
 *
 * Kept in KV for ten minutes so the dashboard never waits on GitHub twice, and
 * given a short timeout so a slow or unreachable GitHub costs the card, never
 * the page. A failed read is not cached: the next visit simply tries again. */

import { getCache } from "@/lib/db";

const FEED_URL = "https://github.com/sajid1234sajid/zupona/commits/main.atom";
const CACHE_KEY = "releases:main";
const TTL_SECONDS = 600;
const TIMEOUT_MS = 2500;

export interface Release {
  title: string;
  /** ISO time the commit was made. */
  date: string;
  url: string;
}

function decode(text: string): string {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

function parseFeed(xml: string): Release[] {
  const releases: Release[] = [];
  for (const [, entry] of xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)) {
    const title = decode(entry.match(/<title>([\s\S]*?)<\/title>/)?.[1]?.trim() ?? "");
    const date = entry.match(/<updated>([^<]+)<\/updated>/)?.[1] ?? "";
    const url = entry.match(/<link[^>]*href="([^"]+)"/)?.[1] ?? "";
    // A merge only repeats the work of the commits under it.
    if (!title || !date || /^Merge (pull request|branch)/.test(title)) continue;
    releases.push({ title, date, url });
  }
  return releases;
}

export async function getRecentReleases(limit = 5): Promise<Release[]> {
  let kv: KVNamespace | null = null;
  try {
    kv = await getCache();
    const hit = await kv.get<Release[]>(CACHE_KEY, "json");
    if (hit) return hit.slice(0, limit);
  } catch {
    // No cache: fall through to the feed.
  }

  try {
    const response = await fetch(FEED_URL, {
      headers: { "user-agent": "zupona-admin", accept: "application/atom+xml" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) return [];
    const releases = parseFeed(await response.text());
    if (releases.length > 0 && kv) {
      await kv.put(CACHE_KEY, JSON.stringify(releases), { expirationTtl: TTL_SECONDS }).catch(() => {});
    }
    return releases.slice(0, limit);
  } catch {
    return [];
  }
}
