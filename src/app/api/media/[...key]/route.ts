import { NextResponse, type NextRequest } from "next/server";
import { getMediaObject } from "@/lib/media";
import { getCurrentUser } from "@/lib/session";

/** Serves objects out of the MEDIA R2 bucket.
 *
 * The bucket itself stays closed to the internet and everything is read
 * through here, so private folders can be gated. Product and review imagery is
 * public; seller KYC paperwork is only ever visible to staff.
 *
 * Range requests are honoured because product videos are served from here: a
 * browser scrubbing a <video> asks for byte ranges, and a server that only
 * ever answers 200 with the whole file leaves the timeline unseekable and
 * makes Safari refuse to play at all. */

const STAFF_ONLY_PREFIXES = ["kyc/"];

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

  headers.set("content-length", String(object.size));
  return new NextResponse(body, { headers });
}
