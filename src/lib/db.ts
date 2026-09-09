/** Accessors for the Cloudflare bindings declared in wrangler.jsonc.
 *
 *  - DB    (D1)  -- the relational store: accounts, catalog, orders, payments
 *  - MEDIA (R2)  -- product images, review photos, seller KYC documents
 *  - CACHE (KV)  -- hot-read cache, OTP throttling, rate limiting
 *
 * All three only exist inside the Workers runtime, so they are reached through
 * a dynamic `cloudflare:workers` import rather than a module-level one. */

async function getEnv(): Promise<Cloudflare.Env> {
  try {
    const { env } = await import("cloudflare:workers");
    return env;
  } catch {
    throw new Error(
      "Cloudflare bindings aren't available. The Zupona account system needs the vinext/Cloudflare " +
        "runtime — run `npm run dev` (not `dev:next-native`) or deploy with `npm run deploy`."
    );
  }
}

export async function getDB(): Promise<D1Database> {
  return (await getEnv()).DB;
}

/** R2 bucket holding uploaded media. Rows in the database store the object
 * key; the bytes live here. */
export async function getMedia(): Promise<R2Bucket> {
  return (await getEnv()).MEDIA;
}

/** KV namespace used as an edge cache in front of D1. */
export async function getCache(): Promise<KVNamespace> {
  return (await getEnv()).CACHE;
}
