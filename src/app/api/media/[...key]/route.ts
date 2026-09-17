import { NextResponse, type NextRequest } from "next/server";
import { getMediaObject } from "@/lib/media";
import { getCurrentUser } from "@/lib/session";
import { getImages } from "@/lib/db";
import { isAllowedWidth } from "@/lib/image";

/** Serves objects out of the MEDIA R2 bucket.
 *
 * The bucket itself stays closed to the internet and everything is read
 * through here, so private folders can be gated. Product and review imagery is
 * public; seller KYC paperwork is only ever visible to staff.
 *
 * Range requests are honoured because product videos are served from here: a
 * browser scrubbing a <video> asks for byte ranges, and a server that only
 * ever answers 200 with the whole file leaves the timeline unseekable and
 * makes Safari refuse to play at all.
 *
 * Answers are kept in the colo's own cache, because Cloudflare does not cache
 * a Worker's response on its own -- every request here was arriving as a
 * `CF-Cache-Status: BYPASS`, re-reading R2 and re-running the transform for a
 * picture that had not changed since it was uploaded. Object keys are random
 * and never reused and the width is part of the URL, so a stored answer can
 * never be the wrong one.
 *
 * `?w=<pixels>` resizes on the way out through the Cloudflare Images binding.
 * This route is the *only* place an upload can be resized: `/_next/image`
 * answers 404 for an `/api/media/` URL, so before this the shop served every
 * admin upload at its original size -- half-megabyte phone photographs behind
 * 170 px grid tiles. Without `w` the original is served exactly as before, so
 * nothing that already links to one of these URLs changes. */

const STAFF_ONLY_PREFIXES = ["kyc/"];

/** Formats worth re-encoding. Anything else -- SVG, which has no pixels to
 * resize, and GIF, whose animation the binding would flatten -- is served
 * whole however small `w` asks for. */
const RESIZABLE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);

/** Reads `?w=`, rejecting anything not on the project's width list.
 *
 * The allow-list matters: each distinct width is its own transform and its own
 * cache entry, so an open `w` would let a crawler walk `?w=1` upwards and bill
 * a transform for every step. */
function parseWidth(raw: string | null): number | null {
  if (!raw || !/^[0-9]{1,4}$/.test(raw)) return null;
  const width = Number(raw);
  return isAllowedWidth(width) ? width : null;
}

/** How long the edge may keep a rendered answer.
 *
 * A year, matching the `immutable` the response already carries: the key names
 * one exact object and `?w=` names one exact size, so there is nothing for a
 * stored copy to go stale against. Replacing a product photograph writes a new
 * key rather than overwriting this one. */
const EDGE_TTL_SECONDS = 31536000;

/** The colo cache, or null where there isn't one (the Node dev server). */
function edgeCache(): Cache | null {
  try {
    return typeof caches !== "undefined" ? caches.default : null;
  } catch {
    return null;
  }
}

/** Parses a single-range `bytes=` header into what R2 understands.
 *
 * Only one range is handled -- multipart/byteranges responses are what a
 * download manager asks for, never a video element -- and anything malformed
 * falls through to serving the whole object. */
function parseRange(header: string | null): R2Range | null {
  if (!header) return null;

  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match) return null;

  const [, rawStart, rawEnd] = match;
  if (rawStart === "" && rawEnd === "") return null;

  // "bytes=-500" means the last 500 bytes, not "from 0 to 500".
  if (rawStart === "") return { suffix: Number(rawEnd) };
  if (rawEnd === "") return { offset: Number(rawStart) };

  const offset = Number(rawStart);
  const end = Number(rawEnd);
  if (end < offset) return null;

  return { offset, length: end - offset + 1 };
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ key: string[] }> }
) {
  const { key: segments } = await context.params;
  const key = segments.join("/");

  // Reject traversal attempts before they reach the bucket.
  if (key.includes("..")) {
    return new NextResponse("Not found", { status: 404 });
  }

  const isPrivate = STAFF_ONLY_PREFIXES.some((prefix) => key.startsWith(prefix));

  if (isPrivate) {
    const user = await getCurrentUser();
    if (!user || (user.role !== "admin" && user.role !== "support")) {
      return new NextResponse("Not found", { status: 404 });
    }
  }

  // A stored answer, if this colo already rendered this exact URL. Skipped for
  // a range request, whose 206 belongs to one player's byte window and must
  // never be handed to the next caller asking for the whole file, and for
  // private documents, which are not for a shared cache to hold.
  const cache = isPrivate ? null : edgeCache();
  const cacheKey = new Request(request.url, { method: "GET" });
  const isRangeRequest = request.headers.has("range");

  if (cache && !isRangeRequest) {
    const hit = await cache.match(cacheKey);
    if (hit) return hit;
  }

  /** Stores `response` for next time and hands back the copy to serve. */
  async function store(response: Response): Promise<Response> {
    if (!cache || isRangeRequest || response.status !== 200) return response;

    const stored = new Response(response.body, response);
    stored.headers.set("cache-control", `public, max-age=${EDGE_TTL_SECONDS}, immutable`);

    // One copy is given to the cache and the other to the caller; a body can
    // only be read once. The put is not awaited -- `waitUntil` keeps the
    // Worker alive for it after the picture has already gone out.
    const forCache = stored.clone();
    try {
      const { waitUntil } = await import("cloudflare:workers");
      waitUntil(cache.put(cacheKey, forCache));
    } catch {
      // No runtime to defer the write to; filling the cache is best-effort.
    }

    return stored;
  }

  const range = parseRange(request.headers.get("range"));

  // R2 rejects a range that starts past the end of the object. Players probe
  // with speculative ranges, so that answer has to be a 416 telling them the
  // real size rather than a 500 that looks like the file is broken.
  let object: Awaited<ReturnType<typeof getMediaObject>>;
  try {
    object = await getMediaObject(key, range ? { range } : undefined);
  } catch {
    const whole = await getMediaObject(key);
    if (!whole) return new NextResponse("Not found", { status: 404 });

    return new NextResponse(null, {
      status: 416,
      headers: {
        "content-range": `bytes */${whole.size}`,
        "accept-ranges": "bytes",
      },
    });
  }

  if (!object) {
    return new NextResponse("Not found", { status: 404 });
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);

  // Keys are random and never reused, so public media can be cached hard.
  // Private documents must not be stored by shared caches.
  headers.set(
    "cache-control",
    isPrivate ? "private, no-store" : "public, max-age=31536000, immutable"
  );
  headers.set("accept-ranges", "bytes");

  const body = "body" in object ? object.body : null;

  // R2 reports back which slice it actually returned, which is what has to be
  // echoed in Content-Range -- a suffix range resolves to an absolute offset
  // only the bucket knows.
  if (range && object.range && body) {
    const served = object.range;

    // A suffix range ("the last N bytes") is reported back as-is by some
    // versions of the binding, so it is resolved against the object size here
    // rather than assumed to have been rewritten into an offset.
    const suffix = "suffix" in served ? served.suffix : undefined;
    const offset =
      suffix !== undefined
        ? Math.max(0, object.size - suffix)
        : "offset" in served && served.offset !== undefined
          ? served.offset
          : 0;
    const length =
      suffix !== undefined
        ? Math.min(suffix, object.size)
        : "length" in served && served.length !== undefined
          ? served.length
          : object.size - offset;

    headers.set("content-range", `bytes ${offset}-${offset + length - 1}/${object.size}`);
    headers.set("content-length", String(length));

    return new NextResponse(body, { status: 206, headers });
  }

  // Resize, when a width was asked for and the object is a still image.
  //
  // WebP unconditionally rather than negotiating AVIF from `Accept`: the
  // response would then differ by request header, and a `Vary: Accept` on a
  // hot, edge-cached path is how one visitor's AVIF ends up in front of a
  // browser that cannot decode it. WebP is understood everywhere that matters
  // and is already several times smaller than the PNGs being uploaded.
  const width = parseWidth(request.nextUrl.searchParams.get("w"));
  const contentType = headers.get("content-type") ?? "";

  if (width && body && RESIZABLE_TYPES.has(contentType)) {
    try {
      const images = await getImages();
      const resized = await images
        .input(body)
        // `scale-down` never enlarges: a thumbnail asked for at 1440 comes
        // back at its own size rather than upscaled and blurry.
        .transform({ width, fit: "scale-down" })
        .output({ format: "image/webp", quality: 78 });

      const resizedHeaders = new Headers(headers);
      resizedHeaders.set("content-type", "image/webp");
      // The object key is immutable and the width is part of the URL, so the
      // result can be cached as hard as the original. Content-Length is gone
      // because the transform streams.
      resizedHeaders.delete("content-length");
      resizedHeaders.delete("etag");

      return await store(new NextResponse(resized.image(), { headers: resizedHeaders }));
    } catch {
      // A transform that fails must not lose the picture. Fall through and
      // serve the original -- oversized, but visible.
      const original = await getMediaObject(key);
      if (original && "body" in original) {
        headers.set("content-length", String(original.size));
        return new NextResponse(original.body, { headers });
      }
      return new NextResponse("Not found", { status: 404 });
    }
  }

  headers.set("content-length", String(object.size));
  return await store(new NextResponse(body, { headers }));
}
