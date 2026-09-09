/** Edge cache and rate limiting on the KV namespace bound as CACHE.
 *
 * D1 is a single-region database, so repeat reads from far-away visitors pay
 * the round trip every time. Wrapping hot, rarely-changing reads (homepage
 * catalog, category list) in KV keeps that traffic at the edge.
 *
 * KV is eventually consistent: writes take a moment to appear everywhere.
 * Never cache anything a user must see change immediately -- cart contents,
 * stock counts, order status. Catalog listings are the right shape for it. */

import { getCache } from "@/lib/db";

/** Namespaced so `invalidatePrefix` can clear one family of keys at a time. */
export const CacheKeys = {
  categories: () => "catalog:categories",
  featuredProducts: (limit: number) => `catalog:featured:${limit}`,
  product: (id: string) => `catalog:product:${id}`,
  productList: (fingerprint: string) => `catalog:list:${fingerprint}`,
  siteSettings: () => "settings:all",
} as const;

const DEFAULT_TTL_SECONDS = 300; // 5 minutes

/** Reads through the cache, falling back to `load` on a miss.
 *
 * A failure in KV is never allowed to take down a page: on any cache error the
 * loader still runs and its value is returned uncached. */
export async function cached<T>(
  key: string,
  load: () => Promise<T>,
  ttlSeconds: number = DEFAULT_TTL_SECONDS
): Promise<T> {
  let kv: KVNamespace;
  try {
    kv = await getCache();
  } catch {
    return load();
  }

  try {
    const hit = await kv.get(key, "json");
    if (hit !== null) return hit as T;
  } catch {
    // Fall through to the loader on a read error.
  }

  const value = await load();

  try {
    await kv.put(key, JSON.stringify(value), { expirationTtl: ttlSeconds });
  } catch {
    // A failed write only costs a cache miss next time.
  }

  return value;
}

export async function invalidate(key: string): Promise<void> {
  const kv = await getCache();
  await kv.delete(key);
}

/** Clears a whole key family, e.g. `invalidatePrefix("catalog:")` after a
 * product edit. KV lists 1000 keys per page, so this walks the cursor. */
export async function invalidatePrefix(prefix: string): Promise<number> {
  const kv = await getCache();
  let cursor: string | undefined;
  let deleted = 0;

  do {
    const listed = await kv.list({ prefix, cursor });
    await Promise.all(listed.keys.map((entry) => kv.delete(entry.name)));
    deleted += listed.keys.length;
    cursor = listed.list_complete ? undefined : listed.cursor;
  } while (cursor);

  return deleted;
}

/** Call after any catalog write so shoppers do not keep seeing stale listings. */
export async function invalidateCatalog(): Promise<void> {
  await invalidatePrefix("catalog:");
}

/* -------------------------------------------------------------------------- */
/* Rate limiting                                                              */
/* -------------------------------------------------------------------------- */

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  /** Seconds until the window resets. */
  retryAfter: number;
}

/** Fixed-window counter, keyed by whatever identifies the caller (IP, user id,
 * phone number). Used to throttle OTP sends and login attempts.
 *
 * KV's eventual consistency makes this approximate under a burst from several
 * regions at once; it is a spam brake, not a security boundary. Anything that
 * must be exact (one-time code verification) is enforced in D1 instead. */
export async function rateLimit(
  identifier: string,
  limit: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  const kv = await getCache();
  const window = Math.floor(Date.now() / 1000 / windowSeconds);
  const key = `ratelimit:${identifier}:${window}`;

  const current = Number((await kv.get(key)) ?? 0);
  const used = current + 1;

  if (current >= limit) {
    return { allowed: false, remaining: 0, retryAfter: windowSeconds };
  }

  await kv.put(key, String(used), { expirationTtl: windowSeconds });

  return {
    allowed: true,
    remaining: Math.max(0, limit - used),
    retryAfter: windowSeconds,
  };
}
