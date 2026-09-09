import { NextResponse, type NextRequest } from "next/server";
import { uploadMedia, type MediaFolder } from "@/lib/media";
import { getCurrentUser } from "@/lib/session";
import { rateLimit } from "@/lib/cache";

/** Image and video uploads for the admin panel.
 *
 * A route handler rather than a server action because the uploader needs a
 * per-file response while the form is still being filled in -- the admin drops
 * five images, sees five thumbnails appear, and only then submits. The
 * returned URL is what the form posts back and what lands in the database.
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
