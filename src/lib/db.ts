/** Accessors for the Cloudflare bindings declared in wrangler.jsonc.
 *
 *  - DB    (D1)  -- the relational store: accounts, catalog, orders, payments
 *  - MEDIA (R2)  -- product images, review photos, seller KYC documents
 *  - CACHE (KV)  -- hot-read cache, OTP throttling, rate limiting
 *  - IMAGES      -- Cloudflare Images, used to resize media on the way out
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

/** Cloudflare Images, used by the media route to resize an upload down to the
 * size the page actually draws it at. */
export async function getImages(): Promise<ImagesBinding> {
  return (await getEnv()).IMAGES;
}

/** Runs `task` after the response has gone, keeping the Worker alive for it.
 *
 * For writes nobody is waiting on, such as an activity row. Outside the
 * Workers runtime it is simply awaited. A failure is logged, never thrown. */
export async function afterResponse(label: string, task: () => Promise<unknown>): Promise<void> {
  const guarded = task().catch((error) => console.error(`${label} failed`, error));
  try {
    const { waitUntil } = await import("cloudflare:workers");
    waitUntil(guarded);
  } catch {
    await guarded;
  }
}
