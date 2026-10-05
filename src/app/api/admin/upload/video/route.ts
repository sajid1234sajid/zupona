import { NextResponse, type NextRequest } from "next/server";
import {
  abortVideoUpload,
  finishVideoUpload,
  isOwnVideoKey,
  putVideoPart,
  startVideoUpload,
  VIDEO_PART_BYTES,
} from "@/lib/media";
import { getCurrentUser } from "@/lib/session";
import { canManageMedia } from "@/lib/sellers";
import { rateLimit } from "@/lib/cache";

/** Chunked video uploads for the admin panel.
 *
 * The single-request path in `../route.ts` sends a clip as one long POST, and
 * on a phone that is exactly what fails: one handover between towers and the
 * whole clip starts again from zero, with a 100 MB platform cap on top. Here
 * the clip goes up in 8 MiB pieces that the picker sends a few at a time and
 * resends one by one when the line drops.
 *
 *   POST ?step=start   {contentType, size}          -> {key, uploadId}
 *   POST ?step=part&key&uploadId&part=N  raw bytes  -> {partNumber, etag}
 *   POST ?step=finish  {key, uploadId, parts}       -> {url}
 *   POST ?step=abort   {key, uploadId}
 *
 * Every step re-checks the caller and that the key sits under their own id,
 * since the key and upload id come back from the browser. */

type Step = "start" | "part" | "finish" | "abort";

function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  // The admin team, and approved sellers listing their own products.
  if (!user || !(await canManageMedia(user))) {
    return fail("Not authorized.", 403);
  }

  const step = request.nextUrl.searchParams.get("step") as Step | null;

  try {
    if (step === "start") {
      const limit = await rateLimit(`admin-upload:${user.id}`, 120, 60).catch(() => null);
      if (limit && !limit.allowed) {
        return fail("Too many uploads at once. Wait a moment and try again.", 429);
      }
      const body = (await request.json()) as { contentType?: string; size?: number };
      const started = await startVideoUpload(
        String(body.contentType ?? "").split(";")[0].trim(),
        Number(body.size),
        user.id
      );
      return NextResponse.json(started);
    }

    if (step === "part") {
      const params = request.nextUrl.searchParams;
      const key = params.get("key") ?? "";
      const uploadId = params.get("uploadId") ?? "";
      const partNumber = Number(params.get("part"));
      const length = Number(request.headers.get("content-length") ?? "0");

      if (!isOwnVideoKey(key, user.id) || !uploadId) return fail("Unknown upload.", 404);
      if (!Number.isInteger(partNumber) || partNumber < 1 || partNumber > 10000) {
        return fail("Bad part number.");
      }
      if (!request.body || length <= 0) return fail("Empty part.");
      if (length > VIDEO_PART_BYTES) return fail("Part is too large.");

      const part = await putVideoPart(key, uploadId, partNumber, request.body);
      return NextResponse.json(part);
    }

    if (step === "finish" || step === "abort") {
      const body = (await request.json()) as {
        key?: string;
        uploadId?: string;
        parts?: { partNumber: number; etag: string }[];
      };
      const key = String(body.key ?? "");
      const uploadId = String(body.uploadId ?? "");
      if (!isOwnVideoKey(key, user.id) || !uploadId) return fail("Unknown upload.", 404);

      if (step === "abort") {
        await abortVideoUpload(key, uploadId).catch(() => {});
        return NextResponse.json({ ok: true });
      }

      const parts = (body.parts ?? [])
        .map((part) => ({ partNumber: Number(part.partNumber), etag: String(part.etag) }))
        .filter((part) => Number.isInteger(part.partNumber) && part.etag)
        .sort((a, b) => a.partNumber - b.partNumber);
      if (parts.length === 0) return fail("No parts were uploaded.");

      const result = await finishVideoUpload(key, uploadId, parts);
      return NextResponse.json({
        url: `/api/media/${result.key}`,
        key: result.key,
        size: result.size,
        contentType: result.contentType,
      });
    }

    return fail("Unknown step.");
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Upload failed.");
  }
}
