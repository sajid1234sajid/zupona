import { NextResponse, type NextRequest } from "next/server";
import { uploadMedia, uploadMediaStream, type MediaFolder } from "@/lib/media";
import { getCurrentUser } from "@/lib/session";
import { rateLimit } from "@/lib/cache";

/** Image and video uploads for the admin panel.
 *
 * A route handler rather than a server action because the uploader needs a
 * per-file response while the form is still being filled in -- the admin drops
 * five images, sees five thumbnails appear, and only then submits. The
 * returned URL is what the form posts back and what lands in the database.
 *
 * Two shapes are accepted. A multipart form post is the familiar one and is
 * what the image picker sends. A raw body -- the file itself, with its type in
 * Content-Type and the destination in the `folder` query parameter -- is what
 * the video picker sends, because `formData()` buffers and parses the whole
 * upload inside the Worker: fine for a photo, but a phone video is large
 * enough that the parse alone exhausts the request's CPU allowance and the
 * Worker dies without ever returning a reply. Streaming the body to R2 costs
 * almost no CPU at any size.
 *
 * Authorization is checked here and not left to the proxy: this endpoint
 * writes to R2, so it verifies the caller itself. */

const FOLDERS = new Set<MediaFolder>([
  "products",
  "videos",
  "reviews",
  "sellers",
  "avatars",
]);

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || (user.role !== "admin" && user.role !== "support")) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  // A stuck uploader retrying in a loop would otherwise fill the bucket.
  const limit = await rateLimit(`admin-upload:${user.id}`, 120, 60).catch(() => null);
  if (limit && !limit.allowed) {
    return NextResponse.json(
      { error: "Too many uploads at once. Wait a moment and try again." },
      { status: 429 }
    );
  }

  const contentType = request.headers.get("content-type") ?? "";

  // Raw-body upload: the file is the request, nothing to parse.
  if (!contentType.startsWith("multipart/form-data")) {
    const requestedFolder = request.nextUrl.searchParams.get("folder") ?? "products";
    const folder: MediaFolder = FOLDERS.has(requestedFolder as MediaFolder)
      ? (requestedFolder as MediaFolder)
      : "products";

    if (!request.body) {
      return NextResponse.json({ error: "No file was attached." }, { status: 400 });
    }

    const declaredSize = Number(request.headers.get("content-length") ?? "0");

    // The picture's size as the uploader measured it. Kept only as a plausible
    // pair of whole numbers, because it becomes part of a storage key.
    const width = Number(request.nextUrl.searchParams.get("w"));
    const height = Number(request.nextUrl.searchParams.get("h"));
    const dimensions =
      Number.isInteger(width) &&
      Number.isInteger(height) &&
      width > 0 &&
      height > 0 &&
      width <= 20000 &&
      height <= 20000
        ? { width, height }
        : null;

    try {
      const result = await uploadMediaStream(
        request.body,
        // The browser sets Content-Type from the File itself; parameters like
        // a codecs= suffix would otherwise fail the allow-list check.
        contentType.split(";")[0].trim(),
        declaredSize,
        folder,
        user.id,
        dimensions
      );
      return NextResponse.json({
        url: `/api/media/${result.key}`,
        key: result.key,
        size: result.size,
        contentType: result.contentType,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Upload failed.";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Could not read the upload." }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file was attached." }, { status: 400 });
  }

  const requested = String(formData.get("folder") ?? "products") as MediaFolder;
  const folder: MediaFolder = FOLDERS.has(requested) ? requested : "products";

  try {
    // Objects are grouped under the uploading admin rather than under a
    // product id: at this point in the form the product may not exist yet.
    const result = await uploadMedia(file, folder, user.id);
    return NextResponse.json({
      url: `/api/media/${result.key}`,
      key: result.key,
      size: result.size,
      contentType: result.contentType,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
