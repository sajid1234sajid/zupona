/** The signed-in shopper's profile photo.
 *
 * Uploaded rather than pasted: a pasted address was stored as it was typed,
 * and the account page then drew a Google share link as a broken image. The
 * browser crops the picture square at 256px before sending it, so this is a
 * few kilobytes; 3 MB is the ceiling. */

import { getCurrentUser } from "@/lib/session";
import { getDB } from "@/lib/db";
import { uploadMedia } from "@/lib/media";
import { rateLimit } from "@/lib/cache";

const MAX_BYTES = 3 * 1024 * 1024;

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Please sign in." }, { status: 401 });

  const limit = await rateLimit(`avatar:${user.id}`, 10, 3600).catch(() => null);
  if (limit && !limit.allowed) return Response.json({ error: "Try again later." }, { status: 429 });

  let file: FormDataEntryValue | null = null;
  try {
    file = (await request.formData()).get("file");
  } catch {
    return Response.json({ error: "Could not read the photo." }, { status: 400 });
  }
  if (!(file instanceof File)) return Response.json({ error: "No photo attached." }, { status: 400 });
  if (file.size > MAX_BYTES) return Response.json({ error: "The photo must be under 3 MB." }, { status: 400 });

  try {
    const { key } = await uploadMedia(file, "avatars", user.id);
    const url = `/api/media/${key}`;
    const db = await getDB();
    await db.prepare("UPDATE users SET avatar_url = ? WHERE id = ?").bind(url, user.id).run();
    return Response.json({ url });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Upload failed." },
      { status: 400 }
    );
  }
}

/** Removes the photo; the account page shows initials instead. */
export async function DELETE() {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Please sign in." }, { status: 401 });
  const db = await getDB();
  await db.prepare("UPDATE users SET avatar_url = NULL WHERE id = ?").bind(user.id).run();
  return Response.json({ ok: true });
}
