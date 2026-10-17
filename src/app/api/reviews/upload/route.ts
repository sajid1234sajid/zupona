/** One review photo, from a signed-in shopper.
 *
 * Stored under `reviews/<user id>/`, which is what the review action checks a
 * photo URL against: a shopper can attach only pictures they uploaded
 * themselves. The form shrinks each picture in the browser first, so this is
 * normally a few hundred kilobytes; 5 MB is the ceiling. Rate-limited so the
 * route cannot be used as free storage. */

import { getCurrentUser } from "@/lib/session";
import { uploadMedia } from "@/lib/media";
import { rateLimit } from "@/lib/cache";

const MAX_BYTES = 5 * 1024 * 1024;

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Please sign in." }, { status: 401 });

  const limit = await rateLimit(`review-upload:${user.id}`, 30, 3600).catch(() => null);
  if (limit && !limit.allowed) {
    return Response.json({ error: "Too many photos for now. Try again later." }, { status: 429 });
  }

  let file: FormDataEntryValue | null = null;
  try {
    file = (await request.formData()).get("file");
  } catch {
    return Response.json({ error: "Could not read the photo." }, { status: 400 });
  }
  if (!(file instanceof File)) return Response.json({ error: "No photo attached." }, { status: 400 });
  if (file.size > MAX_BYTES) return Response.json({ error: "Each photo must be under 5 MB." }, { status: 400 });

  try {
    const result = await uploadMedia(file, "reviews", user.id);
    return Response.json({ url: `/api/media/${result.key}` });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Upload failed." },
      { status: 400 }
    );
  }
}
